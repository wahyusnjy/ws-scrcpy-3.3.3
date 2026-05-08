import { Mw, RequestParameters } from './Mw';
import WS from 'ws';
import { ACTION } from '../../common/Action';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';

export class WebsocketProxy extends Mw {
    public static readonly TAG = 'WebsocketProxy';
    private remoteSocket?: WS;
    private released = false;
    private storage: WS.MessageEvent[] = [];
    private static readonly MAX_STORAGE_SIZE = 1000;
    private lastFrameTime = 0;
    private static readonly STALL_THRESHOLD = 500;
    private static readonly MAX_BUFFERED_AMOUNT = 2 * 1024 * 1024; // 2MB
    private dropCount = 0;
    private totalDropCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static processRequest(ws: WS, params: RequestParameters): WebsocketProxy | undefined {
        const { action, url } = params;
        if (action !== ACTION.PROXY_WS) {
            return;
        }
        const wsString = url.searchParams.get('ws');
        if (!wsString) {
            ws.close(4003, `[${this.TAG}] Invalid value "${ws}" for "ws" parameter`);
            return;
        }
        return this.createProxy(ws, wsString);
    }

    public static createProxy(ws: WS | Multiplexer, remoteUrl: string): WebsocketProxy {
        const service = new WebsocketProxy(ws);
        service.init(remoteUrl).catch((e) => {
            const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
            console.error(msg);
            ws.close(4005, msg);
        });
        return service;
    }

    constructor(ws: WS | Multiplexer) {
        super(ws);
    }

    public async init(remoteUrl: string): Promise<void> {
        this.name = `[${WebsocketProxy.TAG}{$${remoteUrl}}]`;
        const remoteSocket = new WS(remoteUrl);
        remoteSocket.on('upgrade', (res) => {
            if (res.socket) {
                res.socket.setNoDelay(true);
            }
        });
        remoteSocket.onopen = () => {
            this.remoteSocket = remoteSocket;
            this.flush();
        };
        remoteSocket.onmessage = (event) => {
            const now = Date.now();
            if (this.lastFrameTime > 0) {
                const interval = now - this.lastFrameTime;
                if (interval > WebsocketProxy.STALL_THRESHOLD) {
                    console.warn(`${this.name} [Stall] Frame interval: ${interval}ms`);
                }
            }
            this.lastFrameTime = now;

            if (this.ws && this.ws.readyState === this.ws.OPEN) {
                // Socket Backpressure check
                const bufferedAmount = (this.ws as any).bufferedAmount || 0;
                if (bufferedAmount > WebsocketProxy.MAX_BUFFERED_AMOUNT) {
                    // Cek tipe NAL Unit: JANGAN buang Keyframe (SPS/PPS/IDR)
                    if (this.isKeyFrame(event.data)) {
                        if (this.dropCount > 0) {
                            console.warn(`${this.name} [Backpressure] Dropped ${this.dropCount} P-Frames to clear buffer. Sending mandatory Keyframe now.`);
                            this.dropCount = 0;
                        }
                    } else {
                        // Drop frame biner biasa (P-Frame) untuk mencegah penumpukan delay
                        this.dropCount++;
                        this.totalDropCount++;
                        if (this.dropCount % 100 === 0) {
                            console.log(`${this.name} [Backpressure] Currently dropping frames (${this.dropCount} in current streak, total: ${this.totalDropCount})`);
                        }
                        return;
                    }
                }

                if (Array.isArray(event.data)) {
                    event.data.forEach((data) => this.ws.send(data));
                } else {
                    this.ws.send(event.data);
                }
            }
        };
        remoteSocket.onclose = (e) => {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close(e.wasClean ? 1000 : 4010);
            }
        };
        remoteSocket.onerror = (e) => {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close(4011, e.message);
            }
        };
    }

    private flush(): void {
        if (this.remoteSocket) {
            while (this.storage.length) {
                const event = this.storage.shift();
                if (event && event.data) {
                    this.remoteSocket.send(event.data);
                }
            }
            if (this.released) {
                this.remoteSocket.close();
            }
        }
        this.storage.length = 0;
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        if (this.remoteSocket) {
            this.remoteSocket.send(event.data);
        } else {
            if (this.storage.length >= WebsocketProxy.MAX_STORAGE_SIZE) {
                this.storage.shift();
            }
            this.storage.push(event);
        }
    }

    public release(): void {
        if (this.released) {
            return;
        }
        if (this.totalDropCount > 0) {
            console.log(`${this.name} [Final Stats] Connection closed. Total frames dropped: ${this.totalDropCount}`);
        }
        super.release();
        this.released = true;
        this.flush();
    }

    private isKeyFrame(data: any): boolean {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        let offset = 0;

        // Skip Annex B start code (00 00 00 01 atau 00 00 01)
        if (buffer.length > 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 1) {
            offset = 4;
        } else if (buffer.length > 3 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1) {
            offset = 3;
        }

        if (buffer.length <= offset) return false;

        // NAL Header byte: [F(1) | NRI(2) | Type(5)]
        const type = buffer[offset] & 0x1f;

        // Critical NAL Types:
        // 5: IDR (Coded slice of an IDR picture) - KEYFRAME
        // 7: SPS (Sequence Parameter Set) - METADATA
        // 8: PPS (Picture Parameter Set) - METADATA
        return type === 5 || type === 7 || type === 8;
    }
}
