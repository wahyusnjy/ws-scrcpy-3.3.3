import { ControlMessage, ControlMessageInterface } from './ControlMessage';
import Position, { PositionInterface } from '../Position';

export interface ScrollControlMessageInterface extends ControlMessageInterface {
    position: PositionInterface;
    hScroll: number;
    vScroll: number;
}

export class ScrollControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 20;

    constructor(readonly position: Position, readonly hScroll: number, readonly vScroll: number) {
        super(ControlMessage.TYPE_SCROLL);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(ScrollControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;
        offset = buffer.writeUInt8(this.type, offset);

        // Round and clamp coordinates to valid UInt32 range (0 to 4294967295)
        const x = Math.max(0, Math.min(0xffffffff, Math.round(this.position.point.x)));
        const y = Math.max(0, Math.min(0xffffffff, Math.round(this.position.point.y)));

        offset = buffer.writeUInt32BE(x, offset);
        offset = buffer.writeUInt32BE(y, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);
        offset = buffer.writeInt32BE(this.hScroll, offset);
        buffer.writeInt32BE(this.vScroll, offset);
        return buffer;
    }

    public toString(): string {
        return `ScrollControlMessage{hScroll=${this.hScroll}, vScroll=${this.vScroll}, position=${this.position}}`;
    }

    public toJSON(): ScrollControlMessageInterface {
        return {
            type: this.type,
            position: this.position.toJSON(),
            hScroll: this.hScroll,
            vScroll: this.vScroll,
        };
    }
}
