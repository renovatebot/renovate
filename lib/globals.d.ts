/*
 * This file should be removed in future.
 */

declare interface Error {
  configFile?: string;

  statusCode?: number;

  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    appMode?: boolean;
    gitAuthor?: { name: string; email: string };

    trustLevel?: string;
  }
}

// can't use `resolveJsonModule` because it will copy json files and change dist path
declare module '*.json' {
  const value: { version: string } & Record<string, any>;
  export = value;
}
