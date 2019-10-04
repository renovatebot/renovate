export interface PoetrySection {
  dependencies: Record<string, PoetryDependency | string>;
  'dev-dependencies': Record<string, PoetryDependency | string>;
  extras: Record<string, PoetryDependency | string>;
  source?: PoetrySource[];
}

export interface PoetryFile {
  tool?: {
    poetry?: PoetrySection;
  };
}

export interface PoetryDependency {
  path?: string;
  git?: string;
  version?: string;
}

export interface PoetrySource {
  name?: string;
  url?: string;
}
