/*
 * This file should be removed in future.
 */

declare interface Error {
  /** Where the error is, or several places, such as when several presets could not be resolved. */
  validationSource?: string | string[];

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

// make typescript happy
declare module 'source-map-support/register.js';
