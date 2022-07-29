export type VariableContext = {
  val: string;
  sourceFile: string;
  lineIndex: number;
};
type Variables = Record<string, VariableContext>;

export interface ParseContext {
  scalaVersion?: string | null;
  localVariables: Variables; // variable within "object" scope ex.scalaVersion
  variables: Variables; // variable that can be use outside scope ex."Versions.ScalaVersion"
  lineIndex: number;
  lookupVariableFile?: string;
  depType?: string;
  readonly globalVariables: Variables; // variable from root and project/ folder
}

export interface ParseOptions {
  variableParentKey?: string;
  isMultiDeps?: boolean;
  scalaVersion?: string | null;
  variables?: Variables;
  localVariables?: Variables;
  readonly globalVariables?: Variables;
}

export type GroupFilenameContent = Record<
  string,
  { packageFile: string; content: string }[]
>;
