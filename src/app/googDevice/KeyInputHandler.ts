import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import KeyEvent from './android/KeyEvent';
import { KeyToHidMap, HidModifiers } from './KeyToHidMap';

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlMessage) => void;
}

export class KeyInputHandler {
    private static readonly repeatCounter: Map<number, number> = new Map();

    // Only ONE active listener at a time (the device that has checkbox enabled)
    private static activeListener: KeyEventListener | null = null;
    private static activeUdid: string = '';
    private static isCapturing: boolean = false;

    // Invisible input field to trap keyboard events
    private static keyboardTrap: HTMLInputElement | null = null;

    // Click handler to maintain focus when capturing
    private static clickHandler = (event: MouseEvent): void => {
        if (!KeyInputHandler.isCapturing) {
            return;
        }

        // Always refocus the keyboard trap after any click
        event.preventDefault();
        event.stopPropagation();

        console.log(`[UHID Keyboard] 🖱️ Click detected - refocusing keyboard trap`);

        setTimeout(() => {
            if (KeyInputHandler.keyboardTrap) {
                KeyInputHandler.keyboardTrap.focus();
                console.log(`[UHID Keyboard] ✓ Keyboard trap refocused`);
            }
        }, 0);
    };

    private static handler = (event: KeyboardEvent): void => {
        // Debug: Log setiap keyboard event yang masuk
        console.log(`[UHID Keyboard] 🔑 Event received: ${event.code} ${event.type}, capturing: ${KeyInputHandler.isCapturing}`);

        if (!KeyInputHandler.isCapturing || !KeyInputHandler.activeListener) {
            console.log(`[UHID Keyboard] ⚠️ Skipping event - capturing: ${KeyInputHandler.isCapturing}, hasListener: ${!!KeyInputHandler.activeListener}`);
            return;
        }

        // CRITICAL: Prevent ALL event propagation IMMEDIATELY
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation(); // Stop ALL other listeners from firing

        const currentUdid = KeyInputHandler.activeUdid;
        const currentListener = KeyInputHandler.activeListener;

        // ESC key - toggle keyboard capture off
        if (event.code === 'Escape') {
            console.log(`[UHID Keyboard] ESC pressed - releasing capture for ${currentUdid}`);
            KeyInputHandler.stopCapture();
            return;
        }

        const hidKeyCode = KeyToHidMap.get(event.code);
        if (!hidKeyCode) {
            console.log(`[UHID Keyboard] ⚠️ No HID mapping for: ${event.code}`);
            return;
        }

        let action: typeof KeyEvent.ACTION_DOWN | typeof KeyEvent.ACTION_DOWN;
        let repeatCount = 0;
        if (event.type === 'keydown') {
            action = KeyEvent.ACTION_DOWN;
            if (event.repeat) {
                let count = KeyInputHandler.repeatCounter.get(hidKeyCode);
                if (typeof count !== 'number') {
                    count = 1;
                } else {
                    count++;
                }
                repeatCount = count;
                KeyInputHandler.repeatCounter.set(hidKeyCode, count);
            }
        } else if (event.type === 'keyup') {
            action = KeyEvent.ACTION_UP;
            KeyInputHandler.repeatCounter.delete(hidKeyCode);
        } else {
            return;
        }

        // Build HID modifier byte
        const hidModifiers =
            (event.getModifierState('Control') && !event.location ? HidModifiers.CTRL_LEFT : 0) |
            (event.getModifierState('Control') && event.location === 2 ? HidModifiers.CTRL_RIGHT : 0) |
            (event.getModifierState('Shift') && event.location !== 2 ? HidModifiers.SHIFT_LEFT : 0) |
            (event.getModifierState('Shift') && event.location === 2 ? HidModifiers.SHIFT_RIGHT : 0) |
            (event.getModifierState('Alt') && event.location !== 2 ? HidModifiers.ALT_LEFT : 0) |
            (event.getModifierState('Alt') && event.location === 2 ? HidModifiers.ALT_RIGHT : 0) |
            (event.getModifierState('Meta') && event.location !== 2 ? HidModifiers.GUI_LEFT : 0) |
            (event.getModifierState('Meta') && event.location === 2 ? HidModifiers.GUI_RIGHT : 0);

        const controlMessage: KeyCodeControlMessage = new KeyCodeControlMessage(
            action,
            hidKeyCode,
            repeatCount,
            hidModifiers,
        );

        // UHID Keyboard debug log
        console.log(`[UHID Keyboard] ✉️ SENDING to ${currentUdid}: ${event.code} ${event.type === 'keydown' ? 'DOWN' : 'UP'} (HID: 0x${hidKeyCode.toString(16)})`);

        currentListener.onKeyEvent(controlMessage);

        console.log(`[UHID Keyboard] ✓ Message sent successfully`);
    };

    private static attachEventListeners(): void {
        // Use { capture: true, passive: false } to ensure immediate event blocking
        const options = { capture: true, passive: false };

        // CRITICAL: Create invisible input field to trap keyboard events
        // This is the MOST RELIABLE way to capture keyboard - browser ALWAYS sends keyboard to focused input
        if (!this.keyboardTrap) {
            this.keyboardTrap = document.createElement('input');
            this.keyboardTrap.setAttribute('type', 'text');
            this.keyboardTrap.setAttribute('autocomplete', 'off');
            this.keyboardTrap.setAttribute('autocorrect', 'off');
            this.keyboardTrap.setAttribute('autocapitalize', 'off');
            this.keyboardTrap.setAttribute('spellcheck', 'false');
            this.keyboardTrap.style.position = 'fixed';
            this.keyboardTrap.style.top = '-9999px';
            this.keyboardTrap.style.left = '-9999px';
            this.keyboardTrap.style.width = '1px';
            this.keyboardTrap.style.height = '1px';
            this.keyboardTrap.style.opacity = '0';
            this.keyboardTrap.style.pointerEvents = 'none';
            document.body.appendChild(this.keyboardTrap);
            console.log(`[UHID Keyboard] 📥 Created invisible keyboard trap`);
        }

        // CRITICAL: Remove focus from any active element
        if (document.activeElement && document.activeElement !== document.body && document.activeElement !== this.keyboardTrap) {
            console.log(`[UHID Keyboard] 🎯 Removing focus from active element:`, document.activeElement);
            (document.activeElement as HTMLElement).blur();
        }

        // Attach event listeners to the keyboard trap input
        this.keyboardTrap.addEventListener('keydown', this.handler as EventListener, options);
        this.keyboardTrap.addEventListener('keyup', this.handler as EventListener, options);

        // Also attach to window/document as backup
        window.addEventListener('keydown', this.handler as EventListener, options);
        window.addEventListener('keyup', this.handler as EventListener, options);
        document.addEventListener('keydown', this.blockTab, options);
        document.addEventListener('keyup', this.blockTab, options);

        // Attach click listener to maintain focus (refocus trap after any click)
        document.addEventListener('click', this.clickHandler, true);
        document.addEventListener('mousedown', this.clickHandler, true);

        // CRITICAL: Focus the keyboard trap to receive ALL keyboard events
        this.keyboardTrap.focus();
        console.log(`[UHID Keyboard] 🎯 Focused keyboard trap, activeElement:`, document.activeElement);

        console.log(`[UHID Keyboard] 🔗 Event listeners attached with options:`, options);

        // Verify focus
        setTimeout(() => {
            if (document.activeElement === this.keyboardTrap) {
                console.log(`[UHID Keyboard] ✅ Keyboard trap is focused - ready to receive keyboard events!`);
            } else {
                console.warn(`[UHID Keyboard] ⚠️ WARNING: Keyboard trap is NOT focused! Active element:`, document.activeElement);
            }
        }, 100);

        console.log(`[UHID Keyboard] ℹ️ Handler ready. Try pressing any key now...`);
    }

    private static detachEventListeners(): void {
        // Remove keyboard trap listeners
        if (this.keyboardTrap) {
            this.keyboardTrap.removeEventListener('keydown', this.handler as EventListener, true);
            this.keyboardTrap.removeEventListener('keyup', this.handler as EventListener, true);
        }

        // Remove window/document listeners
        window.removeEventListener('keydown', this.handler as EventListener, true);
        window.removeEventListener('keyup', this.handler as EventListener, true);
        document.removeEventListener('keydown', this.blockTab, true);
        document.removeEventListener('keyup', this.blockTab, true);
        document.removeEventListener('click', this.clickHandler, true);
        document.removeEventListener('mousedown', this.clickHandler, true);

        // Remove and destroy keyboard trap
        if (this.keyboardTrap && this.keyboardTrap.parentElement) {
            this.keyboardTrap.parentElement.removeChild(this.keyboardTrap);
            this.keyboardTrap = null;
            console.log(`[UHID Keyboard] 🗑️ Removed keyboard trap`);
        }
    }

    private static stopCapture(): void {
        if (KeyInputHandler.isCapturing) {
            this.detachEventListeners();
        }
        KeyInputHandler.isCapturing = false;
        KeyInputHandler.activeListener = null;
        KeyInputHandler.activeUdid = '';
    }

    // Extra blocker specifically for Tab
    private static blockTab = (event: KeyboardEvent): void => {
        if (KeyInputHandler.isCapturing && event.code === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    };

    // Set this listener as the ONLY active one (replaces any previous)
    public static addEventListener(listener: KeyEventListener, udid: string): void {
        console.log(`[UHID Keyboard] 🎯 addEventListener called for ${udid}`);

        // If already capturing for a DIFFERENT device, stop that first
        if (KeyInputHandler.isCapturing && KeyInputHandler.activeUdid !== udid) {
            console.log(`[UHID Keyboard] ⚠️ Switching from ${KeyInputHandler.activeUdid} to ${udid}`);
            this.stopCapture();
        }

        KeyInputHandler.activeListener = listener;
        KeyInputHandler.activeUdid = udid;

        if (!KeyInputHandler.isCapturing) {
            console.log(`[UHID Keyboard] 🔧 Attaching global keyboard event listeners...`);
            this.attachEventListeners();
            KeyInputHandler.isCapturing = true;
            console.log(`[UHID Keyboard] ✅ Event listeners attached successfully`);
        }

        console.log(`[UHID Keyboard] 🎹 Capture enabled for ${udid} - All keyboard input will be sent to this device`);
        console.log(`[UHID Keyboard] ℹ️ Press ESC to disable capture, or uncheck the checkbox`);
    }

    public static removeEventListener(listener: KeyEventListener, udid: string): void {
        if (KeyInputHandler.activeUdid === udid) {
            console.log(`[UHID Keyboard] Capture disabled for ${udid}`);
            this.stopCapture();
        }
    }

    public static getActiveUdid(): string {
        return KeyInputHandler.activeUdid;
    }

    public static isDeviceActive(udid: string): boolean {
        return KeyInputHandler.activeUdid === udid && KeyInputHandler.isCapturing;
    }
}
