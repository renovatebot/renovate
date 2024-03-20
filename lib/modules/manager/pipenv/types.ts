export interface PipSource {
  name: string;
  url: string;
}

export interface PipFile {
  source: PipSource[];

  packages?: Record<string, PipRequirement>;
  'dev-packages'?: Record<string, PipRequirement>;

  requires?: Record<string, string>;

  [index: string]:
    | undefined
    | PipSource[]
    | Record<string, string>
    | Record<string, PipRequirement>;
}

export interface PipRequirement {
  index?: string;
  version?: string;
  path?: string;
  file?: string;
  git?: string;
}
