import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { Message } from '../../../types/Message';
import { ACTION } from '../../../common/Action';
import { AdbUtils } from '../AdbUtils';
import { AdbExtended } from '../adb';

interface DensityRequest {
    type: 'set' | 'reset' | 'get' | 'set_all';
    serial?: string;
    density?: number;
}

interface DensityResponse {
    success: boolean;
    message?: string;
    data?: any;
}

export class DeviceDensity extends Mw {
    public static readonly TAG = 'DeviceDensity';
    private static readonly EVENT_TYPE = 'device-density';

    public static processRequest(ws: WS, params: RequestParameters): DeviceDensity | undefined {
        if (params.action !== ACTION.DEVICE_DENSITY) {
            return;
        }
        return new DeviceDensity(ws);
    }

    constructor(protected ws: WS) {
        super(ws);
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (error: any) {
            console.error(`[${DeviceDensity.TAG}]`, error?.message);
            this.sendError('Invalid JSON format');
            return;
        }
        this.handleMessage(data as Message).catch((error: Error) => {
            console.error(`[${DeviceDensity.TAG}]`, error.message);
            this.sendError(error.message);
        });
    }

    private async handleMessage(message: Message): Promise<void> {
        if (message.type !== DeviceDensity.EVENT_TYPE) {
            return;
        }

        const request: DensityRequest = message.data as DensityRequest;
        const { type, serial, density } = request;

        try {
            switch (type) {
                case 'get':
                    await this.handleGetDensity(serial!);
                    break;
                case 'set':
                    await this.handleSetDensity(serial!, density!);
                    break;
                case 'reset':
                    await this.handleResetDensity(serial!);
                    break;
                case 'set_all':
                    await this.handleSetAllDensity(density!);
                    break;
                default:
                    this.sendError(`Unknown request type: ${type}`);
            }
        } catch (error: any) {
            this.sendError(error.message);
        }
    }

    private async handleGetDensity(serial: string): Promise<void> {
        try {
            const densityInfo = await AdbUtils.getDeviceDensity(serial);
            this.sendResponse({
                success: true,
                data: densityInfo,
            });
        } catch (error: any) {
            this.sendError(`Failed to get density: ${error.message}`);
        }
    }

    private async handleSetDensity(serial: string, density: number): Promise<void> {
        const result = await AdbUtils.setDeviceDensity(serial, density);
        this.sendResponse(result);
    }

    private async handleResetDensity(serial: string): Promise<void> {
        const result = await AdbUtils.resetDeviceDensity(serial);
        this.sendResponse(result);
    }

    private async handleSetAllDensity(density: number): Promise<void> {
        try {
            const client = AdbExtended.createClient();
            const devices = await client.listDevices();

            // If density is 0, reset all devices instead
            if (density === 0) {
                const results = await Promise.all(
                    devices.map(async (device) => {
                        const result = await AdbUtils.resetDeviceDensity(device.id);
                        return {
                            serial: device.id,
                            ...result,
                        };
                    })
                );

                const allSuccess = results.every(r => r.success);
                const successCount = results.filter(r => r.success).length;

                this.sendResponse({
                    success: allSuccess,
                    message: `Reset density to default for ${successCount}/${results.length} devices`,
                    data: results,
                });
                return;
            }

            const results = await Promise.all(
                devices.map(async (device) => {
                    const result = await AdbUtils.setDeviceDensity(device.id, density);
                    return {
                        serial: device.id,
                        ...result,
                    };
                })
            );

            const allSuccess = results.every(r => r.success);
            const successCount = results.filter(r => r.success).length;

            this.sendResponse({
                success: allSuccess,
                message: `Set density to ${density} for ${successCount}/${results.length} devices`,
                data: results,
            });
        } catch (error: any) {
            this.sendError(`Failed to set density for all devices: ${error.message}`);
        }
    }

    private sendResponse(response: DensityResponse): void {
        this.ws.send(
            JSON.stringify({
                type: DeviceDensity.EVENT_TYPE,
                data: response,
            })
        );
    }

    private sendError(message: string): void {
        this.sendResponse({
            success: false,
            message,
        });
    }

    public release(): void {
        super.release();
    }
}
