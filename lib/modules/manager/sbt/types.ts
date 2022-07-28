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
  readonly globalVariables: Variables;
}

export interface ParseOptions {
  variableParentKey?: string;
  isMultiDeps?: boolean;
  scalaVersion?: string | null;
  variables?: Variables;
  readonly globalVariables?: Variables;
}

export type GroupFilenameContent = Record<
  string,
  { packageFile: string; content: string }[]
>;
