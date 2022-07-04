import type { SpawnOptions as ChildProcessSpawnOptions } from 'child_process';

export interface ToolConstraint {
  toolName: string;
  constraint?: string | null;
}

export interface ToolConfig {
  datasource: string;
  depName: string;
  hash?: boolean;
  versioning: string;
}

export type Opt<T> = T | null | undefined;

export type VolumesPair = [string, string];
export type VolumeOption = Opt<string | VolumesPair>;

export interface DockerOptions {
  image: string;
  tag?: Opt<string>;
  tagScheme?: Opt<string>;
  tagConstraint?: Opt<string>;
  volumes?: Opt<VolumeOption[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
}

// this will be renamed later on, left as is to minimize PR diff
export interface RawExecOptions extends ChildProcessSpawnOptions {
  encoding: string;
  maxBuffer?: number | undefined;
}

// this will be renamed later on, left as is to minimize PR diff
export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type ExtraEnv<T = unknown> = Record<string, T>;

// this will be renamed later on, left as is to minimize PR diff
export interface ExecOptions {
  cwd?: string;
  cwdFile?: string;
  env?: Opt<ExtraEnv>;
  extraEnv?: Opt<ExtraEnv>;
  docker?: Opt<DockerOptions>;
  toolConstraints?: Opt<ToolConstraint[]>;
  preCommands?: Opt<string[]>;
  // Following are pass-through to child process
  maxBuffer?: number | undefined;
  timeout?: number | undefined;
}
