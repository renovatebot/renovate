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

// ESM subpath import declarations for packages without proper exports field
declare module 'protobufjs/minimal' {
  export * from 'protobufjs';
}

declare module 'azure-devops-node-api/CoreApi' {
  export * from 'azure-devops-node-api/CoreApi.js';
}

declare module 'azure-devops-node-api/GitApi' {
  export * from 'azure-devops-node-api/GitApi.js';
}

declare module 'azure-devops-node-api/PolicyApi' {
  export * from 'azure-devops-node-api/PolicyApi.js';
}

declare module 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces' {
  export * from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js';
}

declare module 'azure-devops-node-api/interfaces/common/VSSInterfaces' {
  export * from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
}

declare module 'azure-devops-node-api/interfaces/GitInterfaces' {
  export * from 'azure-devops-node-api/interfaces/GitInterfaces.js';
}

declare module 'azure-devops-node-api/interfaces/PolicyInterfaces' {
  export * from 'azure-devops-node-api/interfaces/PolicyInterfaces.js';
}

declare module 'eslint-plugin-file-extension-in-import-ts' {
  import type { ESLint } from 'eslint';
  const plugin: ESLint.Plugin;
  export default plugin;
}
