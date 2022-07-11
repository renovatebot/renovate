export interface ProviderLock {
  packageName: string;
  registryUrl: string;
  version: string;
  constraints: string;
  hashes: string[];
  lineNumbers: LineNumbers;
}

export interface ProviderLockUpdate extends ProviderLock {
  newVersion: string;
  newConstraint: string;
  newHashes: string[];
}

export interface ProviderSlice {
  lines: string[];
  block: {
    start: number;
    end: number;
  };
}

export interface LineNumbers {
  version?: number;
  constraint?: number;
  block?: {
    start: number;
    end: number;
  };
  hashes: {
    start?: number;
    end?: number;
  };
}
