import { ManagerClient } from './ManagerClient';
import { ControlMessage } from '../controlMessage/ControlMessage';
import DeviceMessage from '../googDevice/DeviceMessage';
import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Util from '../Util';
import { DisplayInfo } from '../DisplayInfo';
import Size from '../Size';
import { ParamsStream } from '../../types/ParamsStream';

const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC_BYTES_INITIAL = Util.stringToUtf8ByteArray('scrcpy_initial');

export type ClientsStats = {
    deviceName: string;
    clientId: number;
};

export type DisplayCombinedInfo = {
    displayInfo: DisplayInfo;
    videoSettings?: VideoSettings;
    screenInfo?: ScreenInfo;
    connectionCount: number;
};

interface StreamReceiverEvents {
    video: ArrayBuffer;
    deviceMessage: DeviceMessage;
    displayInfo: DisplayCombinedInfo[];
    clientsStats: ClientsStats;
    encoders: string[];
    connected: void;
    disconnected: CloseEvent;
}

const TAG = '[StreamReceiver]';

export class StreamReceiver<P extends ParamsStream> extends ManagerClient<ParamsStream, StreamReceiverEvents> {
    private events: ControlMessage[] = [];
    private encodersSet: Set<string> = new Set<string>();
    private clientId = -1;
    private deviceName = '';
    private readonly displayInfoMap: Map<number, DisplayInfo> = new Map();
    private readonly connectionCountMap: Map<number, number> = new Map();
    private readonly screenInfoMap: Map<number, ScreenInfo> = new Map();
    private readonly videoSettingsMap: Map<number, VideoSettings> = new Map();
    private hasInitialInfo = false;
    private cachedConfigFrames: ArrayBuffer[] = [];  // ✅ cache ALL config frames (SPS + PPS)

    constructor(params: P) {
        super(params);
        this.openNewConnection();
        if (this.ws) {
            this.ws.binaryType = 'arraybuffer';
        }
    }

    private handleInitialInfo(data: ArrayBuffer): void {
        let offset = MAGIC_BYTES_INITIAL.length;
        let nameBytes = new Uint8Array(data, offset, DEVICE_NAME_FIELD_LENGTH);
        offset += DEVICE_NAME_FIELD_LENGTH;
        let rest: Buffer = Buffer.from(new Uint8Array(data, offset));
        const displaysCount = rest.readInt32BE(0);
        this.displayInfoMap.clear();
        this.connectionCountMap.clear();
        this.screenInfoMap.clear();
        this.videoSettingsMap.clear();
        rest = rest.slice(4);
        for (let i = 0; i < displaysCount; i++) {
            const displayInfoBuffer = rest.slice(0, DisplayInfo.BUFFER_LENGTH);
            const displayInfo = DisplayInfo.fromBuffer(displayInfoBuffer);
            const { displayId } = displayInfo;
            this.displayInfoMap.set(displayId, displayInfo);
            rest = rest.slice(DisplayInfo.BUFFER_LENGTH);
            this.connectionCountMap.set(displayId, rest.readInt32BE(0));
            rest = rest.slice(4);
            const screenInfoBytesCount = rest.readInt32BE(0);
            rest = rest.slice(4);
            if (screenInfoBytesCount) {
                this.screenInfoMap.set(displayId, ScreenInfo.fromBuffer(rest.slice(0, screenInfoBytesCount)));
                rest = rest.slice(screenInfoBytesCount);
            }
            const videoSettingsBytesCount = rest.readInt32BE(0);
            rest = rest.slice(4);
            if (videoSettingsBytesCount) {
                this.videoSettingsMap.set(displayId, VideoSettings.fromBuffer(rest.slice(0, videoSettingsBytesCount)));
                rest = rest.slice(videoSettingsBytesCount);
            }
        }
        this.encodersSet.clear();
        const encodersCount = rest.readInt32BE(0);
        rest = rest.slice(4);
        for (let i = 0; i < encodersCount; i++) {
            const nameLength = rest.readInt32BE(0);
            rest = rest.slice(4);
            const nameBytes = rest.slice(0, nameLength);
            rest = rest.slice(nameLength);
            const name = Util.utf8ByteArrayToString(nameBytes);
            this.encodersSet.add(name);
        }
        this.clientId = rest.readInt32BE(0);
        nameBytes = Util.filterTrailingZeroes(nameBytes);
        this.deviceName = Util.utf8ByteArrayToString(nameBytes);
        this.hasInitialInfo = true;
        this.triggerInitialInfoEvents();
    }

    private static EqualArrays(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, l = a.length; i < l; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        if (this.supportMultiplexing()) {
            return localUrl;
        }
        localUrl.searchParams.set('udid', this.params.udid);
        return localUrl;
    }

    protected onSocketClose(ev: CloseEvent): void {
        console.log(`${TAG}. WS closed: ${ev.reason}`);
        this.emit('disconnected', ev);
    }

    protected onSocketMessage(event: MessageEvent): void {
        // Handle TEXT messages — our WebSocket server sends JSON deviceInfo as text
        if (typeof event.data === 'string') {
            try {
                const json = JSON.parse(event.data);
                if (json && json.type === 'deviceInfo') {
                    // Server sent device info — synthesize the displayInfo event so
                    // StreamClientScrcpy.onDisplayInfo() is called and video can start.
                    const deviceName = `${json.device?.manufacturer || ''} ${json.device?.model || ''}`.trim() || 'Android';
                    this.deviceName = deviceName;
                    this.clientId = 0;
                    this.hasInitialInfo = true;

                    // Build a synthetic DisplayInfo for display 0
                    // We don't have real dimensions yet; StreamClientScrcpy will use
                    // preferredVideoSettings (320x720) which is fine.
                    const syntheticDisplayInfo = new DisplayInfo(0, new Size(1080, 1920), 0, 0, 0);
                    this.displayInfoMap.set(0, syntheticDisplayInfo);
                    this.connectionCountMap.set(0, 0);

                    this.triggerInitialInfoEvents();
                    console.log('[StreamReceiver] Got deviceInfo JSON → emitted synthetic displayInfo. Video should start.');
                }
            } catch {
                // Not JSON, ignore
            }
            return;
        }

        if (event.data instanceof ArrayBuffer) {
            // works only because MAGIC_BYTES_INITIAL and MAGIC_BYTES_MESSAGE have same length
            if (event.data.byteLength > MAGIC_BYTES_INITIAL.length) {
                const magicBytes = new Uint8Array(event.data, 0, MAGIC_BYTES_INITIAL.length);
                if (StreamReceiver.EqualArrays(magicBytes, MAGIC_BYTES_INITIAL)) {
                    this.handleInitialInfo(event.data);
                    return;
                }
                if (StreamReceiver.EqualArrays(magicBytes, DeviceMessage.MAGIC_BYTES_MESSAGE)) {
                    const message = DeviceMessage.fromBuffer(event.data);
                    this.emit('deviceMessage', message);
                    return;
                }
            }
            const data = event.data as ArrayBuffer;
            const view = new DataView(data);

            // Cek apakah ini config frame (pts flags bit 63 set = PACKET_FLAG_CONFIG)
            // Format: 8 byte pts+flags, 4 byte size, lalu data
            if (data.byteLength > 12) {
                const ptsHigh = view.getUint32(0, false); // big-endian, upper 32 bit
                const isConfig = (ptsHigh & 0x80000000) !== 0;

                if (isConfig) {
                    // ✅ Simpan semua config frames (SPS, PPS, VPS)
                    this.cachedConfigFrames.push(data.slice(0));
                    console.log(TAG, `Cached config frame #${this.cachedConfigFrames.length}, size:`, data.byteLength);
                }
            }

            this.emit('video', new Uint8Array(data));

        }
    }

    protected onSocketOpen(): void {
        this.emit('connected', void 0);

        // ✅ Replay semua cached config frames (SPS, PPS) ke player sebelum data live
        // Tanpa ini decoder tidak bisa init dan screen tetap hitam
        if (this.cachedConfigFrames.length > 0) {
            console.log(TAG, `Reconnected: replaying ${this.cachedConfigFrames.length} cached config frames`);
            for (const frame of this.cachedConfigFrames) {
                this.emit('video', new Uint8Array(frame));
            }
        }
        
        let e = this.events.shift();
        while (e) {
            this.sendEvent(e);
            e = this.events.shift();
        }
    }

    public sendEvent(event: ControlMessage): void {
        // console.log(TAG, 'sendEvent called. event type:', event.type);
        // console.log(TAG, 'WebSocket exists:', !!this.ws);
        // console.log(TAG, 'WebSocket readyState:', this.ws?.readyState, 'OPEN:', this.ws?.OPEN);
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            const buffer = event.toBuffer();
            // console.log(TAG, 'Sending buffer via WebSocket, size:', buffer.byteLength, 'bytes');
            this.ws.send(buffer);
            // console.log(TAG, 'Buffer sent successfully');
        } else {
            console.warn(TAG, 'WebSocket not open! Queuing event. events.length:', this.events.length);
            this.events.push(event);
        }
    }

    public stop(): void {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
        }
        this.events.length = 0;
    }

    public getEncoders(): string[] {
        return Array.from(this.encodersSet.values());
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public triggerInitialInfoEvents(): void {
        if (this.hasInitialInfo) {
            const encoders = this.getEncoders();
            this.emit('encoders', encoders);
            const { clientId, deviceName } = this;
            this.emit('clientsStats', { clientId, deviceName });
            const infoArray: DisplayCombinedInfo[] = [];
            this.displayInfoMap.forEach((displayInfo: DisplayInfo, displayId: number) => {
                const connectionCount = this.connectionCountMap.get(displayId) || 0;
                infoArray.push({
                    displayInfo,
                    videoSettings: this.videoSettingsMap.get(displayId),
                    screenInfo: this.screenInfoMap.get(displayId),
                    connectionCount,
                });
            });
            this.emit('displayInfo', infoArray);
        }
    }

    public getDisplayInfo(displayId: number): DisplayInfo | undefined {
        return this.displayInfoMap.get(displayId);
    }
}
