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
     * Generate UHID keyboard message (9 bytes total):
     * Byte 0: Type (100 = TYPE_KEYCODE for UHID)
     * Byte 1: Action (0=ACTION_DOWN, 1=ACTION_UP)
     * Byte 2: Keycode (HID Usage ID)
     * Byte 3: Repeat count
     * Byte 4: Modifiers (HID modifier byte)
     * Bytes 5-8: Reserved (0)
     */
    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(KeyCodeControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;

        // Type byte (100 = UHID keyboard)
        offset = buffer.writeUInt8(this.type, offset);

        // Message payload (8 bytes)
        offset = buffer.writeUInt8(this.action, offset);        // Action (0=DOWN, 1=UP)
        offset = buffer.writeUInt8(this.keycode, offset);       // HID keycode
        offset = buffer.writeUInt8(this.repeat, offset);        // Repeat count
        offset = buffer.writeUInt8(this.metaState, offset);     // Modifiers
        offset = buffer.writeUInt8(0, offset);                  // Reserved
        offset = buffer.writeUInt8(0, offset);                  // Reserved
        offset = buffer.writeUInt8(0, offset);                  // Reserved
        buffer.writeUInt8(0, offset);                           // Reserved

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
