import type { SpawnOptions as ChildProcessSpawnOptions } from 'node:child_process';

export interface ToolConstraint {
  toolName: string;
  constraint?: string | null;
}

export interface ToolConfig {
  datasource: string;
  extractVersion?: string;
  packageName: string;
  hash?: boolean;
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

export interface RawExecOptions extends ChildProcessSpawnOptions {
  // TODO: to be removed in #16655
  /**
   * @deprecated renovate uses utf8, encoding property is ignored.
   */
  encoding: string;
  maxBuffer?: number | undefined;
  cwd?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
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
}
