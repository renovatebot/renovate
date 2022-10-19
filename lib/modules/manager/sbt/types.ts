export interface ParseContext {
  scalaVersion?: string | null;
  variables: Record<string, any>;
  depType?: string;
}

export interface ParseOptions {
  isMultiDeps?: boolean;
  scalaVersion?: string | null;
  variables?: Record<string, any>;
}
