import { BasePlayer } from './BasePlayer';
import VideoConverter, { setLogger, mimeType } from 'h264-converter';
import VideoSettings from '../VideoSettings';
import Size from '../Size';
import { DisplayInfo } from '../DisplayInfo';

interface QualityStats {
    timestamp: number;
    decodedFrames: number;
    droppedFrames: number;
}

type Block = {
    start: number;
    end: number;
};

export class MsePlayer extends BasePlayer {
    public static readonly storageKeyPrefix = 'MseDecoder';
    public static readonly playerFullName = 'H264 Converter';
    public static readonly playerCodeName = 'mse';
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        bitrate: 2000000,      // 2 Mbps — cukup untuk 320px, hemat bandwidth multistream
        maxFps: 30,            // 30 fps — smooth & hemat resource
        bounds: new Size(320, 720),
        lockedVideoOrientation: -1,
        sendFrameMeta: true,
        iFrameInterval: 1,    // IDR setiap 1 detik — cukup cepat untuk reconnect
        // codecOptions DIHAPUS: intra-refresh-mode=1 konflik dengan iFrameInterval=1
        // → IDR proper tidak datang → decoder stuck setelah refresh
    });
    private static DEFAULT_FRAMES_PER_FRAGMENT = 1;
    private static DEFAULT_FRAMES_PER_SECOND = 60;

    public static createElement(id?: string): HTMLVideoElement {
        const tag = document.createElement('video') as HTMLVideoElement;
        tag.muted = true;
        tag.autoplay = true;
        tag.setAttribute('muted', 'muted');
        tag.setAttribute('autoplay', 'autoplay');
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        tag.style.width = '320px';
        return tag;
    }

    private converter?: VideoConverter;
    private videoStats: QualityStats[] = [];
    private noDecodedFramesSince = -1;
    // currentTimeNotChangedSince DIHAPUS: menyebabkan player restart saat layar static
    private bigBufferSince = -1;
    private aheadOfBufferSince = -1;
    public fpf: number = MsePlayer.DEFAULT_FRAMES_PER_FRAGMENT;
    public readonly supportsScreenshot = true;
    private sourceBuffer?: SourceBuffer;
    private waitUntilSegmentRemoved = false;
    private blocks: Block[] = [];
    private frames: Uint8Array[] = [];
    private jumpEnd = -1;
    private lastTime = -1;
    protected canPlay = false;
    private seekingSince = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected readonly isSafari = !!(window as unknown as any)['safari'];
    protected readonly isChrome = navigator.userAgent.includes('Chrome');
    protected readonly isMac = navigator.platform.startsWith('Mac');
    private MAX_TIME_TO_RECOVER = 500; // ms - waktu sebelum trigger seek ketika decoder stuck
    private MAX_BUFFER = 1.5;  // ↑ dari 0.5 → kurangi seek agresif yang bikin stutter
    private MAX_AHEAD = -1.0;

    public static isSupported(): boolean {
        return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mimeType);
    }

    // Hapus localStorage settings yang invalid atau tidak kompatibel:
    // 1. iFrameInterval < 1 → scrcpy pakai default 10 detik!
    // 2. codecOptions tidak sama dengan preferredVideoSettings → akan trigger encoder restart
    private static cleanInvalidStoredSettings(): void {
        if (!window.localStorage) return;
        const expectedCodecOptions = MsePlayer.preferredVideoSettings.codecOptions;
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(MsePlayer.storageKeyPrefix)) {
                try {
                    const val = window.localStorage.getItem(key);
                    if (val) {
                        const parsed = JSON.parse(val);
                        if (!parsed) continue;
                        // Kondisi 1: iFrameInterval tidak valid
                        if (parsed.iFrameInterval < 1 || parsed.iFrameInterval === 0) {
                            keysToRemove.push(key);
                            continue;
                        }
                        // Kondisi 2: codecOptions berbeda dari preferred (misal: settings lama
                        // tidak punya intra-refresh-mode=1, akan menyebabkan encoder restart)
                        if (parsed.codecOptions !== expectedCodecOptions) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    // ignore parse errors
                }
            }
        }
        keysToRemove.forEach((key) => {
            console.warn(`[MsePlayer] Clearing invalid stored settings: ${key}`);
            window.localStorage.removeItem(key);
        });
    }

    constructor(
        udid: string,
        displayInfo?: DisplayInfo,
        name = MsePlayer.playerFullName,
        protected tag: HTMLVideoElement = MsePlayer.createElement(),
    ) {
        super(udid, displayInfo, name, MsePlayer.storageKeyPrefix, tag);
        tag.oncontextmenu = function (event: MouseEvent): boolean {
            event.preventDefault();
            return false;
        };
        tag.addEventListener('error', this.onVideoError);
        tag.addEventListener('canplay', this.onVideoCanPlay);
        // Fix: resume playback saat tab/window menjadi visible kembali
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        // Option D: clear memory saat halaman di-refresh/close
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setLogger(() => { }, console.error);

        // Bersihkan localStorage dari settings invalid (misal: iFrameInterval=0 dari bug 0.1)
        // Settings dengan iFrameInterval<1 akan menyebabkan scrcpy pakai default 10 detik!
        MsePlayer.cleanInvalidStoredSettings();
    }

    handleBeforeUnload = (): void => {
        // Paksa release MediaSource & SourceBuffer saat refresh/close tab
        // mencegah orphaned MediaSource & memory leak di browser
        this.stopConverter();
    };

    onVideoError = (event: Event): void => {
        console.error(`[${this.name}]`, event);
    };

    onVideoCanPlay = (): void => {
        this.onCanPlayHandler();
    };

    onVisibilityChange = (): void => {
        // Saat tab kembali aktif (visible), langsung resume video
        if (document.visibilityState === 'visible' && this.converter) {
            if (this.tag.paused) {
                this.tag.play().catch(() => {
                    // Akan dicoba lagi oleh checkForBadState
                });
            }
        }
    };

    // Override: MsePlayer doesn't need screen info before starting playback
    protected needScreenInfoBeforePlay(): boolean {
        return false;
    }

    private static createConverter(
        tag: HTMLVideoElement,
        fps: number = MsePlayer.DEFAULT_FRAMES_PER_SECOND,
        fpf: number = MsePlayer.DEFAULT_FRAMES_PER_FRAGMENT,
    ): VideoConverter {
        return new VideoConverter(tag, fps, fpf);
    }

    private getVideoPlaybackQuality(): QualityStats | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const video = this.tag as any;
        if (typeof video.mozDecodedFrames !== 'undefined') {
            return null;
        }
        const now = Date.now();
        if (typeof this.tag.getVideoPlaybackQuality == 'function') {
            const temp = this.tag.getVideoPlaybackQuality();
            return {
                timestamp: now,
                decodedFrames: temp.totalVideoFrames,
                droppedFrames: temp.droppedVideoFrames,
            };
        }

        // Webkit-specific properties
        if (typeof video.webkitDecodedFrameCount !== 'undefined') {
            return {
                timestamp: now,
                decodedFrames: video.webkitDecodedFrameCount,
                droppedFrames: video.webkitDroppedFrameCount,
            };
        }
        return null;
    }

    protected onCanPlayHandler(): void {
        this.canPlay = true;
        // Gunakan Promise untuk handle autoplay policy dengan benar
        const playPromise = this.tag.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Berhasil play - hapus listener canplay
                    this.tag.removeEventListener('canplay', this.onVideoCanPlay);
                })
                .catch((err) => {
                    // Autoplay diblock browser - tambahkan listener click sebagai fallback
                    console.warn(`[${this.name}] Autoplay blocked:`, err.message);
                    const resumeOnClick = () => {
                        this.tag.play().catch(() => { });
                        document.removeEventListener('click', resumeOnClick);
                    };
                    document.addEventListener('click', resumeOnClick, { once: true });
                });
        } else {
            this.tag.removeEventListener('canplay', this.onVideoCanPlay);
        }

        // Auto-create screenInfo dengan ukuran fixed 320x720
        setTimeout(() => {
            this.autoSetupScreenInfo();
        }, 100);
    }

    private autoSetupScreenInfo(): void {
        // console.log('[MsePlayer] autoSetupScreenInfo called');
        // Import yang diperlukan sudah ada di atas (ScreenInfo, Rect, Size)
        const ScreenInfo = require('../ScreenInfo').default;
        const Rect = require('../Rect').default;
        const Size = require('../Size').default;

        // Create screenInfo dengan ukuran fixed 320x720
        const fixedWidth = 320;
        const fixedHeight = 720;

        const screenInfo = new ScreenInfo(
            new Rect(0, 0, fixedWidth, fixedHeight),
            new Size(fixedWidth, fixedHeight),
            0
        );

        // console.log('[MsePlayer] Created screenInfo, calling setScreenInfo');
        // Set screen info agar touch handler bisa bekerja
        this.setScreenInfo(screenInfo);

        // console.log('[MsePlayer] Dispatching mse-screeninfo-ready event');
        // Dispatch custom event agar FeaturedInteractionHandler bisa di-init
        const event = new CustomEvent('mse-screeninfo-ready', {
            detail: { screenInfo }
        });
        window.dispatchEvent(event);
        // console.log('[MsePlayer] Event dispatched successfully');
    }

    protected calculateMomentumStats(): void {
        const stat = this.getVideoPlaybackQuality();
        if (!stat) {
            return;
        }

        const timestamp = Date.now();
        const oneSecondBefore = timestamp - 1000;
        this.videoStats.push(stat);

        while (this.videoStats.length && this.videoStats[0].timestamp < oneSecondBefore) {
            this.videoStats.shift();
        }
        while (this.inputBytes.length && this.inputBytes[0].timestamp < oneSecondBefore) {
            this.inputBytes.shift();
        }
        let inputBytes = 0;
        this.inputBytes.forEach((item) => {
            inputBytes += item.bytes;
        });
        const inputFrames = this.inputBytes.length;
        if (this.videoStats.length) {
            const oldest = this.videoStats[0];
            const decodedFrames = stat.decodedFrames - oldest.decodedFrames;
            const droppedFrames = stat.droppedFrames - oldest.droppedFrames;
            // const droppedFrames = inputFrames - decodedFrames;
            this.momentumQualityStats = {
                decodedFrames,
                droppedFrames,
                inputBytes,
                inputFrames,
                timestamp,
            };
        }
    }

    protected resetStats(): void {
        super.resetStats();
        this.videoStats = [];
    }

    public getImageDataURL(): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.tag.clientWidth;
        canvas.height = this.tag.clientHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(this.tag, 0, 0, canvas.width, canvas.height);
        }

        return canvas.toDataURL();
    }

    public play(): void {
        super.play();
        if (this.getState() !== BasePlayer.STATE.PLAYING) {
            return;
        }
        if (!this.converter) {
            let fps = MsePlayer.DEFAULT_FRAMES_PER_SECOND;
            if (this.videoSettings) {
                fps = this.videoSettings.maxFps;
            }
            // Option B: Reset state internal sebelum buat converter baru
            // Pastikan tidak ada frame/block lama yang antri dari session sebelumnya
            // sehingga stream baru selalu dimulai dalam kondisi bersih
            this.blocks = [];
            this.frames = [];
            this.waitUntilSegmentRemoved = false;
            this.jumpEnd = -1;
            this.seekingSince = -1;
            this.noDecodedFramesSince = -1;
            this.aheadOfBufferSince = -1;
            this.bigBufferSince = -1;
            this.converter = MsePlayer.createConverter(this.tag, fps, this.fpf);
            this.canPlay = false;
            this.resetStats();
        }
        this.converter.play();
        // Fix autoplay policy: coba play video tag segera
        // Browser bisa reject jika tidak ada interaksi user, tapi ini OK karena
        // onCanPlayHandler() akan handle saat video siap
        if (this.tag.paused && this.tag.readyState >= 2) {
            this.tag.play().catch(() => {
                // Diabaikan: akan coba lagi via onCanPlayHandler
            });
        }
    }

    public pause(): void {
        super.pause();
        this.stopConverter();
    }

    public stop(): void {
        super.stop();
        this.stopConverter();
    }

    public setVideoSettings(videoSettings: VideoSettings, fitToScreen: boolean, saveToStorage: boolean): void {
        if (this.videoSettings && this.videoSettings.maxFps !== videoSettings.maxFps) {
            const state = this.getState();
            if (this.converter) {
                this.stop();
                this.converter = MsePlayer.createConverter(this.tag, videoSettings.maxFps, this.fpf);
                this.canPlay = false;
            }
            if (state === BasePlayer.STATE.PLAYING) {
                this.play();
            }
        }
        super.setVideoSettings(videoSettings, fitToScreen, saveToStorage);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return MsePlayer.preferredVideoSettings;
    }

    // checkVideoResize = (): void => {
    //     if (!this.tag) {
    //         return;
    //     }
    //     const { videoHeight, videoWidth } = this.tag;
    //     if (this.videoHeight !== videoHeight || this.videoWidth !== videoWidth) {
    //         this.calculateScreenInfoForBounds(videoWidth, videoHeight);
    //     }
    // };
    cleanSourceBuffer = (): void => {
        if (!this.sourceBuffer) {
            return;
        }
        if (this.sourceBuffer.updating) {
            return;
        }
        if (this.blocks.length < 5) {
            return;
        }
        try {
            this.sourceBuffer.removeEventListener('updateend', this.cleanSourceBuffer);
            this.waitUntilSegmentRemoved = false;
            const removeStart = this.blocks[0].start;
            const removeEnd = this.blocks[2].end;
            this.blocks = this.blocks.slice(3);
            this.sourceBuffer.remove(removeStart, removeEnd);

            // PENTING: Jangan replay frames basi dari this.frames!
            // Frame-frame yang terkumpul selama waitUntilSegmentRemoved sudah stale
            // (bisa 200-500ms tertinggal). Buang saja, biarkan stream live langsung masuk.
            // Browser akan langsung render frame baru yang datang setelah ini.
            this.frames = [];
        } catch (error: any) {
            console.error(`[${this.name}]`, 'Failed to clean source buffer');
        }
    };

    jumpToEnd = (): void => {
        if (!this.sourceBuffer) {
            return;
        }
        if (this.sourceBuffer.updating) {
            return;
        }
        if (!this.tag.buffered.length) {
            return;
        }
        const end = this.tag.buffered.end(this.tag.seekable.length - 1);
        console.log(`[${this.name}]`, `Jumping to the end (${this.jumpEnd}, ${end - this.jumpEnd}).`);
        this.tag.currentTime = end;
        this.jumpEnd = -1;
        this.sourceBuffer.removeEventListener('updateend', this.jumpToEnd);
    };

    public pushFrame(frame: Uint8Array): void {
        super.pushFrame(frame);
        if (!this.checkForIFrame(frame)) {
            this.frames.push(frame);
        } else {
            this.checkForBadState();
        }
    }

    protected checkForBadState(): void {
        // Dipanggil setiap kali ada I-frame baru masuk.
        // Strategy: selalu jump ke buffered.end() agar menampilkan frame terbaru (live view, no delay).
        // Tidak pakai currentTimeNotChangedSince karena itu menyebabkan restart saat layar static.
        const { currentTime } = this.tag;
        const now = Date.now();
        let hasReasonToJump = false;

        // Check: ada frame masuk tapi tidak ada yang decoded (decoder stuck)
        if (this.momentumQualityStats) {
            if (this.momentumQualityStats.decodedFrames === 0 && this.momentumQualityStats.inputFrames > 0) {
                if (this.noDecodedFramesSince === -1) {
                    this.noDecodedFramesSince = now;
                } else {
                    const time = now - this.noDecodedFramesSince;
                    if (time > this.MAX_TIME_TO_RECOVER) {
                        hasReasonToJump = true;
                    }
                }
            } else {
                this.noDecodedFramesSince = -1;
            }
        }

        this.lastTime = currentTime;

        if (this.tag.buffered.length) {
            const end = this.tag.buffered.end(0);
            const buffered = end - currentTime;

            // Selalu jump ke end saat ada I-frame baru (MAX_BUFFER = 0)
            // Ini memastikan selalu menampilkan frame terbaru, bukan frame lama
            if (buffered > this.MAX_BUFFER) {
                hasReasonToJump = true;
                this.bigBufferSince = -1;
            } else {
                this.bigBufferSince = -1;
            }

            // Check: currentTime sudah melewati buffer end (ahead of buffer)
            if (buffered < this.MAX_AHEAD) {
                if (this.aheadOfBufferSince === -1) {
                    this.aheadOfBufferSince = now;
                } else {
                    const time = now - this.aheadOfBufferSince;
                    if (time > this.MAX_TIME_TO_RECOVER) {
                        hasReasonToJump = true;
                    }
                }
            } else {
                this.aheadOfBufferSince = -1;
            }

            if (!hasReasonToJump) {
                return;
            }

            // Jangan seek lagi kalau masih dalam proses seeking
            if (this.seekingSince !== -1) {
                const waitingForSeekEnd = now - this.seekingSince;
                if (waitingForSeekEnd < 800) {
                    return;
                }
            }

            const onSeekEnd = () => {
                this.seekingSince = -1;
                this.tag.removeEventListener('seeked', onSeekEnd);
                this.tag.play();
            };
            this.seekingSince = now;
            this.tag.addEventListener('seeked', onSeekEnd);
            // Jump ke ujung buffer = frame terbaru
            this.tag.currentTime = this.tag.buffered.end(0);
        }
    }

    protected checkForIFrame(frame: Uint8Array): boolean {
        if (!this.converter) {
            return false;
        }
        this.sourceBuffer = this.converter.sourceBuffer;
        if (BasePlayer.isIFrame(frame)) {
            let start = 0;
            let end = 0;
            if (this.tag.buffered && this.tag.buffered.length) {
                start = this.tag.buffered.start(0);
                end = this.tag.buffered.end(0);
            }
            if (end !== 0 && start < end) {
                const block: Block = {
                    start,
                    end,
                };
                this.blocks.push(block);
                // Option D: threshold >10 → >5 → cleanup lebih cepat dimulai
                // Kurangi waktu waitUntilSegmentRemoved aktif (frame drop lebih sedikit)
                if (this.blocks.length > 5) {
                    this.waitUntilSegmentRemoved = true;

                    this.sourceBuffer.addEventListener('updateend', this.cleanSourceBuffer);
                    this.converter.appendRawData(frame);
                    return true;
                }
            }
            // if (this.sourceBuffer) {
            //     this.sourceBuffer.onupdateend = this.checkVideoResize;
            // }
        }
        if (this.waitUntilSegmentRemoved) {
            return false;
        }

        this.converter.appendRawData(frame);
        return true;
    }

    private stopConverter(): void {
        if (this.converter) {
            this.converter.appendRawData(new Uint8Array([]));
            this.converter.pause();
            delete this.converter;
        }
        // Cleanup: reset buffer state
        this.blocks = [];
        this.frames = [];
        this.waitUntilSegmentRemoved = false;
        // Cleanup event listeners
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    public getFitToScreenStatus(): boolean {
        return MsePlayer.getFitToScreenStatus(this.udid, this.displayInfo);
    }

    public loadVideoSettings(): VideoSettings {
        return MsePlayer.loadVideoSettings(this.udid, this.displayInfo);
    }
}
