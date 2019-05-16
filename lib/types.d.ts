declare namespace Renovate {
  // TODO: refactor logger
  interface ILogger {
    trace(...args: any[]): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    fatal(...args: any[]): void;
    child(...args: any[]): void;

    setMeta(obj: any): void;
  }
}

declare var logger: Renovate.ILogger;

declare interface Error {
  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    gitAuthor?: { name: string; email: string };
    logger: Renovate.ILogger;
  }
}
