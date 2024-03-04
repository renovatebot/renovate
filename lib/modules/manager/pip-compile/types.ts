// managers supported by pip-tools mapped to Renovate's internal names
export type SupportedManagers =
  | 'pip_requirements'
  | 'pip_setup'
  | 'setup-cfg'
  | 'pep621';

export interface PipCompileArgs {
  argv: string[]; // all arguments as a list
  command: string;
  isCustomCommand: boolean;
  constraintsFiles?: string[];
  extra?: string[];
  allExtras?: boolean;
  extraIndexUrl?: string[];
  indexUrl?: string;
  noEmitIndexUrl?: boolean;
  emitIndexUrl?: boolean;
  outputFile?: string;
  sourceFiles: string[]; // positional arguments
}

export interface DependencyBetweenFiles {
  sourceFile: string;
  outputFile: string;
  type: 'requirement' | 'constraint';
}
