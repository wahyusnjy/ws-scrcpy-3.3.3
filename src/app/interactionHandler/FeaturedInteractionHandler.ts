import { InteractionEvents, KeyEventNames, InteractionHandler } from './InteractionHandler';
import { BasePlayer } from '../player/BasePlayer';
import { ControlMessage } from '../controlMessage/ControlMessage';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import MotionEvent from '../MotionEvent';
import ScreenInfo from '../ScreenInfo';
import { ScrollControlMessage } from '../controlMessage/ScrollControlMessage';

const TAG = '[FeaturedTouchHandler]';

export interface InteractionHandlerListener {
    sendMessage: (message: ControlMessage) => void;
}

export class FeaturedInteractionHandler extends InteractionHandler {
    private static readonly touchEventsNames: InteractionEvents[] = [
        'touchstart',
        'touchend',
        'touchmove',
        'touchcancel',
        'mousedown',
        'mouseup',
        'mousemove',
        'wheel',
    ];
    private static readonly keyEventsNames: KeyEventNames[] = ['keydown', 'keyup'];
    public static SCROLL_EVENT_THROTTLING_TIME = 30; // one event per 30ms for scroll
    public static MOUSE_MOVE_THROTTLING_TIME = 16; // one event per 16ms (~60fps) for mouse move
    private readonly storedFromMouseEvent = new Map<number, TouchControlMessage>();
    private readonly storedFromTouchEvent = new Map<number, TouchControlMessage>();
    private lastScrollEvent?: { time: number; hScroll: number; vScroll: number };
    private lastMouseMoveEvent?: { time: number; x: number; y: number };
    private mouseUpSafetyTimer?: number;

    constructor(player: BasePlayer, public readonly listener: InteractionHandlerListener) {
        super(player, FeaturedInteractionHandler.touchEventsNames, FeaturedInteractionHandler.keyEventsNames);
        this.tag.addEventListener('mouseleave', this.onMouseLeave);
        this.tag.addEventListener('mouseenter', this.onMouseEnter);

        // Direct listeners as backup to ensure mousedown/mouseup are captured
        this.tag.addEventListener('mousedown', this.onDirectMouseDown);
        this.tag.addEventListener('mouseup', this.onDirectMouseUp);
        // console.log(TAG, 'Direct mousedown/mouseup listeners attached to canvas');
    }

    private onDirectMouseDown = (e: MouseEvent): void => {
        // console.log(TAG, 'DIRECT mousedown captured!', e);
        // Will be handled by onInteraction via normal flow
    };

    private onDirectMouseUp = (e: MouseEvent): void => {
        // console.log(TAG, 'DIRECT mouseup captured!', e);
        // Will be handled by onInteraction via normal flow
    };

    public buildScrollEvent(event: WheelEvent, screenInfo: ScreenInfo): ScrollControlMessage[] {
        const messages: ScrollControlMessage[] = [];
        const touchOnClient = InteractionHandler.buildTouchOnClient(event, screenInfo);
        if (touchOnClient) {
            const hScroll = event.deltaX > 0 ? -1 : event.deltaX < -0 ? 1 : 0;
            const vScroll = event.deltaY > 0 ? -1 : event.deltaY < -0 ? 1 : 0;
            const time = Date.now();
            if (
                !this.lastScrollEvent ||
                time - this.lastScrollEvent.time > FeaturedInteractionHandler.SCROLL_EVENT_THROTTLING_TIME ||
                this.lastScrollEvent.vScroll !== vScroll ||
                this.lastScrollEvent.hScroll !== hScroll
            ) {
                this.lastScrollEvent = { time, hScroll, vScroll };
                messages.push(new ScrollControlMessage(touchOnClient.touch.position, hScroll, vScroll));
            }
        }
        return messages;
    }

    protected onInteraction(event: MouseEvent | TouchEvent): void {
        // Check if the event target is an interactive element (input, textarea, button, select, etc.)
        const target = event.target as HTMLElement;
        const isInteractiveElement = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.tagName === 'LABEL' ||
            target.isContentEditable ||
            target.closest('.more-box') !== null // Allow interaction with any element inside more-box
        );

        // If it's an interactive element, don't interfere with the event
        if (isInteractiveElement) {
            // console.log(TAG, 'Skipping interaction handler for interactive element:', target.tagName);
            return;
        }

        // console.log(TAG, 'onInteraction called, event type:', event.type);
        const screenInfo = this.player.getScreenInfo();
        // console.log(TAG, 'screenInfo:', screenInfo);
        if (!screenInfo) {
            // console.warn(TAG, 'NO screenInfo! Aborting touch handling');
            return;
        }
        let messages: ControlMessage[];
        let storage: Map<number, TouchControlMessage>;
        if (event instanceof MouseEvent) {
            // Accept all mouse events - simplified for debugging
            // console.log(TAG, 'Mouse event:', event.type);
            if (window['WheelEvent'] && event instanceof WheelEvent) {
                messages = this.buildScrollEvent(event, screenInfo);
            } else {
                storage = this.storedFromMouseEvent;

                // Throttle mousemove events to prevent overwhelming the device
                if (event.type === 'mousemove' && event.buttons > 0) {
                    const now = Date.now();
                    const x = event.clientX;
                    const y = event.clientY;

                    if (this.lastMouseMoveEvent) {
                        const timeSinceLastMove = now - this.lastMouseMoveEvent.time;
                        const distance = Math.sqrt(
                            Math.pow(x - this.lastMouseMoveEvent.x, 2) +
                            Math.pow(y - this.lastMouseMoveEvent.y, 2)
                        );

                        // Skip if too soon and movement is small
                        if (timeSinceLastMove < FeaturedInteractionHandler.MOUSE_MOVE_THROTTLING_TIME && distance < 5) {
                            return;
                        }
                    }

                    this.lastMouseMoveEvent = { time: now, x, y };
                }

                // Handle mousedown - set safety timer
                if (event.type === 'mousedown') {
                    // Clear any existing safety timer
                    if (this.mouseUpSafetyTimer) {
                        window.clearTimeout(this.mouseUpSafetyTimer);
                    }

                    // Set a safety timer to ensure ACTION_UP is sent if mouseup is missed
                    this.mouseUpSafetyTimer = window.setTimeout(() => {
                        console.warn(TAG, 'Safety timer triggered - sending ACTION_UP to prevent freeze');
                        this.storedFromMouseEvent.forEach((message) => {
                            this.listener.sendMessage(InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_UP, message));
                        });
                        this.storedFromMouseEvent.clear();
                        this.mouseUpSafetyTimer = undefined;
                    }, 5000); // 5 second safety timeout
                }

                // Handle mouseup - clear safety timer
                if (event.type === 'mouseup') {
                    if (this.mouseUpSafetyTimer) {
                        window.clearTimeout(this.mouseUpSafetyTimer);
                        this.mouseUpSafetyTimer = undefined;
                    }
                    this.lastMouseMoveEvent = undefined;
                }

                messages = this.buildTouchEvent(event, screenInfo, storage);
            }
            if (this.over) {
                this.lastPosition = event;
            }
        } else if (window['TouchEvent'] && event instanceof TouchEvent) {
            // TODO: Research drag from out of the target inside it
            if (event.target !== this.tag) {
                return;
            }
            storage = this.storedFromTouchEvent;
            messages = this.formatTouchEvent(event, screenInfo, storage);
        } else {
            console.error(TAG, 'Unsupported event', event);
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        event.stopPropagation();
        // console.log(TAG, `Sending ${messages.length} messages to device`);
        messages.forEach((message) => {
            // console.log(TAG, 'Sending message:', message);
            this.listener.sendMessage(message);
        });
    }

    protected onKey(event: KeyboardEvent): void {
        if (!this.lastPosition) {
            return;
        }
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        const { ctrlKey, shiftKey } = event;
        const { target, button, buttons, clientY, clientX } = this.lastPosition;
        const type = InteractionHandler.SIMULATE_MULTI_TOUCH;
        const props = { ctrlKey, shiftKey, type, target, button, buttons, clientX, clientY };
        this.buildTouchEvent(props, screenInfo, new Map());
    }

    private onMouseEnter = (): void => {
        this.over = true;
    };
    private onMouseLeave = (): void => {
        this.lastPosition = undefined;
        this.over = false;

        // Clear safety timer
        if (this.mouseUpSafetyTimer) {
            window.clearTimeout(this.mouseUpSafetyTimer);
            this.mouseUpSafetyTimer = undefined;
        }

        // Clear mouse move tracking
        this.lastMouseMoveEvent = undefined;

        // Send ACTION_UP for any stored mouse events
        this.storedFromMouseEvent.forEach((message) => {
            this.listener.sendMessage(InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_UP, message));
        });
        this.storedFromMouseEvent.clear();
        this.clearCanvas();
    };

    public release(): void {
        super.release();

        // Clear safety timer
        if (this.mouseUpSafetyTimer) {
            window.clearTimeout(this.mouseUpSafetyTimer);
            this.mouseUpSafetyTimer = undefined;
        }

        this.tag.removeEventListener('mouseleave', this.onMouseLeave);
        this.tag.removeEventListener('mouseenter', this.onMouseEnter);
        this.tag.removeEventListener('mousedown', this.onDirectMouseDown);
        this.tag.removeEventListener('mouseup', this.onDirectMouseUp);
        this.storedFromMouseEvent.clear();
    }
}
