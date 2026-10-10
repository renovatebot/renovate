import {
  type ToolName as ContainerbaseToolName,
  toolNames,
} from '@renovatebot/base-image';
import { isString } from '@sindresorhus/is';
import type { Options as ExecaOptions } from 'execa';
import type { VersioningName } from '../../versioning-list.generated.ts';

export interface ConstraintDefinition {
  name: string;
  description?: string;
}

/**
 * Additional documentation for `tool`s that Containerbase supports.
 */
export const toolDefinitionDocumentation = [
  {
    name: 'ruby',
    description: 'Also used in the `rubygems` Datasource',
  },
] as const satisfies readonly (ConstraintDefinition & {
  name: ContainerbaseToolName;
})[];

/**
 * A `tool` that Containerbase supports, but may not be supported by Renovate.
 *
 * @see SupportedToolNames
 */
export type ToolName = (typeof toolNames)[number];

export function isToolName(value: unknown): value is ContainerbaseToolName {
  return isString(value) && (toolNames as readonly string[]).includes(value);
}

type NotContainerbaseToolName<Name extends string> =
  Name extends ContainerbaseToolName
    ? `Name "${Name}" must not be a Containerbase tool name - see 'ContainerbaseToolName'`
    : Name;

function constrainAdditionalConstraintDefinitions<
  const T extends readonly (ConstraintDefinition & { name: string })[],
>(defs: {
  [K in keyof T]: T[K] extends { name: infer Name extends string }
    ? Omit<T[K], 'name'> & { name: NotContainerbaseToolName<Name> }
    : T[K];
}): T {
  return defs as unknown as T;
}

/**
 * Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports, with optional description.
 */
export const additionalConstraintDefinitions =
  constrainAdditionalConstraintDefinitions([
    {
      name: 'ghActionsLock',
      description: `Used in the \`github-actions\` manager to specify a release tag for the [\`github/gh-actions-lock\`](https://github.com/github/gh-actions-lock) \`gh\` CLI extension, which regenerates \`.github/workflows/actions.lock\`.

Must be a full release tag, prefixed with \`v\`, such as \`v0.1.7\`. Set it to an empty string to always install the latest release.`,
    },
    /**
     * @deprecated TODO remove in #42600
     */
    {
      name: 'go',
      description: `Used in the \`gomod\` manager to specify the version of the Go toolchain to use.

In precedence order:

1. config: \`constraints.go\`
1. \`go.mod\`: \`toolchain\` directive
1. \`go.mod\`: \`go\` directive

NOTE that the \`constraints.golang\` is not used (https://github.com/renovatebot/renovate/issues/42601)
  `,
    },
    {
      name: 'gomodMod',
      description: `Used in the \`gomod\` manager to specify a tag for [\`github.com/marwan-at-work/mod\`](https://github.com/marwan-at-work/mod).

Must be prefixed with \`v\`.`,
    },
    {
      name: 'jenkins',
      description:
        'Used in the `jenkins-plugins` datasource to specify a minimum version of Jenkins that a plugin must support.',
    },
    {
      name: 'pipTools',
      description:
        'Used in the `pip-compile` manager to specify a version of `pip-tools` to use. @deprecated TODO remove in #42599',
    },
    {
      name: 'platform',
      description:
        'Used in the `rubygems` datasource to specify the `platform` that the Gem dependency supports.',
    },
    {
      name: 'rubygems',
      description:
        'Used in the `rubygems` datasource to specify the version of the `rubygems` tool that is needed to use this Gem.',
    },
    {
      name: 'vscode',
      description:
        'Used in the `npm` manager to track the version of VSCode that the package is compatible with.',
    },
    {
      name: 'dotnet-sdk',
      description:
        'Used in the `nuget` manager to track .NET SDK version required.',
    },
    {
      name: 'perl',
      description:
        'Used in the `cpanfile` manager to track Perl version required.',
    },
    {
      name: '%goMod',
      description:
        'Used in the `gomod` manager to determine the [minimum version of Go required to use this module](https://go.dev/ref/mod#go-mod-file-go).\n\nNote that this is prefixed with a `%` to explicitly note that this is not a tool that Containerbase knows.',
    },
  ] as const);

/**
 * Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports.
 */
export type AdditionalConstraintName =
  (typeof additionalConstraintDefinitions)[number]['name'];

/**
 * Additional constraints that can be specified for some Managers, but are **not** tools that Containerbase supports.
 */
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
 * A name usable as a key in a `constraints` record, which may be tools that Containerbase supports.
 */
export type ConstraintName = ContainerbaseToolName | AdditionalConstraintName;

export function isConstraintName(value: unknown): value is ConstraintName {
  return isToolName(value) || isAdditionalConstraintName(value);
}

export interface ToolConstraint {
  toolName: ContainerbaseToolName;
  constraint?: string | null;
}

export interface ToolConfig {
  datasource: string;
  extractVersion?: string;
  packageName: string;
  versioning: VersioningName;
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

export interface OutputWriter {
  write(chunk: Buffer): void;
  toString(): string;
}

export interface OutputWriters {
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

/** execa options producing text output, which excludes the binary encodings */
type TextExecaOptions = Extract<
  ExecaOptions,
  { readonly encoding?: 'utf8' | 'utf16le' }
>;

export interface RawExecOptions extends TextExecaOptions {
  maxBuffer?: number | undefined;
  cwd?: string;
  outputListeners?: OutputListeners;
  outputWriters?: OutputWriters;
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
  /** Let the caller handle command timeouts instead of aborting the repository. */
  abortOnTimeout?: boolean;
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
