import { ControlMessage, ControlMessageInterface } from './ControlMessage';
import Position, { PositionInterface } from '../Position';

export interface TouchControlMessageInterface extends ControlMessageInterface {
    type: number;
    action: number;
    pointerId: number;
    position: PositionInterface;
    pressure: number;
    buttons: number;
}

export class TouchControlMessage extends ControlMessage {
    // Inject touch format: 32 bytes total (1 type + 31 payload)
    public static PAYLOAD_LENGTH = 31;
    public static readonly MAX_PRESSURE_VALUE = 0xffff;

    // Use POINTER_ID_MOUSE to show cursor on Android
    public static readonly POINTER_ID_MOUSE = -1;

    constructor(
        readonly action: number,
        readonly pointerId: number,
        readonly position: Position,
        readonly pressure: number,
        readonly buttons: number,
        readonly actionButton: number = 0,
    ) {
        super(ControlMessage.TYPE_TOUCH);
    }

    /**
     * Generate inject touch message (32 bytes):
     * Follows scrcpy protocol for TYPE_INJECT_TOUCH_EVENT
     */
    public toBuffer(): Buffer {
        const buffer: Buffer = Buffer.alloc(TouchControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;

        // Type byte (2 = inject touch)
        offset = buffer.writeUInt8(this.type, offset);

        // Action (1 byte)
        offset = buffer.writeUInt8(this.action, offset);

        // Pointer ID (8 bytes, signed 64-bit) - use POINTER_ID_MOUSE (-1) to show cursor
        // Write as two 32-bit values (high and low)
        const pointerId = TouchControlMessage.POINTER_ID_MOUSE;
        offset = buffer.writeInt32BE(pointerId < 0 ? -1 : 0, offset); // high 32 bits
        offset = buffer.writeInt32BE(pointerId, offset); // low 32 bits (sign-extended)

        // Position X (4 bytes, signed 32-bit)
        offset = buffer.writeInt32BE(Math.round(this.position.point.x), offset);

        // Position Y (4 bytes, signed 32-bit)
        offset = buffer.writeInt32BE(Math.round(this.position.point.y), offset);

        // Screen width (2 bytes, unsigned 16-bit)
        offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);

        // Screen height (2 bytes, unsigned 16-bit)
        offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);

        // Pressure (2 bytes, unsigned 16-bit)
        const pressureValue = Math.round(this.pressure * TouchControlMessage.MAX_PRESSURE_VALUE);
        offset = buffer.writeUInt16BE(pressureValue, offset);

        // Action button (4 bytes, signed 32-bit)
        offset = buffer.writeInt32BE(this.actionButton, offset);

        // Buttons (4 bytes, signed 32-bit)
        buffer.writeInt32BE(this.buttons, offset);

        console.log(`[Inject Touch] action=${this.action}, pointerId=${pointerId}, pos=(${Math.round(this.position.point.x)},${Math.round(this.position.point.y)}), screen=${this.position.screenSize.width}x${this.position.screenSize.height}`);

        return buffer;
    }

    public toString(): string {
        return `TouchControlMessage{action=${this.action}, pointerId=${this.pointerId}, position=${this.position}, pressure=${this.pressure}, buttons=${this.buttons}}`;
    }

    public toJSON(): TouchControlMessageInterface {
        return {
            type: this.type,
            action: this.action,
            pointerId: this.pointerId,
            position: this.position.toJSON(),
            pressure: this.pressure,
            buttons: this.buttons,
        };
    }
}
