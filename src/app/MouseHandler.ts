/**
 * Mouse Handler for ws-scrcpy (Compatible with server v1.19-ws6)
 * 
 * Converts mouse events to touch events and sends TouchControlMessage
 * Works with existing scrcpy-server WebSocket implementation
 */

import { TouchControlMessage } from './controlMessage/TouchControlMessage';
import MotionEvent from './MotionEvent';
import Position from './Position';
import Point from './Point';
import Size from './Size';
import ScreenInfo from './ScreenInfo';

export class MouseHandler {
    private websocket: WebSocket | null = null;
    private enabled: boolean = false;
    private screenInfo: ScreenInfo | null = null;
    private pointerId: number = 0;
    private isPressed: boolean = false;

    /**
     * Set the WebSocket connection for sending mouse messages
     */
    public setWebSocket(ws: WebSocket): void {
        this.websocket = ws;
    }

    /**
     * Enable or disable the mouse handler
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Set screen info for coordinate conversion
     */
    public setScreenInfo(screenInfo: ScreenInfo): void {
        this.screenInfo = screenInfo;
    }

    /**
     * Convert mouse coordinates to Android screen coordinates
     */
    private convertCoordinates(event: MouseEvent, target: HTMLElement): Position | null {
        if (!this.screenInfo) {
            return null;
        }

        const rect = target.getBoundingClientRect();
        const { clientWidth, clientHeight } = target;
        let touchX = event.clientX - rect.left;
        let touchY = event.clientY - rect.top;

        // Check if coordinates are within bounds
        if (touchX < 0 || touchX > clientWidth || touchY < 0 || touchY > clientHeight) {
            return null;
        }

        const { width, height } = this.screenInfo.videoSize;

        // Handle aspect ratio scaling
        const eps = 1e5;
        const ratio = width / height;
        const shouldBe = Math.round(eps * ratio);
        const haveNow = Math.round((eps * clientWidth) / clientHeight);

        let realWidth = clientWidth;
        let realHeight = clientHeight;

        if (shouldBe > haveNow) {
            realHeight = Math.ceil(clientWidth / ratio);
            const top = (clientHeight - realHeight) / 2;
            if (touchY < top || touchY > top + realHeight) {
                return null;
            }
            touchY -= top;
        } else if (shouldBe < haveNow) {
            realWidth = Math.ceil(clientHeight * ratio);
            const left = (clientWidth - realWidth) / 2;
            if (touchX < left || touchX > left + realWidth) {
                return null;
            }
            touchX -= left;
        }

        const x = (touchX * width) / realWidth;
        const y = (touchY * height) / realHeight;

        const size = new Size(width, height);
        const point = new Point(x, y);

        return new Position(point, size);
    }

    /**
     * Get button state from mouse event
     */
    private getButtonState(event: MouseEvent): number {
        // Map mouse buttons to Android button constants
        if (event.buttons & 1) return MotionEvent.BUTTON_PRIMARY;   // Left button
        if (event.buttons & 2) return MotionEvent.BUTTON_SECONDARY; // Right button
        if (event.buttons & 4) return MotionEvent.BUTTON_TERTIARY;  // Middle button
        return 0;
    }

    /**
     * Send touch message
     */
    private sendTouchMessage(action: number, position: Position, buttons: number, pressure: number): void {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        const message = new TouchControlMessage(action, this.pointerId, position, pressure, buttons);
        const buffer = message.toBuffer();
        this.websocket.send(buffer);

        const actionName = action === MotionEvent.ACTION_DOWN ? 'DOWN' :
            action === MotionEvent.ACTION_UP ? 'UP' : 'MOVE';
        console.log(`[MouseHandler] Touch ${actionName}: (${Math.round(position.point.x)}, ${Math.round(position.point.y)}), buttons=${buttons}`);
    }

    /**
     * Handle mouse down event
     */
    public handleMouseDown(event: MouseEvent): void {
        if (!this.enabled || !this.websocket || !this.screenInfo) {
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const position = this.convertCoordinates(event, target);
        if (!position) {
            return;
        }

        this.isPressed = true;
        const buttons = this.getButtonState(event);
        this.sendTouchMessage(MotionEvent.ACTION_DOWN, position, buttons, 1.0);
    }

    /**
     * Handle mouse up event
     */
    public handleMouseUp(event: MouseEvent): void {
        if (!this.enabled || !this.websocket || !this.screenInfo) {
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const position = this.convertCoordinates(event, target);
        if (!position) {
            return;
        }

        this.isPressed = false;
        const buttons = this.getButtonState(event);
        this.sendTouchMessage(MotionEvent.ACTION_UP, position, buttons, 0);
    }

    /**
     * Handle mouse move event
     */
    public handleMouseMove(event: MouseEvent): void {
        if (!this.enabled || !this.websocket || !this.screenInfo) {
            return;
        }

        // Only send move events when mouse button is pressed
        if (!this.isPressed) {
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const position = this.convertCoordinates(event, target);
        if (!position) {
            return;
        }

        const buttons = this.getButtonState(event);
        this.sendTouchMessage(MotionEvent.ACTION_MOVE, position, buttons, 1.0);
    }

    /**
     * Handle mouse wheel event (scroll)
     */
    public handleWheel(event: WheelEvent): void {
        if (!this.enabled || !this.websocket || !this.screenInfo) {
            return;
        }

        // Mouse wheel scrolling can be emulated with swipe gestures
        // For now, we'll skip this as it's more complex
        // You can implement scroll messages if the server supports them

        event.preventDefault();
        console.log('[MouseHandler] Wheel scroll:', event.deltaX, event.deltaY);
        // TODO: Implement scroll control message if needed
    }

    /**
     * Clean up and disable
     */
    public destroy(): void {
        this.enabled = false;
        this.websocket = null;
        this.screenInfo = null;
        this.isPressed = false;
    }
}
