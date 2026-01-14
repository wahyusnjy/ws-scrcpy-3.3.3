import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import KeyEvent from './android/KeyEvent';
import { KeyToHidMap, HidModifiers } from './KeyToHidMap';

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlMessage) => void;
}

export class KeyInputHandler {
    private static readonly repeatCounter: Map<number, number> = new Map();
    private static readonly listeners: Set<KeyEventListener> = new Set();
    private static isCapturing: boolean = false;

    private static handler = (event: KeyboardEvent): void => {
        if (!KeyInputHandler.isCapturing) {
            return;
        }

        // MUST prevent default for ALL keys including Tab
        event.preventDefault();
        event.stopPropagation();

        // Log for debugging
        console.log(`[KeyInputHandler] Captured: ${event.code}, type: ${event.type}`);

        // ESC key - toggle keyboard capture off
        if (event.code === 'Escape') {
            console.log('[KeyInputHandler] ESC pressed - releasing keyboard capture');
            KeyInputHandler.stopCapture();
            return;
        }

        const hidKeyCode = KeyToHidMap.get(event.code);
        if (!hidKeyCode) {
            console.log(`[KeyInputHandler] No HID mapping for: ${event.code}`);
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

        console.log(`[KeyInputHandler] Sending: action=${action}, hidKeyCode=0x${hidKeyCode.toString(16)}`);

        KeyInputHandler.listeners.forEach((listener) => {
            listener.onKeyEvent(controlMessage);
        });

        // Return false to completely prevent browser handling
        return;
    };

    private static startCapture(): void {
        if (KeyInputHandler.isCapturing) return;

        console.log('[KeyInputHandler] Starting keyboard capture');
        KeyInputHandler.isCapturing = true;

        // Use window with capture phase to intercept BEFORE anything else
        window.addEventListener('keydown', this.handler as EventListener, true);
        window.addEventListener('keyup', this.handler as EventListener, true);

        // Also block Tab at document level
        document.addEventListener('keydown', this.blockTab, true);
    }

    private static stopCapture(): void {
        console.log('[KeyInputHandler] Stopping keyboard capture');
        KeyInputHandler.isCapturing = false;

        window.removeEventListener('keydown', this.handler as EventListener, true);
        window.removeEventListener('keyup', this.handler as EventListener, true);
        document.removeEventListener('keydown', this.blockTab, true);
    }

    // Extra blocker specifically for Tab
    private static blockTab = (event: KeyboardEvent): void => {
        if (KeyInputHandler.isCapturing && event.code === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    };

    public static addEventListener(listener: KeyEventListener): void {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.startCapture();
        }
        console.log(`[KeyInputHandler] Listener added, total: ${this.listeners.size}, capturing: ${this.isCapturing}`);
    }

    public static removeEventListener(listener: KeyEventListener): void {
        this.listeners.delete(listener);
        if (this.listeners.size === 0) {
            this.stopCapture();
        }
        console.log(`[KeyInputHandler] Listener removed, total: ${this.listeners.size}`);
    }
}
