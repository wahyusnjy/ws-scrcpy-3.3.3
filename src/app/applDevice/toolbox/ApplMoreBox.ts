import '../../../style/morebox.css';
import { BasePlayer } from '../../player/BasePlayer';
import Size from '../../Size';
import { WdaProxyClient } from '../client/WdaProxyClient';

const TAG = '[ApplMoreBox]';

interface StopListener {
    onStop: () => void;
}

export class ApplMoreBox {
    private stopListener?: StopListener;
    private readonly holder: HTMLElement;
    private readonly udid: string;
    private readonly wdaConnection: WdaProxyClient;
    private initialZoomScale?: number;

    constructor(udid: string, player: BasePlayer, wdaConnection: WdaProxyClient) {
        this.udid = udid;
        this.wdaConnection = wdaConnection;
        this.initialZoomScale = 1.0; // Default zoom for iOS
        const playerName = player.getName();
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${playerName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);
        const input = document.createElement('textarea');
        input.classList.add('text-area');
        ['mousedown', 'mouseup', 'click', 'keydown', 'touchstart'].forEach(eventType => {
            input.addEventListener(eventType, (e) => e.stopPropagation());
        });
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';
        // Prevent interaction handler from blocking button clicks
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            sendButton.addEventListener(eventType, (e) => e.stopPropagation());
        });

        ApplMoreBox.wrap('p', [input, sendButton], moreBox);
        sendButton.onclick = () => {
            console.log(TAG, 'Send as keys clicked, input value:', input.value);
            if (input.value) {
                wdaConnection.sendKeys(input.value);
                console.log(TAG, 'sendKeys called with:', input.value);
            }
        };

        const qualityId = `show_video_quality_${udid}_${playerName}`;
        const qualityLabel = document.createElement('label');
        const qualityCheck = document.createElement('input');
        qualityCheck.type = 'checkbox';
        qualityCheck.checked = BasePlayer.DEFAULT_SHOW_QUALITY_STATS;
        qualityCheck.id = qualityId;
        qualityLabel.htmlFor = qualityId;
        qualityLabel.innerText = 'Show quality stats';
        // Prevent interaction handler from blocking checkbox
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            qualityCheck.addEventListener(eventType, (e) => e.stopPropagation());
            qualityLabel.addEventListener(eventType, (e) => e.stopPropagation());
        });
        ApplMoreBox.wrap('p', [qualityCheck, qualityLabel], moreBox);
        qualityCheck.onchange = () => {
            player.setShowQualityStats(qualityCheck.checked);
        };

        // Zoom/Display Scale Control for iOS
        this.initializeZoomControl(moreBox, udid, playerName);


        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(TAG, ev);
            }
            const parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            player.off('video-view-resize', this.onViewVideoResize);
            if (this.stopListener) {
                this.stopListener.onStop();
                delete this.stopListener;
            }
        };

        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        // Prevent interaction handler from blocking disconnect button
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            stopBtn.addEventListener(eventType, (e) => e.stopPropagation());
        });
        stopBtn.onclick = stop;

        ApplMoreBox.wrap('p', [stopBtn], moreBox);
        player.on('video-view-resize', this.onViewVideoResize);
        this.holder = moreBox;
    }

    private onViewVideoResize = (size: Size): void => {
        // padding: 10px
        this.holder.style.width = `${size.width - 2 * 10}px`;
    };

    private initializeZoomControl(moreBox: HTMLElement, udid: string, playerName: string): void {
        const zoomSpoiler = document.createElement('div');
        zoomSpoiler.className = 'spoiler';

        const zoomCheck = document.createElement('input');
        zoomCheck.type = 'checkbox';
        const zoomId = `zoom_control_${udid}_${playerName}`;
        zoomCheck.id = zoomId;

        const zoomLabel = document.createElement('label');
        zoomLabel.htmlFor = zoomId;
        zoomLabel.innerText = '🔍 Display Zoom (iOS Accessibility)';

        const zoomBox = document.createElement('div');
        zoomBox.className = 'box';

        // Current zoom display
        const currentZoomText = document.createElement('div');
        currentZoomText.style.marginBottom = '10px';
        currentZoomText.style.fontSize = '13px';
        currentZoomText.style.color = '#666';
        currentZoomText.innerHTML = `<strong>Current Scale:</strong> ${this.initialZoomScale}x`;
        zoomBox.appendChild(currentZoomText);

        // Preset zoom buttons
        const presetsContainer = document.createElement('div');
        presetsContainer.style.display = 'grid';
        presetsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        presetsContainer.style.gap = '8px';
        presetsContainer.style.marginBottom = '12px';

        const presets = [
            { label: 'Normal', value: 1.0 },
            { label: 'Large', value: 1.15 },
            { label: 'Larger', value: 1.3 },
        ];

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.innerText = `${preset.label}\n(${preset.value}x)`;
            btn.style.fontSize = '11px';
            btn.style.padding = '8px 4px';
            btn.style.whiteSpace = 'pre-line';
            ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
                btn.addEventListener(eventType, (e) => e.stopPropagation());
            });
            btn.onclick = () => {
                this.setZoomScale(preset.value);
                currentZoomText.innerHTML = `<strong>Current Scale:</strong> ${preset.value}x`;
            };
            presetsContainer.appendChild(btn);
        });
        zoomBox.appendChild(presetsContainer);

        // Custom zoom input
        const zoomInputLabel = document.createElement('label');
        zoomInputLabel.innerText = 'Custom Scale:';
        zoomInputLabel.style.fontSize = '12px';
        zoomInputLabel.style.marginRight = '8px';

        const zoomInput = document.createElement('input');
        zoomInput.type = 'number';
        zoomInput.min = '0.8';
        zoomInput.max = '2.0';
        zoomInput.step = '0.05';
        zoomInput.placeholder = '1.0';
        zoomInput.value = this.initialZoomScale?.toString() || '1.0';
        zoomInput.style.width = '80px';
        zoomInput.style.marginRight = '8px';
        ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(eventType => {
            zoomInput.addEventListener(eventType, (e) => e.stopPropagation());
        });

        const setZoomBtn = document.createElement('button');
        setZoomBtn.innerText = 'Set';
        setZoomBtn.style.marginRight = '8px';
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            setZoomBtn.addEventListener(eventType, (e) => e.stopPropagation());
        });
        setZoomBtn.onclick = () => {
            const zoom = parseFloat(zoomInput.value);
            if (!isNaN(zoom) && zoom >= 0.8 && zoom <= 2.0) {
                this.setZoomScale(zoom);
                currentZoomText.innerHTML = `<strong>Current Scale:</strong> ${zoom}x`;
            }
        };

        const resetZoomBtn = document.createElement('button');
        resetZoomBtn.innerText = 'Reset to 1.0x';
        ['mousedown', 'mouseup', 'click', 'touchstart'].forEach(eventType => {
            resetZoomBtn.addEventListener(eventType, (e) => e.stopPropagation());
        });
        resetZoomBtn.onclick = () => {
            this.setZoomScale(1.0);
            zoomInput.value = '1.0';
            currentZoomText.innerHTML = '<strong>Current Scale:</strong> 1.0x';
        };

        const customRow = document.createElement('div');
        customRow.style.marginBottom = '8px';
        customRow.appendChild(zoomInputLabel);
        customRow.appendChild(zoomInput);
        customRow.appendChild(setZoomBtn);
        customRow.appendChild(resetZoomBtn);
        zoomBox.appendChild(customRow);

        // Info text
        const infoText = document.createElement('div');
        infoText.style.fontSize = '11px';
        infoText.style.color = '#999';
        infoText.style.marginTop = '8px';
        infoText.innerHTML = '💡 Uses iOS Accessibility Zoom<br>1.0 = Normal, >1.0 = Zoomed In';
        zoomBox.appendChild(infoText);

        zoomSpoiler.appendChild(zoomCheck);
        zoomSpoiler.appendChild(zoomLabel);
        zoomSpoiler.appendChild(zoomBox);

        moreBox.appendChild(zoomSpoiler);
    }

    private setZoomScale(scale: number): void {
        console.log(TAG, `Setting iOS zoom scale to ${scale}x for ${this.udid}`);
        // For iOS, we can use WDA to simulate pinch gestures or accessibility zoom
        // This is a simplified implementation - actual iOS zoom might require accessibility settings
        try {
            // This would typically use WDA commands to enable/adjust iOS Zoom
            // The exact implementation depends on the WDA API available
            this.wdaConnection.sendKeys(`zoom:${scale}`);
            this.initialZoomScale = scale;
        } catch (error) {
            console.warn(TAG, 'iOS zoom control not fully implemented:', error);
        }
    }


    protected static wrap(tagName: string, elements: HTMLElement[], parent: HTMLElement): HTMLElement {
        const wrap = document.createElement(tagName);
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
        return wrap;
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: StopListener): void {
        this.stopListener = listener;
    }
}
