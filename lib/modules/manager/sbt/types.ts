export interface ParseContext {
  scalaVersion?: string | null;
  variables: Record<
    string,
    { val: string; sourceFile: string; lineIndex: number }
  >;
  lineIndex: number;
  lookupVariableFile?: string;
  depType?: string;
}

export interface ParseOptions {
  isMultiDeps?: boolean;
  scalaVersion?: string | null;
  variables?: Record<
    string,
    { val: string; sourceFile: string; lineIndex: number }
  >;
}
