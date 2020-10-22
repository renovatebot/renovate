export interface ManagerData {
  fileReplacePosition: number;
  packageFile?: string;
}

export interface VariableData extends ManagerData {
  key: string;
  value: string;
}

export type PackageVariables = Record<string, VariableData>;
