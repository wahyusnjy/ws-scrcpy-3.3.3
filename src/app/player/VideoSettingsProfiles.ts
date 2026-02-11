import VideoSettings from '../VideoSettings';
import Size from '../Size';

/**
 * OPTIMIZED VIDEO SETTINGS CONFIGURATIONS
 * 
 * File ini berisi konfigurasi video yang sudah dioptimasi untuk berbagai use cases.
 * Copy salah satu profile ke MsePlayer.ts sesuai kebutuhan Anda.
 * 
 * Location to apply: src/app/player/MsePlayer.ts (line 22-29)
 */

// ============================================================================
// PROFILE 1: LOW MEMORY (Target: < 200MB)
// ============================================================================
// Best for: Multiple simultaneous streams, low-end devices, mobile networks
// Trade-off: Lower quality, less smooth playback
// Expected memory usage: 100-200MB
// ============================================================================

export const LOW_MEMORY_PROFILE: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 2000000,           // 2 Mbps (reduced from 7.3 Mbps)
    maxFps: 24,                 // 24 fps (reduced from 60 fps)
    iFrameInterval: 10,
    bounds: new Size(240, 540), // Smaller resolution
    sendFrameMeta: false,
});

// Also modify MAX_BUFFER in MsePlayer.ts line 68:
// private MAX_BUFFER = this.isSafari ? 2 : this.isChrome && this.isMac ? 0.2 : 0.2;


// ============================================================================
// PROFILE 2: BALANCED (Target: 200-400MB) - RECOMMENDED
// ============================================================================
// Best for: General use, good balance between quality and memory
// Trade-off: Slightly reduced smoothness
// Expected memory usage: 200-400MB
// ============================================================================

export const BALANCED_PROFILE: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 4000000,           // 4 Mbps (moderate)
    maxFps: 30,                 // 30 fps (smooth enough for most cases)
    iFrameInterval: 10,
    bounds: new Size(320, 720), // Default resolution
    sendFrameMeta: false,
});

// Also modify MAX_BUFFER in MsePlayer.ts line 68:
// private MAX_BUFFER = this.isSafari ? 2 : this.isChrome && this.isMac ? 0.4 : 0.2;


// ============================================================================
// PROFILE 3: CURRENT DEFAULT (Target: 400-1000MB)
// ============================================================================
// Best for: When quality is priority, stable network
// Trade-off: High memory usage
// Expected memory usage: 400-1000MB (current issue!)
// ============================================================================

export const CURRENT_DEFAULT_PROFILE: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 7340032,           // ~7.3 Mbps (HIGH)
    maxFps: 60,                 // 60 fps (VERY SMOOTH)
    iFrameInterval: 10,
    bounds: new Size(320, 720),
    sendFrameMeta: false,
});

// Current MAX_BUFFER in MsePlayer.ts line 68:
// private MAX_BUFFER = this.isSafari ? 2 : this.isChrome && this.isMac ? 0.9 : 0.2;
//                                                         HIGH BUFFER ↑


// ============================================================================
// PROFILE 4: HIGH QUALITY HD (Target: 500-800MB)
// ============================================================================
// Best for: Larger screens, demos, when quality matters
// Trade-off: High memory and bandwidth usage
// Expected memory usage: 500-800MB
// ============================================================================

export const HIGH_QUALITY_HD_PROFILE: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 8000000,           // 8 Mbps
    maxFps: 60,                 // 60 fps
    iFrameInterval: 10,
    bounds: new Size(480, 1080), // Larger resolution
    sendFrameMeta: false,
});

// Also modify MAX_BUFFER in MsePlayer.ts line 68:
// private MAX_BUFFER = this.isSafari ? 2 : this.isChrome && this.isMac ? 0.6 : 0.2;


// ============================================================================
// PROFILE 5: ULTRA LOW (Target: < 100MB)
// ============================================================================
// Best for: Very constrained environments, slow networks
// Trade-off: Noticeable quality reduction
// Expected memory usage: 50-100MB
// ============================================================================

export const ULTRA_LOW_PROFILE: VideoSettings = new VideoSettings({
    lockedVideoOrientation: -1,
    bitrate: 1000000,           // 1 Mbps (very low)
    maxFps: 20,                 // 20 fps
    iFrameInterval: 15,
    bounds: new Size(180, 400), // Very small
    sendFrameMeta: false,
});

// Also modify MAX_BUFFER in MsePlayer.ts line 68:
// private MAX_BUFFER = this.isSafari ? 2 : this.isChrome && this.isMac ? 0.15 : 0.15;


// ============================================================================
// CUSTOM CALCULATOR
// ============================================================================
// Use this to estimate memory usage for custom settings:
//
// Memory (MB) ≈ (bitrate_bps / 8) × buffer_seconds × safety_factor
//
// Example with BALANCED_PROFILE:
// Memory = (4,000,000 / 8) × 0.4 × 2.5 = 500KB × 2.5 = 1.25MB per buffer cycle
// Over time with arrays and overhead: ~200-400MB total
//
// safety_factor accounts for:
// - Frame arrays (this.frames)
// - Stats arrays (this.videoStats, this.inputBytes)
// - Decoded frame cache
// - Browser overhead
// - Typical value: 2.0 - 3.0
// ============================================================================


// ============================================================================
// QUICK REFERENCE TABLE
// ============================================================================
//
// | Profile      | Bitrate | FPS | Resolution | Buffer | Memory Est. |
// |--------------|---------|-----|------------|--------|-------------|
// | Ultra Low    | 1 Mbps  | 20  | 180x400    | 0.15s  | 50-100 MB   |
// | Low Memory   | 2 Mbps  | 24  | 240x540    | 0.2s   | 100-200 MB  |
// | Balanced     | 4 Mbps  | 30  | 320x720    | 0.4s   | 200-400 MB  |
// | Current      | 7.3 Mbps| 60  | 320x720    | 0.9s   | 400-1000 MB |
// | High Quality | 8 Mbps  | 60  | 480x1080   | 0.6s   | 500-800 MB  |
//
// ============================================================================


// ============================================================================
// HOW TO APPLY
// ============================================================================
//
// 1. Choose a profile above based on your needs
//
// 2. Edit src/app/player/MsePlayer.ts:
//    - Replace lines 22-29 with your chosen profile settings
//    - Replace line 68 with the MAX_BUFFER value from profile comments
//
// 3. [OPTIONAL] Edit cleanup threshold for more aggressive memory management:
//    - In src/app/player/MsePlayer.ts line 296
//    - Change: if (this.blocks.length < 10) {
//    - To:     if (this.blocks.length < 5) {
//
// 4. Rebuild:
//    npm run dist:prod
//
// 5. Restart server:
//    npm start
//
// 6. Clear browser cache:
//    - Chrome: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
//
// ============================================================================


// ============================================================================
// ADDITIONAL OPTIMIZATIONS
// ============================================================================
//
// 1. Reduce stats array retention (MsePlayer.ts line 191-195):
//    Change retention from 1000ms to 500ms for stats cleanup
//
// 2. Limit frame queue size (not currently implemented):
//    Add max length check to this.frames array
//
// 3. Use more aggressive buffer cleanup (line 296):
//    Lower threshold from 10 to 5 blocks
//
// 4. Consider switching player:
//    - WebCodecsPlayer might use less memory (check browser support)
//    - TinyH264Player for specific use cases
//
// ============================================================================
