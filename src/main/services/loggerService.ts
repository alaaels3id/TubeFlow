import { app, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import util from 'node:util';

export class LoggerService {
  private logDir: string;
  private logFile: string;
  private oldLogFile: string;
  private maxFileSize = 5 * 1024 * 1024; // 5MB limit before rotation

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.oldLogFile = path.join(this.logDir, 'app.old.log');
    this.ensureDir();
    this.initConsoleInterception();
    this.initGlobalExceptionHandlers();
    this.info('SYSTEM', `TubeFlow logging initialized. Log file: ${this.logFile}`);
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      process.stderr.write(`Failed to create log directory: ${e}\n`);
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxFileSize) {
          if (fs.existsSync(this.oldLogFile)) {
            fs.unlinkSync(this.oldLogFile);
          }
          fs.renameSync(this.logFile, this.oldLogFile);
        }
      }
    } catch (e) {
      // Ignore rotation errors
    }
  }

  private formatMessage(level: string, source: string, ...args: any[]): string {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').replace('Z', '');
    const formattedArgs = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.stack || `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return util.inspect(arg, { depth: 3 });
          }
        }
        return String(arg);
      })
      .join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] [${source}] ${formattedArgs}\n`;
  }

  public write(level: string, source: string, ...args: any[]): void {
    try {
      this.rotateIfNeeded();
      const line = this.formatMessage(level, source, ...args);
      fs.appendFileSync(this.logFile, line, 'utf-8');
    } catch (err) {
      process.stderr.write(`Failed to append to log file: ${err}\n`);
    }
  }

  public info(source: string, ...args: any[]): void {
    this.write('INFO', source, ...args);
  }

  public warn(source: string, ...args: any[]): void {
    this.write('WARN', source, ...args);
  }

  public error(source: string, ...args: any[]): void {
    this.write('ERROR', source, ...args);
  }

  public debug(source: string, ...args: any[]): void {
    this.write('DEBUG', source, ...args);
  }

  public getLogFilePath(): string {
    return this.logFile;
  }

  public getLogDirPath(): string {
    return this.logDir;
  }

  public openLogsFolder(): boolean {
    try {
      this.ensureDir();
      if (!fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '', 'utf-8');
      }
      shell.showItemInFolder(this.logFile);
      return true;
    } catch (e) {
      this.error('LOGGER', 'Failed to open logs folder', e);
      return false;
    }
  }

  public readRecentLogs(lines: number = 100): string {
    try {
      if (fs.existsSync(this.logFile)) {
        const content = fs.readFileSync(this.logFile, 'utf-8');
        const split = content.trim().split('\n');
        return split.slice(-lines).join('\n');
      }
      return 'No logs recorded yet.';
    } catch (e) {
      return `Failed to read log file: ${e}`;
    }
  }

  private initConsoleInterception(): void {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const origInfo = console.info;

    console.log = (...args: any[]) => {
      origLog.apply(console, args);
      this.write('INFO', 'MAIN', ...args);
    };

    console.info = (...args: any[]) => {
      origInfo.apply(console, args);
      this.write('INFO', 'MAIN', ...args);
    };

    console.warn = (...args: any[]) => {
      origWarn.apply(console, args);
      this.write('WARN', 'MAIN', ...args);
    };

    console.error = (...args: any[]) => {
      origError.apply(console, args);
      this.write('ERROR', 'MAIN', ...args);
    };
  }

  private initGlobalExceptionHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.error('EXCEPTION', 'Uncaught Exception in Main Process:', error);
      process.stderr.write(`[CRITICAL] Uncaught Exception: ${error?.stack || error}\n`);
    });

    process.on('unhandledRejection', (reason) => {
      this.error('EXCEPTION', 'Unhandled Promise Rejection in Main Process:', reason);
      process.stderr.write(`[CRITICAL] Unhandled Rejection: ${reason}\n`);
    });
  }
}

export const loggerService = new LoggerService();
