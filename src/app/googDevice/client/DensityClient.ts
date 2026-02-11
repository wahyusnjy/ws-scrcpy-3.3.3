import { ManagerClient } from '../../client/ManagerClient';
import { ACTION } from '../../../common/Action';
import { ParamsBase } from '../../../types/ParamsBase';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';

const TAG = '[DensityClient]';

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

interface DensityParams extends ParamsBase {
    action: ACTION.DEVICE_DENSITY;
}

export class DensityClient extends ManagerClient<DensityParams, never> {
    public static ACTION = ACTION.DEVICE_DENSITY;
    private container?: HTMLElement;

    public static start(params?: DensityParams): DensityClient {
        const defaultParams: DensityParams = params || {
            action: ACTION.DEVICE_DENSITY,
        };
        return new DensityClient(defaultParams);
    }

    constructor(params: DensityParams) {
        super(params);
        this.openNewConnection();
        this.setTitle('Device Density Manager');
        this.setBodyClass('density-manager');
        this.buildUI();
    }

    public static parseParameters(params: URLSearchParams): DensityParams {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.DEVICE_DENSITY) {
            throw Error('Incorrect action');
        }
        return { ...typedParams, action };
    }

    protected onSocketOpen = (): void => {
        console.log(TAG, 'WebSocket connected');
    };

    protected onSocketClose(event: CloseEvent): void {
        console.log(TAG, `Connection closed: ${event.reason}`);
    }

    protected onSocketMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data.toString());
            if (message.type === 'device-density') {
                this.handleDensityResponse(message.data);
            }
        } catch (error) {
            console.error(TAG, 'Failed to parse message:', error);
        }
    }

    private handleDensityResponse(response: DensityResponse): void {
        if (response.success) {
            this.showSuccess(response.message || 'Operation successful');
            if (response.data) {
                console.log(TAG, 'Response data:', response.data);
            }
        } else {
            this.showError(response.message || 'Operation failed');
        }
    }

    private sendRequest(request: DensityRequest): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('WebSocket not connected');
            return;
        }

        const message = {
            type: 'device-density',
            data: request,
        };

        this.ws.send(JSON.stringify(message));
    }

    private buildUI(): void {
        this.container = document.createElement('div');
        this.container.className = 'density-manager-container';
        this.container.innerHTML = `
            <div class="density-controls">
                <h2>📱 Device Density Manager</h2>
                
                <div class="density-section">
                    <h3>Set Density for All Devices</h3>
                    <div class="input-group">
                        <input type="number" id="densityValue" placeholder="Enter density (e.g., 320)" 
                               value="320" min="120" max="640" step="10" />
                        <button id="setAllBtn" class="btn btn-primary">Set All Devices</button>
                    </div>
                    
                    <div class="preset-buttons">
                        <h4>Quick Presets:</h4>
                        <button class="btn btn-preset" data-density="160">LDPI (160)</button>
                        <button class="btn btn-preset" data-density="240">HDPI (240)</button>
                        <button class="btn btn-preset" data-density="320">XHDPI (320)</button>
                        <button class="btn btn-preset" data-density="480">XXHDPI (480)</button>
                        <button class="btn btn-preset" data-density="640">XXXHDPI (640)</button>
                    </div>
                </div>

                <div class="density-section">
                    <h3>Reset All Devices to Default</h3>
                    <button id="resetAllBtn" class="btn btn-danger">Reset All to Default</button>
                </div>

                <div id="status" class="status-message"></div>
            </div>

            <style>
                .density-manager-container {
                    max-width: 800px;
                    margin: 40px auto;
                    padding: 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }

                .density-controls h2 {
                    color: #fff;
                    margin: 0 0 30px 0;
                    font-size: 32px;
                    font-weight: 700;
                }

                .density-section {
                    background: rgba(255, 255, 255, 0.95);
                    padding: 25px;
                    margin-bottom: 20px;
                    border-radius: 15px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }

                .density-section h3 {
                    margin: 0 0 20px 0;
                    color: #2d3748;
                    font-size: 20px;
                    font-weight: 600;
                }

                .density-section h4 {
                    margin: 0 0 12px 0;
                    color: #4a5568;
                    font-size: 14px;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .input-group {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .input-group input {
                    flex: 1;
                    padding: 14px 18px;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 16px;
                    transition: all 0.3s ease;
                    background: #fff;
                }

                .input-group input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .btn {
                    padding: 14px 28px;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
                }

                .btn:active {
                    transform: translateY(0);
                }

                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-width: 180px;
                }

                .btn-danger {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    width: 100%;
                }

                .preset-buttons {
                    margin-top: 20px;
                }

                .preset-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .btn-preset {
                    flex: 1;
                    min-width: 120px;
                    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
                    color: #2d3748;
                    font-size: 14px;
                    padding: 12px 20px;
                }

                .status-message {
                    margin-top: 20px;
                    padding: 16px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    display: none;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .status-message.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                    display: block;
                }

                .status-message.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                    display: block;
                }

                body.density-manager {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
            </style>
        `;

        document.body.appendChild(this.container);

        // Attach event listeners
        const setAllBtn = document.getElementById('setAllBtn');
        const resetAllBtn = document.getElementById('resetAllBtn');
        const densityInput = document.getElementById('densityValue') as HTMLInputElement;
        const presetButtons = document.querySelectorAll('.btn-preset');

        if (setAllBtn) {
            setAllBtn.addEventListener('click', () => {
                const density = parseInt(densityInput.value);
                if (!density || density < 120 || density > 640) {
                    this.showError('Please enter a valid density between 120 and 640');
                    return;
                }
                this.sendRequest({
                    type: 'set_all',
                    density,
                });
            });
        }

        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset density for all devices?')) {
                    this.sendRequest({
                        type: 'set_all',
                        density: 0, // Will be handled as reset in backend
                    });
                }
            });
        }

        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const density = (e.target as HTMLElement).getAttribute('data-density');
                if (density) {
                    densityInput.value = density;
                    this.sendRequest({
                        type: 'set_all',
                        density: parseInt(density),
                    });
                }
            });
        });
    }

    private showSuccess(message: string): void {
        const status = document.getElementById('status');
        if (status) {
            status.className = 'status-message success';
            status.textContent = '✓ ' + message;
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    private showError(message: string): void {
        const status = document.getElementById('status');
        if (status) {
            status.className = 'status-message error';
            status.textContent = '✗ ' + message;
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    public static createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('density-manager', blockClass);
        entry.appendChild(
            BaseDeviceTracker.buildLink(
                {
                    action: ACTION.DEVICE_DENSITY,
                },
                'density',
                params,
            ),
        );
        return entry;
    }
}
