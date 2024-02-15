export interface GetRegistryUrlVarsResult {
  haveCredentials: boolean;
  environmentVars: {
    PIP_INDEX_URL?: string;
    PIP_EXTRA_INDEX_URL?: string;
  };
}

// managers supported by pip-tools Python package
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
