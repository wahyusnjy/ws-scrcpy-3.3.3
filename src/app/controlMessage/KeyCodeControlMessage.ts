import { Buffer } from 'buffer';
import { ControlMessage, ControlMessageInterface } from './ControlMessage';

export interface KeyCodeControlMessageInterface extends ControlMessageInterface {
    action: number;
    keycode: number;
    repeat: number;
    metaState: number;
}

export class KeyCodeControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 8; // 8-byte HID report for UHID keyboard

    constructor(
        readonly action: number,
        readonly keycode: number,
        readonly repeat: number,
        readonly metaState: number,
    ) {
        super(ControlMessage.TYPE_KEYCODE); // TYPE_UHID_KEYBOARD (100)
    }

    /**
     * Generate UHID keyboard HID report (9 bytes total):
     * Byte 0: Type (100)
     * Byte 1: Modifiers (HID modifier byte)
     * Byte 2: Reserved (0)
     * Byte 3: Keycode (HID Usage ID) - 0 for key release
     * Bytes 4-8: Reserved (0)
     */
    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(KeyCodeControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;

        // Type byte (100 = UHID keyboard)
        offset = buffer.writeUInt8(this.type, offset);

        // HID Report (8 bytes)
        offset = buffer.writeUInt8(this.metaState, offset); // Modifiers
        offset = buffer.writeUInt8(0, offset); // Reserved
        // For key release (action=1), send keycode=0
        const hidKeycode = this.action === 0 ? this.keycode : 0;
        offset = buffer.writeUInt8(hidKeycode, offset); // Keycode (0 = release)
        offset = buffer.writeUInt8(0, offset); // Reserved
        offset = buffer.writeUInt8(0, offset); // Reserved
        offset = buffer.writeUInt8(0, offset); // Reserved
        offset = buffer.writeUInt8(0, offset); // Reserved
        buffer.writeUInt8(0, offset); // Reserved

        return buffer;
    }

    public toString(): string {
        return `KeyCodeControlMessage{action=${this.action}, keycode=${this.keycode}, metaState=${this.metaState}}`;
    }

    public toJSON(): KeyCodeControlMessageInterface {
        return {
            type: this.type,
            action: this.action,
            keycode: this.keycode,
            metaState: this.metaState,
            repeat: this.repeat,
        };
    }
}
