import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import KeyEvent from './android/KeyEvent';
import { KeyToHidMap, HidModifiers } from './KeyToHidMap';

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlMessage) => void;
}

export class KeyInputHandler {
    private static readonly repeatCounter: Map<number, number> = new Map();
    private static readonly listeners: Set<KeyEventListener> = new Set();
    private static handler = (event: Event): void => {
        const keyboardEvent = event as KeyboardEvent;
        const hidKeyCode = KeyToHidMap.get(keyboardEvent.code);
        if (!hidKeyCode) {
            return;
        }
        let action: typeof KeyEvent.ACTION_DOWN | typeof KeyEvent.ACTION_DOWN;
        let repeatCount = 0;
        if (keyboardEvent.type === 'keydown') {
            action = KeyEvent.ACTION_DOWN;
            if (keyboardEvent.repeat) {
                let count = KeyInputHandler.repeatCounter.get(hidKeyCode);
                if (typeof count !== 'number') {
                    count = 1;
                } else {
                    count++;
                }
                repeatCount = count;
                KeyInputHandler.repeatCounter.set(hidKeyCode, count);
            }
        } else if (keyboardEvent.type === 'keyup') {
            action = KeyEvent.ACTION_UP;
            KeyInputHandler.repeatCounter.delete(hidKeyCode);
        } else {
            return;
        }

        // Build HID modifier byte
        const hidModifiers =
            (keyboardEvent.getModifierState('Control') && !keyboardEvent.location ? HidModifiers.CTRL_LEFT : 0) |
            (keyboardEvent.getModifierState('Control') && keyboardEvent.location === 2 ? HidModifiers.CTRL_RIGHT : 0) |
            (keyboardEvent.getModifierState('Shift') && keyboardEvent.location !== 2 ? HidModifiers.SHIFT_LEFT : 0) |
            (keyboardEvent.getModifierState('Shift') && keyboardEvent.location === 2 ? HidModifiers.SHIFT_RIGHT : 0) |
            (keyboardEvent.getModifierState('Alt') && keyboardEvent.location !== 2 ? HidModifiers.ALT_LEFT : 0) |
            (keyboardEvent.getModifierState('Alt') && keyboardEvent.location === 2 ? HidModifiers.ALT_RIGHT : 0) |
            (keyboardEvent.getModifierState('Meta') && keyboardEvent.location !== 2 ? HidModifiers.GUI_LEFT : 0) |
            (keyboardEvent.getModifierState('Meta') && keyboardEvent.location === 2 ? HidModifiers.GUI_RIGHT : 0);

        // For UHID: keycode is HID Usage ID, metaState is HID modifier byte
        const controlMessage: KeyCodeControlMessage = new KeyCodeControlMessage(
            action,
            hidKeyCode,  // HID Usage ID (not Android keycode)
            repeatCount,
            hidModifiers, // HID modifier byte (not Android metaState)
        );
        KeyInputHandler.listeners.forEach((listener) => {
            listener.onKeyEvent(controlMessage);
        });
        event.preventDefault();
    };
    private static attachListeners(): void {
        document.body.addEventListener('keydown', this.handler);
        document.body.addEventListener('keyup', this.handler);
    }
    private static detachListeners(): void {
        document.body.removeEventListener('keydown', this.handler);
        document.body.removeEventListener('keyup', this.handler);
    }
    public static addEventListener(listener: KeyEventListener): void {
        if (!this.listeners.size) {
            this.attachListeners();
        }
        this.listeners.add(listener);
    }
    public static removeEventListener(listener: KeyEventListener): void {
        this.listeners.delete(listener);
        if (!this.listeners.size) {
            this.detachListeners();
        }
    }
}
