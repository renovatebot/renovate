// original spec https://github.com/jsonnet-bundler/jsonnet-bundler/tree/master/spec/v1

export interface JsonnetFile {
  dependencies?: Dependency[];
}

export interface Dependency {
  source: Source;
  version: string;
  name?: string;
}

export interface Source {
  git?: GitSource;
}

export interface GitSource {
  remote: string;
  subdir?: string;
}
