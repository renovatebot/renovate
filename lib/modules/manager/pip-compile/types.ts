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
