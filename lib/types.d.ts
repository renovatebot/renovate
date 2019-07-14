declare namespace Renovate {}

declare interface Error {
  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    appMode?: boolean;
    gitAuthor?: { name: string; email: string };
    renovateError?: boolean;
    renovateVersion: string;
    // TODO: declare interface for all platforms
    platform: typeof import('./platform/github');
  }
}
