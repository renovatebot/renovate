declare namespace Renovate {
  // TODO: refactor logger
  interface Logger {
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

// eslint-disable-next-line no-var, vars-on-top
declare var logger: Renovate.Logger;

declare interface Error {
  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    appMode?: boolean;
    gitAuthor?: { name: string; email: string };
    logger: Renovate.Logger;

    renovateVersion: string;
    // TODO: declare interface for all platforms
    platform: typeof import('./platform/github');
  }
}
