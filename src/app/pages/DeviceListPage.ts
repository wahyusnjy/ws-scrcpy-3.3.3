import { HostTracker } from '../client/HostTracker';
import { DeviceTracker } from '../googDevice/client/DeviceTracker';
import '../../style/devicelist.css';

export class DeviceListPage {
    private static runningDevices = new Set<string>();

    public static start(): void {
        const container = document.getElementById('device-list');
        if (!container) return;

        // Jalankan pelacakan host
        HostTracker.start();

        // Polling untuk mendeteksi HP baru
        setInterval(() => {
            // @ts-ignore
            const instances = DeviceTracker.instancesByUrl;
            if (!instances) return;

            instances.forEach((tracker: any) => {
                if (!tracker.descriptors) return;

                tracker.descriptors.forEach((device: any) => {
                    if (device.state === 'device' && !this.runningDevices.has(device.udid)) {
                        this.addDeviceIframe(device, tracker.params, container);
                    }
                });
            });
        }, 2000);
    }

    private static addDeviceIframe(device: any, params: any, gridContainer: HTMLElement): void {
        const udid = device.udid;
        this.runningDevices.add(udid);

        // Buat Card untuk HP
        const card = document.createElement('div');
        card.className = 'device-card';
        
        // Header Card (Nama HP)
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `
            <div class="status-dot"></div>
            <span class="device-name">${device['ro.product.model']}</span>
            <span class="device-serial">${udid}</span>
        `;
        
        // Iframe untuk Stream
        // Kita gunakan URL asli ws-scrcpy dengan parameter yang sesuai
        const iframe = document.createElement('iframe');
        const baseUrl = window.location.origin + window.location.pathname.replace('devices.html', 'index.html');
        
        // Construct the hash parameters
        const q = new URLSearchParams({
            action: 'stream',
            udid: udid,
            player: 'mse',
            ws: `ws://${window.location.host}/?action=proxy-adb&remote=tcp:8886&udid=${udid}`
        });

        iframe.src = `${baseUrl}#!${q.toString()}`;
        iframe.className = 'stream-iframe';
        
        card.appendChild(header);
        card.appendChild(iframe);
        gridContainer.appendChild(card);
    }
}

window.onload = () => {
    DeviceListPage.start();
};