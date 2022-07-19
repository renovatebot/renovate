export type VariableContext = {
  val: string;
  sourceFile: string;
  lineIndex: number;
};
type Variables = Record<string, VariableContext>;

export interface ParseContext {
  scalaVersion?: string | null;
  variables: Variables;
  lineIndex: number;
  lookupVariableFile?: string;
  depType?: string;
}

export interface ParseOptions {
  isMultiDeps?: boolean;
  scalaVersion?: string | null;
  variables?: Variables;
}

export type MapFilenameContent = Record<string, string>;
