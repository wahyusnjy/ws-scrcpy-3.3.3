import { Buffer } from 'buffer';
import { ControlMessage, ControlMessageInterface } from './ControlMessage';

/**
 * Control message for injecting Android key events (TYPE 0)
 * Used for: Back, Home, Overview, Power, Volume buttons etc.
 * 
 * Format (14 bytes total):
 * - Type: 1 byte (0 = inject keycode)
 * - Action: 1 byte (0 = DOWN, 1 = UP)
 * - Keycode: 4 bytes (Android keycode, big-endian)
 * - Repeat: 4 bytes (repeat count, big-endian)
 * - MetaState: 4 bytes (Android meta state, big-endian)
 */
export class InjectKeycodeMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 13; // 14 bytes total - 1 for type

    constructor(
        readonly action: number,
        readonly keycode: number,
        readonly repeat: number,
        readonly metaState: number,
    ) {
        super(ControlMessage.TYPE_INJECT_KEYCODE); // TYPE 0
    }

    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(InjectKeycodeMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;

        // Type byte (0 = Inject Keycode)
        offset = buffer.writeUInt8(this.type, offset);

        // Action (0 = DOWN, 1 = UP)
        offset = buffer.writeUInt8(this.action, offset);

        // Android Keycode (4 bytes, big-endian)
        offset = buffer.writeInt32BE(this.keycode, offset);

        // Repeat count (4 bytes, big-endian)
        offset = buffer.writeInt32BE(this.repeat, offset);

        // Meta state (4 bytes, big-endian)
        buffer.writeInt32BE(this.metaState, offset);

        return buffer;
    }

    public toString(): string {
        return `InjectKeycodeMessage{action=${this.action}, keycode=${this.keycode}, metaState=${this.metaState}}`;
    }

    public toJSON(): ControlMessageInterface & { action: number; keycode: number; repeat: number; metaState: number } {
        return {
            type: this.type,
            action: this.action,
            keycode: this.keycode,
            metaState: this.metaState,
            repeat: this.repeat,
        };
    }
}
