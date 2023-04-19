export type VariableContext = {
  val: string;
  sourceFile: string;
  lineIndex: number;
};
export type Variables = Record<string, VariableContext>;

export type GroupFilenameContent = Record<
  string,
  { packageFile: string; content: string }[]
>;

export interface ParseOptions {
  packageFile?: string;
  isMultiDeps?: boolean;
  scalaVersion?: string;
  localVars: Variables;
  readonly globalVars: Variables;
}
