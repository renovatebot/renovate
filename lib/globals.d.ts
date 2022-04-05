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

declare module 'ssh-agent-js' {
  class Agent {
    constructor(socket: any);
    add_key(key: string);
    remove_all_keys();
  }
}

declare module 'tmp' {
  function fileSync();

  class FileSyncObject {
    name: string;
  }
}
