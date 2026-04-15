import { isString } from '@sindresorhus/is';
import type { Options as ExecaOptions } from 'execa';

/**
 * A `tool` that Containerbase supports.
 *
 * TODO #41849 replace with upstream types
 */
const toolNames = [
  'bazelisk',
  'bun',
  'bundler',
  'cocoapods',
  'composer',
  'conan',
  'copier',
  'corepack',
  'devbox',
  'dotnet',
  'erlang',
  'elixir',
  'flux',
  'gleam',
  'golang',
  'gradle',
  'hashin',
  'helm',
  'helmfile',
  'java',
  'java-maven',
  'jb',
  'kustomize',
  'maven',
  'nix',
  'node',
  'npm',
  'pdm',
  'php',
  'pip-tools',
  'pipenv',
  'pnpm',
  'pixi',
  'poetry',
  'python',
  'ruby',
  'rust',
  'uv',
  'yarn',
  'yarn-slim',
  'dart',
  'flutter',
  'vendir',
] as const;

export type ToolName = (typeof toolNames)[number];

export function isToolName(value: unknown): value is ToolName {
  return isString(value) && toolNames.includes(value as ToolName);
}

/**
 * Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports.
 */
const additionalConstraintNames = [
  /**
   * Used in the `gomod` manager to specify the version of the Go toolchain to use.
   *
   * In precedence order:
   *
   * 1. config: `constraints.go`
   * 1. `go.mod`: `toolchain` directive
   * 1. `go.mod`: `go` directive
   *
   * NOTE that the `constraints.golang` is not used (https://github.com/renovatebot/renovate/issues/42601)
   *
   * @deprecated TODO remove in #42600
   */
  'go',
  /**
   * Used in the `gomod` manager to specify a tag for `github.com/marwan-at-work/mod`.
   *
   * Must be prefixed with `v`.
   *
   * @see https://github.com/marwan-at-work/mod
   */
  'gomodMod',
  /**
   * Used in the `jenkins-plugins` datasource to specify a minimum version of the Jenkins that a plugin must support.
   */
  'jenkins',
  /**
   * Used in the `pip-compile` manager datasource to specify a version of `pip-tools` to use.
   *
   * @deprecated TODO remove in #42599
   */
  'pipTools',
] as const;

/**
 * Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports.
 */
export type AdditionalConstraintName =
  (typeof additionalConstraintNames)[number];

export function isAdditionalConstraintName(
  value: unknown,
): value is AdditionalConstraintName {
  return (
    isString(value) &&
    additionalConstraintNames.includes(value as AdditionalConstraintName)
  );
}

/**
 * A name usable as a key in a `constraints` record, which may be tools that Containerbase supports.
 */
export type ConstraintName = ToolName | AdditionalConstraintName;

export function isConstraintName(value: unknown): value is ConstraintName {
  return isToolName(value) || isAdditionalConstraintName(value);
}

export interface ToolConstraint {
  toolName: ToolName;
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

  /**
   * Execute the `command` within a shell
   *
   * WARNING this can result in security issues if this includes user-controlled commands
   * **/
  shell?: boolean | string;
}
