import '../../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../../vendor/Genymobile/scrcpy/LICENSE';

import { Device } from './Device';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_PROCESS_NAME, SERVER_VERSION } from '../../common/Constants';
import { Logger } from '../../common/Logger';
import path from 'path';
import PushTransfer from '@dead50f7/adbkit/lib/adb/sync/pushtransfer';
import { ServerVersion } from './ServerVersion';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, 'vendor/Genymobile/scrcpy');
const FILE_NAME = 'scrcpy-server.jar';
const RUN_COMMAND = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;
const TAG = 'ScrcpyServer';

type WaitForPidParams = { tryCounter: number; processExited: boolean; lookPidFile: boolean };

export class ScrcpyServer {
    private static PID_FILE_PATH = '/data/local/tmp/ws_scrcpy.pid';
    private static async copyServer(device: Device): Promise<PushTransfer> {
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        Logger.info(TAG, `[${device.udid}] Copying server JAR from ${src} to ${dst}`);
        try {
            const transfer = await device.push(src, dst);
            Logger.info(TAG, `[${device.udid}] ✓ Server JAR copied successfully`);
            return transfer;
        } catch (error: any) {
            Logger.error(TAG, `[${device.udid}] ✗ Failed to copy server JAR:`, error.message);
            throw error;
        }
    }

    // Important to notice that we first try to read PID from file.
    // Checking with `.getServerPid()` will return process id, but process may stop.
    // PID file only created after WebSocket server has been successfully started.
    private static async waitForServerPid(device: Device, params: WaitForPidParams): Promise<number[] | undefined> {
        const { tryCounter, processExited, lookPidFile } = params;
        if (processExited) {
            Logger.warn(TAG, `[${device.udid}] Server process exited before PID was obtained`);
            return;
        }
        const timeout = 500 + 100 * tryCounter;
        Logger.debug(TAG, `[${device.udid}] Waiting for server PID (attempt ${tryCounter + 1}/6, timeout ${timeout}ms)`);

        if (lookPidFile) {
            const fileName = ScrcpyServer.PID_FILE_PATH;
            const content = await device.runShellCommandAdbKit(`test -f ${fileName} && cat ${fileName}`);
            if (content.trim()) {
                const pid = parseInt(content, 10);
                if (pid && !isNaN(pid)) {
                    Logger.debug(TAG, `[${device.udid}] Found PID in file: ${pid}`);
                    const realPid = await this.getServerPid(device);
                    if (realPid?.includes(pid)) {
                        Logger.info(TAG, `[${device.udid}] ✓ Server PID confirmed: ${pid}`);
                        return realPid;
                    } else {
                        Logger.warn(TAG, `[${device.udid}] PID ${pid} from file not found in process list`);
                        params.lookPidFile = false;
                    }
                }
            } else if (tryCounter >= 2) {
                // PID file tidak muncul setelah 2 attempt — server mungkin tidak
                // menulis PID file (custom JAR). Fallback ke process detection.
                Logger.warn(TAG, `[${device.udid}] PID file not found after ${tryCounter + 1} attempts, switching to process detection`);
                params.lookPidFile = false;
            }
        } else {
            const list = await this.getServerPid(device);
            if (Array.isArray(list) && list.length) {
                Logger.info(TAG, `[${device.udid}] ✓ Found server PID(s): ${list.join(', ')}`);
                return list;
            }
        }
        if (++params.tryCounter > 5) {
            Logger.error(TAG, `[${device.udid}] ✗ TIMEOUT: Failed to start server after 5 attempts`);
            throw new Error('Failed to start server - timeout waiting for PID');
        }
        return new Promise<number[] | undefined>((resolve) => {
            setTimeout(() => {
                resolve(this.waitForServerPid(device, params));
            }, timeout);
        });
    }

    public static async getServerPid(device: Device): Promise<number[] | undefined> {
        if (!device.isConnected()) {
            Logger.warn(TAG, `[${device.udid}] Device not connected, cannot get server PID`);
            return;
        }
        Logger.debug(TAG, `[${device.udid}] Searching for process: ${SERVER_PROCESS_NAME}`);
        const list = await device.getPidOf(SERVER_PROCESS_NAME);
        if (!Array.isArray(list) || !list.length) {
            return;
        }
        const serverPid: number[] = [];
        const promises = list.map((pid) => {
            return device.runShellCommandAdbKit(`cat /proc/${pid}/cmdline`).then((output) => {
                const args = output.split('\0');
                if (!args.length || args[0] !== SERVER_PROCESS_NAME) {
                    return;
                }
                let first = args[0];
                while (args.length && first !== SERVER_PACKAGE) {
                    args.shift();
                    first = args[0];
                }
                if (args.length < 3) {
                    return;
                }
                const versionString = args[1];
                if (versionString === SERVER_VERSION) {
                    Logger.debug(TAG, `[${device.udid}] Found matching server version ${versionString} (PID: ${pid})`);
                    serverPid.push(pid);
                } else {
                    Logger.warn(TAG, `[${device.udid}] Version mismatch: expected ${SERVER_VERSION}, found ${versionString} (PID: ${pid})`);
                    const currentVersion = new ServerVersion(versionString);
                    if (currentVersion.isCompatible()) {
                        const desired = new ServerVersion(SERVER_VERSION);
                        if (desired.gt(currentVersion)) {
                            Logger.warn(TAG, `[${device.udid}] Found old server version (PID: ${pid}, Version: ${versionString})`);
                            Logger.info(TAG, `[${device.udid}] Killing old server process ${pid}`);
                            device.killProcess(pid);
                        }
                    }
                }
                return;
            });
        });
        await Promise.all(promises);
        return serverPid;
    }

    public static async run(device: Device): Promise<number[] | undefined> {
        Logger.section(`Starting scrcpy server for device ${device.udid}`);
        Logger.info(TAG, `[${device.udid}] Server version: ${SERVER_VERSION}`);
        Logger.info(TAG, `[${device.udid}] Server port: ${ARGS_STRING.match(/\d{4,5}/)?.[0] || 'unknown'}`);

        if (!device.isConnected()) {
            Logger.error(TAG, `[${device.udid}] ✗ Device not connected`);
            return;
        }

        let list: number[] | string | undefined = await this.getServerPid(device);
        if (Array.isArray(list) && list.length) {
            Logger.info(TAG, `[${device.udid}] ✓ Server already running with PID(s): ${list.join(', ')}`);
            return list;
        }
        await this.copyServer(device);

        Logger.info(TAG, `[${device.udid}] Executing command: ${RUN_COMMAND}`);
        Logger.separator();

        const params: WaitForPidParams = { tryCounter: 0, processExited: false, lookPidFile: true };
        const runPromise = device.runShellCommandAdb(RUN_COMMAND);
        runPromise
            .then((out) => {
                if (device.isConnected()) {
                    console.log(device.TAG, 'Server exited:', out);
                }
            })
            .catch((e) => {
                console.log(device.TAG, 'Error:', e.message);
            })
            .finally(() => {
                params.processExited = true;
            });
        list = await Promise.race([runPromise, this.waitForServerPid(device, params)]);
        if (Array.isArray(list) && list.length) {
            Logger.info(TAG, `[${device.udid}] ✓ Server started successfully with PID(s): ${list.join(', ')}`);
            Logger.separator();
            return list;
        }
        Logger.error(TAG, `[${device.udid}] ✗ Failed to start server - no PID obtained`);
        Logger.separator();
        return;
    }
}
