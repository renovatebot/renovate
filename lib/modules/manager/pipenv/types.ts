export interface PipSource {
  name: string;
  url: string;
}

export interface PipFile {
  source: PipSource[];

  packages?: Record<string, PipRequirement>;
  'dev-packages'?: Record<string, PipRequirement>;

  requires?: Record<string, string>;

  /* Elements not defined above are always PipRequirement records
   * however Typescript requires us to enumerate all possible types on all possible keys.
   */
  [index: string]:
    | undefined
    | PipSource[]
    | Record<string, string>
    | Record<string, PipRequirement>;
}

export type PipRequirement =
  | string
  | {
      index?: string;
      version?: string;
      path?: string;
      file?: string;
      git?: string;
    };

export interface PipfileLock {
  _meta?: {
    requires?: {
      python_version?: string;
      python_full_version?: string;
    };
  };
  default?: Record<string, { version?: string }>;
  develop?: Record<string, { version?: string }>;
}
