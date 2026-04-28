import { isString } from '@sindresorhus/is';
import type { Options as ExecaOptions } from 'execa';

export interface ConstraintDefinition {
  name: string;
  description?: string;
}

/**
 * A `tool` that Containerbase supports.
 *
 * TODO #41849 replace with upstream types
 */
export const toolDefinitions = [
  { name: 'bazelisk' },
  { name: 'bun' },
  { name: 'bundler' },
  { name: 'cocoapods' },
  { name: 'composer' },
  { name: 'conan' },
  { name: 'copier' },
  { name: 'corepack' },
  { name: 'devbox' },
  { name: 'dotnet' },
  { name: 'erlang' },
  { name: 'elixir' },
  { name: 'flux' },
  { name: 'gleam' },
  { name: 'golang' },
  { name: 'gradle' },
  { name: 'hashin' },
  { name: 'helm' },
  { name: 'helmfile' },
  { name: 'java' },
  { name: 'java-maven' },
  { name: 'jb' },
  { name: 'kustomize' },
  { name: 'maven' },
  { name: 'mise' },
  { name: 'nix' },
  { name: 'node' },
  { name: 'npm' },
  { name: 'pdm' },
  { name: 'php' },
  { name: 'pip-tools' },
  { name: 'pipenv' },
  { name: 'pnpm' },
  { name: 'pixi' },
  { name: 'poetry' },
  { name: 'python' },
  {
    name: 'ruby',
    description: 'Also used in the `rubygems` datasource',
  },
  { name: 'rust' },
  { name: 'uv' },
  { name: 'yarn' },
  { name: 'yarn-slim' },
  { name: 'dart' },
  { name: 'flutter' },
  { name: 'vendir' },
] as const satisfies readonly ConstraintDefinition[];

/**
 * A `tool` that Containerbase supports.
 */
export type ToolName = (typeof toolDefinitions)[number]['name'];

/**
 * A `tool` that Containerbase supports.
 */
export const toolNames: ToolName[] = toolDefinitions.map((t) => t.name);

export function isToolName(value: unknown): value is ToolName {
  return isString(value) && (toolNames as readonly string[]).includes(value);
}

/**
 * Additional constraints that can be specified for some Managers, but are not
 * tools that Containerbase supports.
 */
export const additionalConstraintDefinitions = [
  {
    name: 'go',
    description:
      'Used in the `gomod` manager to specify the version of the Go toolchain to use.',
  },
  {
    name: 'gomodMod',
    description:
      'Used in the `gomod` manager to specify a tag for `github.com/marwan-at-work/mod`.',
  },
  {
    name: 'jenkins',
    description:
      'Used in the `jenkins-plugins` datasource to specify a minimum Jenkins version.',
  },
  {
    name: 'pipTools',
    description:
      'Used in the `pip-compile` manager to specify a version of `pip-tools` to use.',
  },
  {
    name: 'platform',
    description:
      'Used in the `rubygems` datasource to specify the supported Gem platform.',
  },
  {
    name: 'rubygems',
    description:
      'Used in the `rubygems` datasource to specify the required `rubygems` version.',
  },
  {
    name: 'vscode',
    description:
      'Used in the `npm` manager to track the compatible VS Code version.',
  },
  {
    name: 'dotnet-sdk',
    description: 'Used in the `nuget` manager to track .NET SDK version.',
  },
  {
    name: 'perl',
    description: 'Used in the `cpanfile` manager to track Perl version.',
  },
] as const satisfies readonly ConstraintDefinition[];

/**
 * Additional constraints that can be specified for some Managers, but are not
 * tools that Containerbase supports.
 */
export type AdditionalConstraintName =
  (typeof additionalConstraintDefinitions)[number]['name'];

export const additionalConstraintNames: AdditionalConstraintName[] =
  additionalConstraintDefinitions.map((c) => c.name);

export function isAdditionalConstraintName(
  value: unknown,
): value is AdditionalConstraintName {
  return (
    isString(value) &&
    (additionalConstraintNames as readonly string[]).includes(value)
  );
}

/**
 * A name usable as a key in a `constraints` record.
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
