/*
 * This file should be removed in future.
 */

declare interface Error {
  location?: string;

  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    gitAuthor?: { name: string; email: string };
  }
}

// can't use `resolveJsonModule` because it will copy json files and change dist path

declare module '*/package.json' {
  import { PackageJson } from 'type-fest';
  const value: PackageJson & { 'engines-next': Record<string, string> };
  export = value;
}

declare module '*.json' {
  const value: Record<string, any>;
  export = value;
}
