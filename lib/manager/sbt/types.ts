export interface ParseContext {
  scalaVersion: string;
  variables: any;
  depType?: string;
}

export interface ParseOptions {
  isMultiDeps?: boolean;
  scalaVersion?: string;
  variables?: Record<string, any>;
}
