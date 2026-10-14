import type { Pep621ManagerData } from '../pep621/types.ts';

export interface PoetryManagerData extends Pep621ManagerData {
  nestedVersion?: boolean;
  sourceName?: string;
}

export interface PoetrySection {
  dependencies: Record<string, PoetryDependency | string>;
  'dev-dependencies': Record<string, PoetryDependency | string>;
  extras: Record<string, PoetryDependency | string>;
  group: Record<string, PoetryGroup>;
  source?: PoetrySource[];
}

export interface PoetryFile {
  tool?: {
    poetry?: PoetrySection;
  };

  'build-system'?: {
    requires: string[];
    'build-backend'?: string;
  };
}

export interface PoetryDependency {
  path?: string;
  git?: string;
  tag?: string;
  version?: string;
  branch?: string;
  rev?: string;
}

export interface PoetrySource {
  name: string;
  url?: string;
}

export interface PoetryGroup {
  dependencies: Record<string, PoetryDependency | string>;
}

export interface PoetryLockSection {
  name?: string;
  version?: string;
}
