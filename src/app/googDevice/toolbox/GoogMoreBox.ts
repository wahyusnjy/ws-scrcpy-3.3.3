import '../../../style/morebox.css';
import { BasePlayer } from '../../player/BasePlayer';
import { TextControlMessage } from '../../controlMessage/TextControlMessage';
import { CommandControlMessage } from '../../controlMessage/CommandControlMessage';
import { ControlMessage } from '../../controlMessage/ControlMessage';
import Size from '../../Size';
import DeviceMessage from '../DeviceMessage';
import VideoSettings from '../../VideoSettings';
import { StreamClientScrcpy } from '../client/StreamClientScrcpy';

const TAG = '[GoogMoreBox]';

export class GoogMoreBox {
    private static defaultSize = new Size(480, 480);
    private onStop?: () => void;
    private readonly holder: HTMLElement;
    private readonly input: HTMLTextAreaElement;
    private readonly bitrateInput?: HTMLInputElement;
    private readonly maxFpsInput?: HTMLInputElement;
    private readonly iFrameIntervalInput?: HTMLInputElement;
    private readonly maxWidthInput?: HTMLInputElement;
    private readonly maxHeightInput?: HTMLInputElement;
    private readonly densityInput?: HTMLInputElement;
    private initialDensity?: number;
    private readonly udid: string;

    constructor(udid: string, private player: BasePlayer, private client: StreamClientScrcpy) {
        this.udid = udid;
        const playerName = player.getName();
        const videoSettings = player.getVideoSettings();
        const { displayId } = videoSettings;
        const preferredSettings = player.getPreferredVideoSetting();
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${playerName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);
        const input = (this.input = document.createElement('textarea'));
        input.classList.add('text-area');
        // Prevent interaction handler from blocking textarea input
        ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
            input.addEventListener(eventType, (e) => e.stopPropagation());
        });

        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';
        // Prevent interaction handler from blocking button clicks
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            sendButton.addEventListener(eventType, (e) => e.stopPropagation());
        });

        const inputWrapper = GoogMoreBox.wrap('p', [input, sendButton], moreBox);
        sendButton.onclick = async () => {
            console.log(TAG, 'Send as keys clicked, input value:', input.value);
            const text = input.value;
            if (text) {
                try {
                    await this.sendTextAsKeystrokes(text, client);
                    console.log(TAG, `Successfully sent ${text.length} characters as keystrokes`);
                    // Clear textarea after sending
                    input.value = '';
                } catch (error: any) {
                    console.error(TAG, 'Failed to send keystrokes:', error.message);
                }
            }
        };

        const commands: HTMLElement[] = [];
        const codes = CommandControlMessage.Commands;
        for (const [action, command] of codes.entries()) {
            const btn = document.createElement('button');
            let bitrateInput: HTMLInputElement;
            let maxFpsInput: HTMLInputElement;
            let iFrameIntervalInput: HTMLInputElement;
            let maxWidthInput: HTMLInputElement;
            let maxHeightInput: HTMLInputElement;
            if (action === ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS) {
                const spoiler = document.createElement('div');
                const spoilerLabel = document.createElement('label');
                const spoilerCheck = document.createElement('input');

                const innerDiv = document.createElement('div');
                const id = `spoiler_video_${udid}_${playerName}_${displayId}_${action}`;

                spoiler.className = 'spoiler';
                spoilerCheck.type = 'checkbox';
                spoilerCheck.id = id;
                spoilerLabel.htmlFor = id;
                spoilerLabel.innerText = command;
                innerDiv.className = 'box';
                spoiler.appendChild(spoilerCheck);
                spoiler.appendChild(spoilerLabel);
                spoiler.appendChild(innerDiv);

                const bitrateLabel = document.createElement('label');
                bitrateLabel.innerText = 'Bitrate:';
                bitrateInput = document.createElement('input');
                bitrateInput.placeholder = `${preferredSettings.bitrate} bps`;
                bitrateInput.value = videoSettings.bitrate.toString();
                ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
                    bitrateInput.addEventListener(eventType, (e) => e.stopPropagation());
                });
                GoogMoreBox.wrap('div', [bitrateLabel, bitrateInput], innerDiv);
                this.bitrateInput = bitrateInput;

                const maxFpsLabel = document.createElement('label');
                maxFpsLabel.innerText = 'Max fps:';
                maxFpsInput = document.createElement('input');
                maxFpsInput.placeholder = `${preferredSettings.maxFps} fps`;
                maxFpsInput.value = videoSettings.maxFps.toString();
                ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
                    maxFpsInput.addEventListener(eventType, (e) => e.stopPropagation());
                });
                GoogMoreBox.wrap('div', [maxFpsLabel, maxFpsInput], innerDiv);
                this.maxFpsInput = maxFpsInput;

                const iFrameIntervalLabel = document.createElement('label');
                iFrameIntervalLabel.innerText = 'I-Frame Interval:';
                iFrameIntervalInput = document.createElement('input');
                iFrameIntervalInput.placeholder = `${preferredSettings.iFrameInterval} seconds`;
                iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
                ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
                    iFrameIntervalInput.addEventListener(eventType, (e) => e.stopPropagation());
                });
                GoogMoreBox.wrap('div', [iFrameIntervalLabel, iFrameIntervalInput], innerDiv);
                this.iFrameIntervalInput = iFrameIntervalInput;

                const { width, height } = videoSettings.bounds || client.getMaxSize() || GoogMoreBox.defaultSize;
                const pWidth = preferredSettings.bounds?.width || width;
                const pHeight = preferredSettings.bounds?.height || height;

                const maxWidthLabel = document.createElement('label');
                maxWidthLabel.innerText = 'Max width:';
                maxWidthInput = document.createElement('input');
                maxWidthInput.placeholder = `${pWidth} px`;
                maxWidthInput.value = width.toString();
                ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
                    maxWidthInput.addEventListener(eventType, (e) => e.stopPropagation());
                });
                GoogMoreBox.wrap('div', [maxWidthLabel, maxWidthInput], innerDiv);
                this.maxWidthInput = maxWidthInput;

                const maxHeightLabel = document.createElement('label');
                maxHeightLabel.innerText = 'Max height:';
                maxHeightInput = document.createElement('input');
                maxHeightInput.placeholder = `${pHeight} px`;
                maxHeightInput.value = height.toString();
                ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
                    maxHeightInput.addEventListener(eventType, (e) => e.stopPropagation());
                });
                GoogMoreBox.wrap('div', [maxHeightLabel, maxHeightInput], innerDiv);
                this.maxHeightInput = maxHeightInput;

                innerDiv.appendChild(btn);
                const fitButton = document.createElement('button');
                fitButton.innerText = 'Fit';
                ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
                    fitButton.addEventListener(eventType, (e) => e.stopPropagation());
                });
                fitButton.onclick = this.fit;
                innerDiv.insertBefore(fitButton, innerDiv.firstChild);
                const resetButton = document.createElement('button');
                resetButton.innerText = 'Reset';
                ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
                    resetButton.addEventListener(eventType, (e) => e.stopPropagation());
                });
                resetButton.onclick = this.reset;
                innerDiv.insertBefore(resetButton, innerDiv.firstChild);
                commands.push(spoiler);
            } else {
                if (
                    action === CommandControlMessage.TYPE_SET_CLIPBOARD ||
                    action === CommandControlMessage.TYPE_GET_CLIPBOARD
                ) {
                    inputWrapper.appendChild(btn);
                } else {
                    commands.push(btn);
                }
            }
            btn.innerText = command;
            // Prevent interaction handler from blocking all button clicks
            ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
                btn.addEventListener(eventType, (e) => e.stopPropagation());
            });

            if (action === ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS) {
                btn.onclick = () => {
                    const bitrate = parseInt(bitrateInput.value, 10);
                    const maxFps = parseInt(maxFpsInput.value, 10);
                    const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
                    if (isNaN(bitrate) || isNaN(maxFps)) {
                        return;
                    }
                    const width = parseInt(maxWidthInput.value, 10) & ~15;
                    const height = parseInt(maxHeightInput.value, 10) & ~15;
                    const bounds = new Size(width, height);
                    const current = player.getVideoSettings();
                    const { lockedVideoOrientation, sendFrameMeta, displayId, codecOptions, encoderName } = current;
                    const videoSettings = new VideoSettings({
                        bounds,
                        bitrate,
                        maxFps,
                        iFrameInterval,
                        lockedVideoOrientation,
                        sendFrameMeta,
                        displayId,
                        codecOptions,
                        encoderName,
                    });
                    client.sendNewVideoSetting(videoSettings);
                };
            } else if (action === CommandControlMessage.TYPE_SET_CLIPBOARD) {
                btn.onclick = () => {
                    const text = input.value;
                    console.log(TAG, 'Set Clipboard clicked, text:', text);
                    if (text) {
                        client.sendMessage(CommandControlMessage.createSetClipboardCommand(text));
                        console.log(TAG, 'Set clipboard command sent');
                    }
                };
            } else if (action === CommandControlMessage.TYPE_GET_CLIPBOARD) {
                btn.onclick = () => {
                    console.log(TAG, 'Get Clipboard clicked');
                    client.sendMessage(new CommandControlMessage(action));
                    console.log(TAG, 'Get clipboard command sent');
                };
            } else {
                btn.onclick = () => {
                    client.sendMessage(new CommandControlMessage(action));
                };
            }
        }
        GoogMoreBox.wrap('p', commands, moreBox);

        const screenPowerModeId = `screen_power_mode_${udid}_${playerName}_${displayId}`;
        const screenPowerModeLabel = document.createElement('label');
        screenPowerModeLabel.style.display = 'none';
        const labelTextPrefix = 'Mode';
        const buttonTextPrefix = 'Set screen power mode';
        const screenPowerModeCheck = document.createElement('input');
        screenPowerModeCheck.type = 'checkbox';
        let mode = (screenPowerModeCheck.checked = false) ? 'ON' : 'OFF';
        screenPowerModeCheck.id = screenPowerModeLabel.htmlFor = screenPowerModeId;
        screenPowerModeLabel.innerText = `${labelTextPrefix} ${mode}`;
        screenPowerModeCheck.onchange = () => {
            mode = screenPowerModeCheck.checked ? 'ON' : 'OFF';
            screenPowerModeLabel.innerText = `${labelTextPrefix} ${mode}`;
            sendScreenPowerModeButton.innerText = `${buttonTextPrefix} ${mode}`;
        };
        const sendScreenPowerModeButton = document.createElement('button');
        sendScreenPowerModeButton.innerText = `${buttonTextPrefix} ${mode}`;
        sendScreenPowerModeButton.onclick = () => {
            const message = CommandControlMessage.createSetScreenPowerModeCommand(screenPowerModeCheck.checked);
            client.sendMessage(message);
        };
        GoogMoreBox.wrap('p', [screenPowerModeCheck, screenPowerModeLabel, sendScreenPowerModeButton], moreBox, [
            'flex-center',
        ]);

        const qualityId = `show_video_quality_${udid}_${playerName}_${displayId}`;
        const qualityLabel = document.createElement('label');
        const qualityCheck = document.createElement('input');
        qualityCheck.type = 'checkbox';
        qualityCheck.checked = BasePlayer.DEFAULT_SHOW_QUALITY_STATS;
        qualityCheck.id = qualityId;
        qualityLabel.htmlFor = qualityId;
        qualityLabel.innerText = 'Show quality stats';
        GoogMoreBox.wrap('p', [qualityCheck, qualityLabel], moreBox, ['flex-center']);
        qualityCheck.onchange = () => {
            player.setShowQualityStats(qualityCheck.checked);
        };

        // Density Control Section
        this.initializeDensityControl(moreBox, udid, playerName, displayId);


        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(TAG, ev);
            }
            const parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            player.off('video-view-resize', this.onViewVideoResize);
            if (this.onStop) {
                this.onStop();
                delete this.onStop;
            }
        };

        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        stopBtn.onclick = stop;

        GoogMoreBox.wrap('p', [stopBtn], moreBox);
        player.on('video-view-resize', this.onViewVideoResize);
        player.on('video-settings', this.onVideoSettings);
        this.holder = moreBox;
    }

    private onViewVideoResize = (size: Size): void => {
        // padding: 10px
        this.holder.style.width = `${size.width - 2 * 10}px`;
    };

    /**
     * Send text as individual keystrokes using UHID keyboard
     * Maps each character to HID Usage ID and sends with proper modifiers
     */
    private async sendTextAsKeystrokes(text: string, client: StreamClientScrcpy): Promise<void> {
        // HID Keyboard mapping (USB HID Usage IDs)
        const HID_KEYBOARD_MAP: { [key: string]: number } = {
            // Letters (a-z) = 0x04-0x1D
            'a': 0x04, 'b': 0x05, 'c': 0x06, 'd': 0x07, 'e': 0x08,
            'f': 0x09, 'g': 0x0a, 'h': 0x0b, 'i': 0x0c, 'j': 0x0d,
            'k': 0x0e, 'l': 0x0f, 'm': 0x10, 'n': 0x11, 'o': 0x12,
            'p': 0x13, 'q': 0x14, 'r': 0x15, 's': 0x16, 't': 0x17,
            'u': 0x18, 'v': 0x19, 'w': 0x1a, 'x': 0x1b, 'y': 0x1c,
            'z': 0x1d,

            // Numbers (1-9, 0) = 0x1E-0x27
            '1': 0x1e, '2': 0x1f, '3': 0x20, '4': 0x21, '5': 0x22,
            '6': 0x23, '7': 0x24, '8': 0x25, '9': 0x26, '0': 0x27,

            // Special characters
            '\n': 0x28,  // Enter
            ' ': 0x2c,   // Space
            '-': 0x2d,   // Minus/Underscore
            '=': 0x2e,   // Equal/Plus
            '[': 0x2f,   // Left bracket
            ']': 0x30,   // Right bracket
            '\\': 0x31,  // Backslash
            ';': 0x33,   // Semicolon/Colon
            '\'': 0x34,  // Apostrophe/Quote
            '`': 0x35,   // Grave accent/Tilde
            ',': 0x36,   // Comma/Less than
            '.': 0x37,   // Period/Greater than
            '/': 0x38,   // Slash/Question mark
        };

        // Characters that require Shift modifier (HID modifier bit 0x02 = left shift)
        const SHIFT_MAP: { [key: string]: string } = {
            'A': 'a', 'B': 'b', 'C': 'c', 'D': 'd', 'E': 'e',
            'F': 'f', 'G': 'g', 'H': 'h', 'I': 'i', 'J': 'j',
            'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'O': 'o',
            'P': 'p', 'Q': 'q', 'R': 'r', 'S': 's', 'T': 't',
            'U': 'u', 'V': 'v', 'W': 'w', 'X': 'x', 'Y': 'y',
            'Z': 'z',
            '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
            '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
            '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
            ':': ';', '"': '\'', '~': '`', '<': ',', '>': '.', '?': '/'
        };

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        console.log(TAG, 'Send as keys clicked, input value:', text);
        console.log(client);
        let sentCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            let modifier = 0;
            let keycode = 0;

            // Check if character requires shift
            if (SHIFT_MAP[char]) {
                modifier = 0x02; // Left Shift
                const baseChar = SHIFT_MAP[char];
                keycode = HID_KEYBOARD_MAP[baseChar] || 0;
            } else {
                keycode = HID_KEYBOARD_MAP[char] || 0;
            }

            if (keycode === 0 && char !== '\n' && char !== ' ') {
                skippedCount++;
                console.warn(TAG, `Skipped unsupported character: "${char}" (code: ${char.charCodeAt(0)})`);
                continue;
            }

            // Import KeyCodeControlMessage dynamically to avoid circular dependencies
            const { KeyCodeControlMessage } = await import('../../controlMessage/KeyCodeControlMessage');

            // Send key press (action = 0)
            const pressMessage = new KeyCodeControlMessage(0, keycode, 0, modifier);
            client.sendMessage(pressMessage);
            sentCount++;

            // Small delay between press and release
            await sleep(10);

            // Send key release (action = 1)
            const releaseMessage = new KeyCodeControlMessage(1, 0, 0, 0);
            client.sendMessage(releaseMessage);

            // Small delay before next character
            await sleep(20);
        }

        console.log(TAG, `Sent ${sentCount} keystrokes, skipped ${skippedCount} unsupported characters`);
    }

    private onVideoSettings = (videoSettings: VideoSettings): void => {
        if (this.bitrateInput) {
            this.bitrateInput.value = videoSettings.bitrate.toString();
        }
        if (this.maxFpsInput) {
            this.maxFpsInput.value = videoSettings.maxFps.toString();
        }
        if (this.iFrameIntervalInput) {
            this.iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
        }
        if (videoSettings.bounds) {
            const { width, height } = videoSettings.bounds;
            if (this.maxWidthInput) {
                this.maxWidthInput.value = width.toString();
            }
            if (this.maxHeightInput) {
                this.maxHeightInput.value = height.toString();
            }
        }
    };

    private fit = (): void => {
        const { width, height } = this.client.getMaxSize() || GoogMoreBox.defaultSize;
        if (this.maxWidthInput) {
            this.maxWidthInput.value = width.toString();
        }
        if (this.maxHeightInput) {
            this.maxHeightInput.value = height.toString();
        }
    };

    private reset = (): void => {
        const preferredSettings = this.player.getPreferredVideoSetting();
        this.onVideoSettings(preferredSettings);
    };

    private async initializeDensityControl(moreBox: HTMLElement, udid: string, playerName: string, displayId: number): Promise<void> {
        // Get initial density
        try {
            const density = await this.getCurrentDensity();
            this.initialDensity = density.override || density.physical;
        } catch (error) {
            console.warn(TAG, 'Failed to get initial density:', error);
            this.initialDensity = 320; // Default fallback
        }

        const densitySpoiler = document.createElement('div');
        densitySpoiler.className = 'spoiler';

        const densityCheck = document.createElement('input');
        densityCheck.type = 'checkbox';
        const densityId = `density_control_${udid}_${playerName}_${displayId}`;
        densityCheck.id = densityId;

        const densityLabel = document.createElement('label');
        densityLabel.htmlFor = densityId;
        densityLabel.innerText = '📱 Display Density (DPI/Zoom)';

        const densityBox = document.createElement('div');
        densityBox.className = 'box';

        // Current density display
        const currentDensityText = document.createElement('div');
        currentDensityText.style.marginBottom = '10px';
        currentDensityText.style.fontSize = '13px';
        currentDensityText.style.color = '#666';
        currentDensityText.innerHTML = `<strong>Initial:</strong> ${this.initialDensity} DPI`;
        densityBox.appendChild(currentDensityText);

        // Preset buttons
        const presetsContainer = document.createElement('div');
        presetsContainer.style.display = 'grid';
        presetsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        presetsContainer.style.gap = '8px';
        presetsContainer.style.marginBottom = '12px';

        const presets = [
            { label: 'HDPI', value: 240 },
            { label: 'XHDPI', value: 320 },
            { label: 'XXHDPI', value: 480 },
        ];

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.innerText = `${preset.label}\n(${preset.value})`;
            btn.style.fontSize = '11px';
            btn.style.padding = '8px 4px';
            btn.style.whiteSpace = 'pre-line';
            ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
                btn.addEventListener(eventType, (e) => e.stopPropagation());
            });
            btn.onclick = async () => {
                await this.setDensity(preset.value);
                if (this.densityInput) {
                    this.densityInput.value = preset.value.toString();
                }
            };
            presetsContainer.appendChild(btn);
        });
        densityBox.appendChild(presetsContainer);

        // Custom density input
        const densityInputLabel = document.createElement('label');
        densityInputLabel.innerText = 'Custom DPI:';
        densityInputLabel.style.fontSize = '12px';
        densityInputLabel.style.marginRight = '8px';

        const densityInput = document.createElement('input');
        densityInput.type = 'number';
        densityInput.min = '120';
        densityInput.max = '640';
        densityInput.placeholder = '320';
        densityInput.value = this.initialDensity?.toString() || '320';
        densityInput.style.width = '80px';
        densityInput.style.marginRight = '8px';
        ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
            densityInput.addEventListener(eventType, (e) => e.stopPropagation());
        });
        (this as any).densityInput = densityInput;

        const setDensityBtn = document.createElement('button');
        setDensityBtn.innerText = 'Set';
        setDensityBtn.style.marginRight = '8px';
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            setDensityBtn.addEventListener(eventType, (e) => e.stopPropagation());
        });
        setDensityBtn.onclick = async () => {
            const density = parseInt(densityInput.value, 10);
            if (!isNaN(density) && density >= 120 && density <= 640) {
                await this.setDensity(density);
            }
        };

        const resetDensityBtn = document.createElement('button');
        resetDensityBtn.innerText = 'Reset to Initial';
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            resetDensityBtn.addEventListener(eventType, (e) => e.stopPropagation());
        });
        resetDensityBtn.onclick = async () => {
            if (this.initialDensity) {
                await this.setDensity(this.initialDensity);
                densityInput.value = this.initialDensity.toString();
            }
        };

        const customRow = document.createElement('div');
        customRow.style.marginBottom = '8px';
        customRow.appendChild(densityInputLabel);
        customRow.appendChild(densityInput);
        customRow.appendChild(setDensityBtn);
        customRow.appendChild(resetDensityBtn);
        densityBox.appendChild(customRow);

        // Info text
        const infoText = document.createElement('div');
        infoText.style.fontSize = '11px';
        infoText.style.color = '#999';
        infoText.style.marginTop = '8px';
        infoText.innerHTML = '💡 Lower DPI = Larger UI (zoomed in)<br>Higher DPI = Smaller UI (zoomed out)';
        densityBox.appendChild(infoText);

        densitySpoiler.appendChild(densityCheck);
        densitySpoiler.appendChild(densityLabel);
        densitySpoiler.appendChild(densityBox);

        moreBox.appendChild(densitySpoiler);
    }

    private async getCurrentDensity(): Promise<{ physical: number; override?: number }> {
        // Since we're in browser context, we can't call ADB directly
        // Return a default value - the actual density will be fetched when needed
        return {
            physical: 320,
            override: undefined,
        };
    }

    private async setDensity(density: number): Promise<void> {
        try {
            console.log(TAG, `Setting density to ${density} for ${this.udid}`);

            // Create WebSocket connection to DeviceDensity service
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${location.host}/?action=device-density`;

            const ws = new WebSocket(wsUrl);

            return new Promise((resolve, reject) => {
                ws.onopen = () => {
                    console.log(TAG, 'Connected to density service');

                    // Send density change request
                    const message = {
                        type: 'device-density',
                        data: {
                            type: 'set',
                            serial: this.udid,
                            density: density,
                        },
                    };

                    ws.send(JSON.stringify(message));
                };

                ws.onmessage = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        console.log(TAG, 'Density response:', response);

                        if (response.type === 'device-density' && response.data) {
                            if (response.data.success) {
                                console.log(TAG, response.data.message || 'Density updated successfully');
                                alert(`✓ Density set to ${density} DPI\n\n${response.data.message || 'Success!'}`);
                                resolve();
                            } else {
                                console.error(TAG, 'Failed:', response.data.message);
                                alert(`✗ Failed to set density:\n${response.data.message}`);
                                reject(new Error(response.data.message));
                            }
                            ws.close();
                        }
                    } catch (error) {
                        console.error(TAG, 'Failed to parse response:', error);
                        reject(error);
                        ws.close();
                    }
                };

                ws.onerror = (error) => {
                    console.error(TAG, 'WebSocket error:', error);
                    alert('Failed to connect to density service');
                    reject(error);
                };

                ws.onclose = () => {
                    console.log(TAG, 'Density service connection closed');
                };

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                        ws.close();
                        reject(new Error('Density change timeout'));
                    }
                }, 10000);
            });

        } catch (error) {
            console.error(TAG, 'Failed to set density:', error);
            alert(`Failed to set density: ${error}`);
            throw error;
        }
    }



    public OnDeviceMessage(ev: DeviceMessage): void {
        if (ev.type !== DeviceMessage.TYPE_CLIPBOARD) {
            return;
        }
        this.input.value = ev.getText();
        this.input.select();
        document.execCommand('copy');
    }

    private static wrap(
        tagName: string,
        elements: HTMLElement[],
        parent: HTMLElement,
        opt_classes?: string[],
    ): HTMLElement {
        const wrap = document.createElement(tagName);
        if (opt_classes) {
            wrap.classList.add(...opt_classes);
        }
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
        return wrap;
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: () => void): void {
        this.onStop = listener;
    }
}
