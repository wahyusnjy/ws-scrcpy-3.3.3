// Paste this in Browser Console to debug video rendering issues

console.log('=== WS-SCRCPY VIDEO DEBUG ===');

// Check if video elements exist
const videos = document.querySelectorAll('video');
console.log(`Found ${videos.length} video element(s)`);
videos.forEach((video, index) => {
    console.log(`Video ${index}:`, {
        id: video.id,
        className: video.className,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        src: video.src || video.currentSrc,
        display: getComputedStyle(video).display,
        visibility: getComputedStyle(video).visibility,
        opacity: getComputedStyle(video).opacity,
        position: getComputedStyle(video).position
    });
});

// Check device-view container
const deviceViews = document.querySelectorAll('.device-view');
console.log(`Found ${deviceViews.length} device-view(s)`);
deviceViews.forEach((dv, index) => {
    console.log(`Device View ${index}:`, {
        className: dv.className,
        clientWidth: dv.clientWidth,
        clientHeight: dv.clientHeight,
        display: getComputedStyle(dv).display,
        visibility: getComputedStyle(dv).visibility
    });
});

// Check .video containers
const videoContainers = document.querySelectorAll('.video');
console.log(`Found ${videoContainers.length} video container(s)`);
videoContainers.forEach((vc, index) => {
    console.log(`Video Container ${index}:`, {
        className: vc.className,
        clientWidth: vc.clientWidth,
        clientHeight: vc.clientHeight,
        children: vc.children.length,
        display: getComputedStyle(vc).display
    });
});

// Check for MediaSource
if (typeof MediaSource !== 'undefined') {
    console.log('MediaSource supported:', MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'));
} else {
    console.error('MediaSource NOT supported!');
}

// Check WebSocket connections
console.log('Performance entries (WebSocket):');
performance.getEntriesByType('resource').filter(e => e.name.includes('ws:')).forEach(e => {
    console.log(e.name, e);
});

console.log('=== END DEBUG ===');
