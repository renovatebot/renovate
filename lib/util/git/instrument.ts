import type {
  BranchSummary,
  CommitResult,
  DefaultLogFields,
  DiffResult,
  LogOptions,
  LogResult,
  MergeResult,
  Options,
  RemoteWithRefs,
  RemoteWithoutRefs,
  Response,
  SimpleGit,
  StatusResult,
  TaskOptions,
  VersionResult,
} from 'simple-git';
import { instrument } from '../../instrumentation';

import type { RenovateSpanOptions } from '../../instrumentation/types';
import {
  ATTR_VCS_GIT_OPERATION_TYPE,
  ATTR_VCS_GIT_SUBCOMMAND,
} from '../../instrumentation/types';
import type { GitOperationType } from './types';

function isGitOperationType(
  subcommand: string,
): subcommand is GitOperationType {
  return knownGitOperationTypesBySubcommand.includes(
    subcommand as GitOperationType,
  );
}

function gitOperationTypeForSubcommand(subcommand: string): GitOperationType {
  let operationType: GitOperationType = 'other';
  if (!isGitOperationType(subcommand)) {
    if (subcommand === 'update-index') {
      operationType = 'plumbing';
    }

    return operationType;
  }

  return subcommand;
}

/** single-command prefixes that correspond to an operation type */
const knownGitOperationTypesBySubcommand: GitOperationType[] = [
  'branch',
  'checkout',
  'clean',
  'clone',
  'commit',
  'fetch',
  'merge',
  'pull',
  'push',
  'reset',
  'submodule',
];

/** helper method for instrumentation of Git operations */
export function prepareInstrumentation(
  subcommand: string,
  options: RenovateSpanOptions = {},
): {
  spanName: string;
  options: RenovateSpanOptions;
} {
  const operationType = gitOperationTypeForSubcommand(subcommand);

  options.attributes ??= {};
  options.attributes[ATTR_VCS_GIT_OPERATION_TYPE] = operationType;
  options.attributes[ATTR_VCS_GIT_SUBCOMMAND] = subcommand;

  return {
    spanName: `git ${subcommand}`,
    options,
  };
}

export function instrumentGit(git: SimpleGit): InstrumentedSimpleGit {
  return new InstrumentedSimpleGit(git);
}

/**
 * A wrapper for SimpleGit, which is instrumented and adds an ATTR_VCS_GIT_SUBCOMMAND and ATTR_VCS_GIT_OPERATION_TYPE attribute to all calls.
 *
 * We purposefully use a reduced set of methods, with simpler function parameters, to reduce the complexity needed to instrument the methods that we actually need.
 *
 * @see SimpleGit
 */
export class InstrumentedSimpleGit {
  constructor(private git: SimpleGit) {}

  version(): Response<VersionResult> {
    return this.git.version();
  }

  raw(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation(args[0]);

    return instrument(spanName, async () => await this.git.raw(args), options);
  }

  async checkout(whatOrOptions: string | TaskOptions): Promise<string> {
    const { spanName, options } = prepareInstrumentation('checkout');

    return await instrument(
      spanName,
      async () => {
        if (typeof whatOrOptions === 'string') {
          return await this.git.checkout(whatOrOptions);
        } else {
          return await this.git.checkout(whatOrOptions);
        }
      },
      options,
    );
  }

  checkoutBranch(branch: string, startPoint: string): Promise<void> {
    const { spanName, options } = prepareInstrumentation('checkout');

    return instrument(
      spanName,
      async () => await this.git.checkoutBranch(branch, startPoint),
      options,
    );
  }
  branch(args: string[]): Promise<BranchSummary> {
    const { spanName, options } = prepareInstrumentation('branch');

    return instrument(
      spanName,
      async () => await this.git.branch(args),
      options,
    );
  }
  branchLocal(): Promise<BranchSummary> {
    const { spanName, options } = prepareInstrumentation('branch');

    return instrument(
      spanName,
      async () => await this.git.branchLocal(),
      options,
    );
  }
  add(files: string | string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('add');

    return instrument(spanName, async () => await this.git.add(files), options);
  }
  addConfig(key: string, value: string): Promise<string> {
    const { spanName, options } = prepareInstrumentation('config');

    return instrument(
      spanName,
      async () => await this.git.addConfig(key, value),
      options,
    );
  }
  rm(files: string | string[]): Promise<void> {
    const { spanName, options } = prepareInstrumentation('rm');

    return instrument(spanName, async () => await this.git.rm(files), options);
  }
  reset(modeOrOptions: any): Promise<string> {
    const { spanName, options } = prepareInstrumentation('reset');

    return instrument(
      spanName,
      async () => await this.git.reset(modeOrOptions),
      options,
    );
  }
  merge(args: string[]): Promise<MergeResult> {
    const { spanName, options } = prepareInstrumentation('merge');

    return instrument(
      spanName,
      async () => await this.git.merge(args),
      options,
    );
  }
  push(...args: any[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('push');

    return instrument(
      spanName,
      async () => await this.git.push(...args),
      options,
    );
  }
  pull(args: string[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('pull');

    return instrument(spanName, async () => await this.git.pull(args), options);
  }
  fetch(args: string[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('fetch');

    return instrument(
      spanName,
      async () => await this.git.fetch(args),
      options,
    );
  }
  clone(repo: string, dir: string, options: string[]): Promise<string> {
    const { spanName, options: spanOptions } = prepareInstrumentation('clone');

    return instrument(
      spanName,
      async () => await this.git.clone(repo, dir, options),
      spanOptions,
    );
  }
  commit(
    message: string | string[],
    files?: string[],
    options?: Options,
  ): Promise<CommitResult> {
    const { spanName, options: spanOptions } = prepareInstrumentation('clone');

    return instrument(
      spanName,
      async () => await this.git.commit(message, files, options),
      spanOptions,
    );
  }
  status(args?: string[]): Promise<StatusResult> {
    const { spanName, options } = prepareInstrumentation('status');

    return instrument(
      spanName,
      async () => await this.git.status(args),
      options,
    );
  }
  log<T = DefaultLogFields>(
    options?: TaskOptions | LogOptions<T>,
  ): Promise<LogResult<T>> {
    const { spanName, options: spanOptions } = prepareInstrumentation('log');

    return instrument(
      spanName,
      async () => await this.git.log(options),
      spanOptions,
    );
  }
  async revparse(optionOrOptions: string | TaskOptions): Promise<string> {
    const { spanName, options } = prepareInstrumentation('log');

    return await instrument(
      spanName,
      async () => {
        if (typeof optionOrOptions === 'string') {
          return await this.git.revparse(optionOrOptions);
        } else {
          return await this.git.revparse(optionOrOptions);
        }
      },
      options,
    );
  }
  show(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('show');

    return instrument(spanName, async () => await this.git.show(args), options);
  }
  diff(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('diff');

    return instrument(spanName, async () => await this.git.diff(args), options);
  }

  diffSummary(options: TaskOptions): Promise<DiffResult> {
    const { spanName, options: spanOptions } = prepareInstrumentation('diff');

    return instrument(
      spanName,
      async () => await this.git.diffSummary(options),
      spanOptions,
    );
  }
  getRemotes(
    verbose?: boolean,
  ): Promise<RemoteWithRefs[] | RemoteWithoutRefs[]> {
    const { spanName, options } = prepareInstrumentation('remote');

    return instrument(
      spanName,
      async () => {
        if (verbose === true) {
          return await instrument(
            'other',
            async () => await this.git.getRemotes(true),
          );
        } else {
          return await instrument(
            'other',
            async () => await this.git.getRemotes(),
          );
        }
      },
      options,
    );
  }
  addRemote(name: string, repo: string): Promise<string> {
    const { spanName, options } = prepareInstrumentation('remote');

    return instrument(
      spanName,
      async () => await this.git.addRemote(name, repo),
      options,
    );
  }
  env(env: Record<string, string>): this {
    this.git = this.git.env(env);
    return this;
  }
  catFile(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('remote');

    return instrument(spanName, () => this.git.catFile(args), options);
  }
  listRemote(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('ls-remote');

    return instrument(spanName, () => this.git.listRemote(args), options);
  }
  submoduleUpdate(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('submodule');

    return instrument(spanName, () => this.git.submoduleUpdate(args), options);
  }
}
