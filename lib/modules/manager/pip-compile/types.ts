export interface PipCompileArgs {
  command: string;
  isCustomCommand: boolean;
  outputFile?: string;
  extra?: string[];
  constraint?: string[];
  sourceFiles: string[]; // positional arguments
  argv: string[]; // all arguments as a list
}
