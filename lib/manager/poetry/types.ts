export interface PoetrySection {
  dependencies: Record<string, PoetryDependency | string>;
  'dev-dependencies': Record<string, PoetryDependency | string>;
  extras: Record<string, PoetryDependency | string>;
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
