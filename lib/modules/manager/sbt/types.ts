export type VariableContext = {
  val: string;
  packageFile: string;
  lineNumber: number;
};
export type Variables = Record<string, VariableContext>;

export type GroupFilenameContent = Record<
  string,
  { packageFile: string; content: string }[]
>;

export interface ParseOptions {
  scalaVersion?: string;
  localVars?: Variables;
  globalVars?: Variables;
}

export interface SbtManagerData {
  lineNumber?: number;
  packageFile?: string;
}
