import fs from 'fs';
import path from 'path';

enum LogLevel {
  LOG = 'LOG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

class Logger {
  outStream: fs.WriteStream | null = null;

  constructor() {
    const now = formatDate();
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    const logFilePath = path.join(logDir, `${now}.log`);
    this.outStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    this.registerErrorHandlers();
  }

  formatMessage(level: LogLevel, ...data: any[]) {
    return `[${level}]\t${formatDate()}\t${data.join(' ')}\n`;
  }

  writeToFile(level: LogLevel, ...data: any[]) {
    if (!this.outStream) return Promise.resolve();
    const { promise, resolve, reject } = Promise.withResolvers();
    const logEntry = this.formatMessage(level, ...data);
    this.outStream.write(logEntry, (err) => err ? reject(err) : resolve());
    return promise;
  }

  close(finalMessage = 'Closing logger.') {
    if (!this.outStream) return Promise.resolve();
    this.unregisterErrorHandlers();
    const { promise, resolve } = Promise.withResolvers();
    this.outStream.end(this.formatMessage(LogLevel.INFO, finalMessage), resolve);
    this.outStream = null;
    return promise;
  }

  uncaughtExceptionHandler(err: { stack: any; toString: () => any; }) {
    this.error('Uncaught Exception:', err.stack || err.toString());
  }

  unhandledRejectionHandler(reason: { stack: any; }, promise: any) {
    this.error('Unhandled Rejection at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
  }

  registerErrorHandlers() {
    process.on('uncaughtException', this.uncaughtExceptionHandler.bind(this));
    process.on('unhandledRejection', this.unhandledRejectionHandler.bind(this));
  }

  unregisterErrorHandlers() {
    process.off('uncaughtException', this.uncaughtExceptionHandler.bind(this));
    process.off('unhandledRejection', this.unhandledRejectionHandler.bind(this));
  }
  
  //#region Logging methods
  log(...data: any[]) {
    console.log(...data);
    return this.writeToFile(LogLevel.LOG, ...data);
  }

  info(...data: any[]) {
    console.info(...data);
    return this.writeToFile(LogLevel.INFO, ...data);
  }

  warn(...data: any[]) {
    console.warn(...data);
    return this.writeToFile(LogLevel.WARN, ...data);
  }

  error(...data: string[]) {
    console.error(...data);
    return this.writeToFile(LogLevel.ERROR, ...data);
  }

  debug(...data: any[]) {
    console.debug(...data);
    return this.writeToFile(LogLevel.DEBUG, ...data);
  }

  assert(condition: boolean, ...data: any[]) {
    if (!condition) {
      console.assert(condition, ...data);
      return this.writeToFile(LogLevel.ERROR, 'Assertion failed:', ...data);
    }
  }
  //#endregion
}

function formatDate() {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}Z`;
}

const logDisabled = process.argv.includes('-n') || process.argv.includes('--noLogs');
if (logDisabled) console.log('Logging disabled by command line argument.');
export default logDisabled ? console : new Logger();
