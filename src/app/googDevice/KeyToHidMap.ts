import UIEventsCode from '../UIEventsCode';

/**
 * Map browser key codes to HID Usage IDs (USB Scan Codes)
 * Reference: https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf
 * Table 12: Keyboard/Keypad Page (0x07)
 */
export const KeyToHidMap = new Map([
    // Letters A-Z (Usage IDs 0x04-0x1D)
    [UIEventsCode.KeyA, 0x04],
    [UIEventsCode.KeyB, 0x05],
    [UIEventsCode.KeyC, 0x06],
    [UIEventsCode.KeyD, 0x07],
    [UIEventsCode.KeyE, 0x08],
    [UIEventsCode.KeyF, 0x09],
    [UIEventsCode.KeyG, 0x0A],
    [UIEventsCode.KeyH, 0x0B],
    [UIEventsCode.KeyI, 0x0C],
    [UIEventsCode.KeyJ, 0x0D],
    [UIEventsCode.KeyK, 0x0E],
    [UIEventsCode.KeyL, 0x0F],
    [UIEventsCode.KeyM, 0x10],
    [UIEventsCode.KeyN, 0x11],
    [UIEventsCode.KeyO, 0x12],
    [UIEventsCode.KeyP, 0x13],
    [UIEventsCode.KeyQ, 0x14],
    [UIEventsCode.KeyR, 0x15],
    [UIEventsCode.KeyS, 0x16],
    [UIEventsCode.KeyT, 0x17],
    [UIEventsCode.KeyU, 0x18],
    [UIEventsCode.KeyV, 0x19],
    [UIEventsCode.KeyW, 0x1A],
    [UIEventsCode.KeyX, 0x1B],
    [UIEventsCode.KeyY, 0x1C],
    [UIEventsCode.KeyZ, 0x1D],

    // Numbers 1-0 (Usage IDs 0x1E-0x27)
    [UIEventsCode.Digit1, 0x1E],
    [UIEventsCode.Digit2, 0x1F],
    [UIEventsCode.Digit3, 0x20],
    [UIEventsCode.Digit4, 0x21],
    [UIEventsCode.Digit5, 0x22],
    [UIEventsCode.Digit6, 0x23],
    [UIEventsCode.Digit7, 0x24],
    [UIEventsCode.Digit8, 0x25],
    [UIEventsCode.Digit9, 0x26],
    [UIEventsCode.Digit0, 0x27],

    // Control keys
    [UIEventsCode.Enter, 0x28],
    [UIEventsCode.Escape, 0x29],
    [UIEventsCode.Backspace, 0x2A],
    [UIEventsCode.Tab, 0x2B],
    [UIEventsCode.Space, 0x2C],
    [UIEventsCode.Minus, 0x2D],
    [UIEventsCode.Equal, 0x2E],
    [UIEventsCode.BracketLeft, 0x2F],
    [UIEventsCode.BracketRight, 0x30],
    [UIEventsCode.Backslash, 0x31],
    [UIEventsCode.Semicolon, 0x33],
    [UIEventsCode.Quote, 0x34],
    [UIEventsCode.Backquote, 0x35],
    [UIEventsCode.Comma, 0x36],
    [UIEventsCode.Period, 0x37],
    [UIEventsCode.Slash, 0x38],
    [UIEventsCode.CapsLock, 0x39],

    // Function keys F1-F12
    [UIEventsCode.F1, 0x3A],
    [UIEventsCode.F2, 0x3B],
    [UIEventsCode.F3, 0x3C],
    [UIEventsCode.F4, 0x3D],
    [UIEventsCode.F5, 0x3E],
    [UIEventsCode.F6, 0x3F],
    [UIEventsCode.F7, 0x40],
    [UIEventsCode.F8, 0x41],
    [UIEventsCode.F9, 0x42],
    [UIEventsCode.F10, 0x43],
    [UIEventsCode.F11, 0x44],
    [UIEventsCode.F12, 0x45],

    // Special keys
    [UIEventsCode.PrintScreen, 0x46],
    // [UIEventsCode.ScrollLock, 0x47],
    [UIEventsCode.Pause, 0x48],
    [UIEventsCode.Insert, 0x49],
    [UIEventsCode.Home, 0x4A],
    [UIEventsCode.PageUp, 0x4B],
    [UIEventsCode.Delete, 0x4C],
    [UIEventsCode.End, 0x4D],
    [UIEventsCode.PageDown, 0x4E],
    [UIEventsCode.ArrowRight, 0x4F],
    [UIEventsCode.ArrowLeft, 0x50],
    [UIEventsCode.ArrowDown, 0x51],
    [UIEventsCode.ArrowUp, 0x52],
    [UIEventsCode.NumLock, 0x53],

    // Numpad
    [UIEventsCode.NumpadDivide, 0x54],
    [UIEventsCode.NumpadMultiply, 0x55],
    [UIEventsCode.NumpadSubtract, 0x56],
    [UIEventsCode.NumpadAdd, 0x57],
    [UIEventsCode.NumpadEnter, 0x58],
    [UIEventsCode.Numpad1, 0x59],
    [UIEventsCode.Numpad2, 0x5A],
    [UIEventsCode.Numpad3, 0x5B],
    [UIEventsCode.Numpad4, 0x5C],
    [UIEventsCode.Numpad5, 0x5D],
    [UIEventsCode.Numpad6, 0x5E],
    [UIEventsCode.Numpad7, 0x5F],
    [UIEventsCode.Numpad8, 0x60],
    [UIEventsCode.Numpad9, 0x61],
    [UIEventsCode.Numpad0, 0x62],
    [UIEventsCode.NumpadDecimal, 0x63],
    [UIEventsCode.NumpadEqual, 0x67],

    // Modifier keys (not used as keycodes, but for reference)
    [UIEventsCode.ControlLeft, 0xE0],
    [UIEventsCode.ShiftLeft, 0xE1],
    [UIEventsCode.AltLeft, 0xE2],
    [UIEventsCode.MetaLeft, 0xE3],
    [UIEventsCode.ControlRight, 0xE4],
    [UIEventsCode.ShiftRight, 0xE5],
    [UIEventsCode.AltRight, 0xE6],
    [UIEventsCode.MetaRight, 0xE7],
]);

/**
 * HID Modifier bit flags
 */
export const HidModifiers = {
    CTRL_LEFT: 0x01,
    SHIFT_LEFT: 0x02,
    ALT_LEFT: 0x04,
    GUI_LEFT: 0x08,  // Meta/Windows/Command
    CTRL_RIGHT: 0x10,
    SHIFT_RIGHT: 0x20,
    ALT_RIGHT: 0x40,
    GUI_RIGHT: 0x80,
};
