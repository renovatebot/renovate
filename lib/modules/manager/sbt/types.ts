export type VariableContext = {
  value: string;
  packageFile: string;
  lineNumber: number;
};
export type Variables = Record<string, VariableContext>;

export type GroupFilenameContent = Record<
  string,
  { packageFile: string; content: string }[]
>;

export interface SbtManagerData {
  lineNumber?: number;
  packageFile?: string;
}
