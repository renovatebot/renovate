/*
 * This file should be removed in future.
 */

declare interface Error {
  validationSource?: string;

  validationError?: string;
  validationMessage?: string;
}

// can't use `resolveJsonModule` because it will copy json files and change dist path

declare module '*/package.json' {
  type RenovatePackageJson = import('./types').RenovatePackageJson;
  const value: RenovatePackageJson;
  export = value;
}

declare module '*.json' {
  const value: Record<string, any>;
  export = value;
}
