export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_PORT = 8886;
// export const SERVER_VERSION = '1.19-ws6';
// export const SERVER_VERSION = '3.3.3'; // Confirmed: JAR file IS v3.3.3 (checked via strings in classes.dex)
export const SERVER_VERSION = '3.3.3';

export const SERVER_TYPE = 'web';

export const LOG_LEVEL = 'INFO'; // DEBUG only when troubleshooting — causes heavy logcat I/O

let SCRCPY_LISTENS_ON_ALL_INTERFACES;
/// #if SCRCPY_LISTENS_ON_ALL_INTERFACES
SCRCPY_LISTENS_ON_ALL_INTERFACES = true;
/// #else
SCRCPY_LISTENS_ON_ALL_INTERFACES = false;
/// #endif

// ============================================================
// SCRCPY SERVER LAUNCH ARGUMENTS (CONFIRMED FORMAT v3.3.3)
// adb shell CLASSPATH=... app_process / com.genymobile.scrcpy.Server \
//   3.3.3 web DEBUG 8886 true h264 false true 4000000
// ============================================================
//
// Server baru sudah include fixes:
// 1. NAL-aware streaming (1 WebSocket msg = 1 NAL unit)
// 2. SPS/PPS cache: dikirim ke client baru langsung saat connect
// 3. 200ms delay sebelum keyframe request (decoder sempat init)
//
// Argumen positional:
// [0] version, [1] type, [2] log_level, [3] port,
// [4] listen_on_all_interfaces, [5] codec, [6] uhid_keyboard,
// [7] inject_mouse, [8] bitrate (NEW in updated server!)
//
// Note: iFrameInterval default di scrcpy = 10 detik!
// Diatasi via SET_VIDEO_SETTINGS command setelah client connect
// (lihat MsePlayer.preferredVideoSettings.iFrameInterval = 1)

const INITIAL_BITRATE = 4000000; // 4 Mbps initial (client bisa negotiate lebih rendah via SET_VIDEO_SETTINGS)

const ARGUMENTS = [
    SERVER_VERSION,                    // 3.3.3
    SERVER_TYPE,                       // web
    LOG_LEVEL,                         // DEBUG
    SERVER_PORT,                       // 8886
    SCRCPY_LISTENS_ON_ALL_INTERFACES,  // true/false (dikontrol build flag)
    'h264',                            // video codec
    'true',                            // inject mouse (shows cursor on screen)
    'true',                            // UHID keyboard (false = gunakan inject keycode biasa)
    // INITIAL_BITRATE,                   // 4000000 = 4 Mbps (confirmed supported di server baru)
];


export const SERVER_PROCESS_NAME = 'app_process';

// Removed output redirection to /dev/null to see error messages
export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')}`;
