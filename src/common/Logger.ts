import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export class Logger {
    private static logFile: string = '';
    private static logStream: fs.WriteStream | null = null;
    private static currentLogLevel: LogLevel = LogLevel.DEBUG;

    // ANSI color codes
    private static colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        bgRed: '\x1b[41m',
        bgYellow: '\x1b[43m',
    };

    public static init(logDir?: string): void {
        if (logDir) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `ws-scrcpy-${timestamp}.log`;
            this.logFile = path.join(logDir, fileName);

            // Create directory if it doesn't exist
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
            this.info('Logger', `Logging to file: ${this.logFile}`);
        }
    }

    public static setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
    }

    private static formatTimestamp(): string {
        const now = new Date();
        return now.toISOString();
    }

    private static writeToFile(message: string): void {
        if (this.logStream) {
            // Remove ANSI color codes for file logging
            const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
            this.logStream.write(cleanMessage + '\n');
        }
    }

    private static log(level: LogLevel, tag: string, ...args: any[]): void {
        if (level < this.currentLogLevel) {
            return;
        }

        const timestamp = this.formatTimestamp();
        let levelStr = '';
        let color = this.colors.reset;

        switch (level) {
            case LogLevel.DEBUG:
                levelStr = 'DEBUG';
                color = this.colors.dim + this.colors.cyan;
                break;
            case LogLevel.INFO:
                levelStr = 'INFO ';
                color = this.colors.green;
                break;
            case LogLevel.WARN:
                levelStr = 'WARN ';
                color = this.colors.yellow;
                break;
            case LogLevel.ERROR:
                levelStr = 'ERROR';
                color = this.colors.red + this.colors.bright;
                break;
        }

        const tagColor = this.colors.magenta;
        const timeColor = this.colors.dim + this.colors.white;

        const formattedMessage = `${timeColor}[${timestamp}]${this.colors.reset} ${color}[${levelStr}]${this.colors.reset} ${tagColor}[${tag}]${this.colors.reset} ${args.join(' ')}`;

        console.log(formattedMessage);
        this.writeToFile(`[${timestamp}] [${levelStr}] [${tag}] ${args.join(' ')}`);
    }

    public static debug(tag: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, tag, ...args);
    }

    public static info(tag: string, ...args: any[]): void {
        this.log(LogLevel.INFO, tag, ...args);
    }

    public static warn(tag: string, ...args: any[]): void {
        this.log(LogLevel.WARN, tag, ...args);
    }

    public static error(tag: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, tag, ...args);
    }

    public static separator(): void {
        const line = this.colors.dim + '═'.repeat(80) + this.colors.reset;
        console.log(line);
        this.writeToFile('═'.repeat(80));
    }

    public static section(title: string): void {
        this.separator();
        const centeredTitle = ` ${title} `;
        const padding = Math.floor((80 - centeredTitle.length) / 2);
        const line = '═'.repeat(padding) + centeredTitle + '═'.repeat(80 - padding - centeredTitle.length);
        console.log(this.colors.bright + this.colors.cyan + line + this.colors.reset);
        this.writeToFile(line);
        this.separator();
    }

    public static close(): void {
        if (this.logStream) {
            this.logStream.end();
            this.logStream = null;
        }
    }
}
