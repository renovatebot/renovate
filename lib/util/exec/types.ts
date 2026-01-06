import type { Options as ExecaOptions } from 'execa';

export interface ToolConstraint {
  toolName: string;
  constraint?: string | null;
}

export interface ToolConfig {
  datasource: string;
  extractVersion?: string;
  packageName: string;
  versioning: string;
}

export type Opt<T> = T | null | undefined;

export type VolumesPair = [string, string];
export type VolumeOption = Opt<string | VolumesPair>;

export interface DockerOptions {
  volumes?: Opt<VolumeOption[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
}

export type DataListener = (chunk: any) => void;
export interface OutputListeners {
  stdout?: DataListener[];
  stderr?: DataListener[];
}

export interface RawExecOptions extends ExecaOptions {
  maxBuffer?: number | undefined;
  cwd?: string;
  outputListeners?: OutputListeners;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  /**
   * The process' exit code in the case of a failure.
   *
   * This is only set if using `ignoreFailure` when executing a command
   *
   */
  exitCode?: number;
}

export type ExtraEnv<T = unknown> = Record<string, T>;

export interface ExecOptions {
  cwd?: string;
  cwdFile?: string;
  env?: Opt<ExtraEnv>;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
  toolConstraints?: Opt<ToolConstraint[]>;
  preCommands?: Opt<string[]>;
  ignoreStdout?: boolean;
  // Following are pass-through to child process
  maxBuffer?: number | undefined;
  timeout?: number | undefined;
  shell?: boolean | string | undefined;
}

/**
 * configuration that can be configured on a per-command basis, that doesn't make sense to be on the `RawExecOptions`
 */
export interface CommandWithOptions {
  command: string[];

  /** do not throw errors when a command fails, but do log that an error occurred */
  ignoreFailure?: boolean;
}
