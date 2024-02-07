// managers supported by pip-tools Python package
export type SupportedManagers =
  | 'pip_requirements'
  | 'pip_setup'
  | 'setup-cfg'
  | 'pep621';

export interface PipCompileArgs {
  command: string;
  isCustomCommand: boolean;
  indexUrl?: string;
  extraIndexUrl?: string[];
  outputFile?: string;
  extra?: string[];
  constraintFiles?: string[];
  sourceFiles: string[]; // positional arguments
  argv: string[]; // all arguments as a list
}

export interface DependencyBetweenFiles {
  sourceFile: string;
  outputFile: string;
  type: 'requirement' | 'constraint';
}
