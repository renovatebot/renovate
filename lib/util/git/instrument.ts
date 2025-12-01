import type {
  BranchSummary,
  CommitResult,
  DefaultLogFields,
  DiffResult,
  LogOptions,
  LogResult,
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

  raw(args: string[]): Response<string> {
    const { spanName, options } = prepareInstrumentation(args[0]);

    return instrument(spanName, () => this.git.raw(args), options);
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

  async checkoutBranch(branch: string, startPoint: string): Promise<void> {
    const { spanName, options } = prepareInstrumentation('checkout');

    await instrument(
      spanName,
      () => this.git.checkoutBranch(branch, startPoint),
      options,
    );
  }
  async branch(args: string[]): Promise<BranchSummary> {
    const { spanName, options } = prepareInstrumentation('branch');

    return await instrument(spanName, () => this.git.branch(args), options);
  }
  async branchLocal(): Promise<BranchSummary> {
    const { spanName, options } = prepareInstrumentation('branch');

    return await instrument(spanName, () => this.git.branchLocal(), options);
  }
  async add(files: string | string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('add');

    return await instrument(spanName, () => this.git.add(files), options);
  }
  async addConfig(key: string, value: string): Promise<void> {
    const { spanName, options } = prepareInstrumentation('config');

    await instrument(spanName, () => this.git.addConfig(key, value), options);
  }
  async rm(files: string | string[]): Promise<void> {
    const { spanName, options } = prepareInstrumentation('rm');

    await instrument(spanName, () => this.git.rm(files), options);
  }
  async reset(modeOrOptions: any): Promise<void> {
    const { spanName, options } = prepareInstrumentation('reset');

    await instrument(spanName, () => this.git.reset(modeOrOptions), options);
  }
  async merge(args: string[]): Promise<void> {
    const { spanName, options } = prepareInstrumentation('merge');

    await instrument(spanName, () => this.git.merge(args), options);
  }
  async push(...args: any[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('push');

    return await instrument(spanName, () => this.git.push(...args), options);
  }
  async pull(args: string[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('pull');

    return await instrument(spanName, () => this.git.pull(args), options);
  }
  async fetch(args: string[]): Promise<any> {
    const { spanName, options } = prepareInstrumentation('fetch');

    return await instrument(spanName, () => this.git.fetch(args), options);
  }
  async clone(repo: string, dir: string, options: string[]): Promise<void> {
    const { spanName, options: spanOptions } = prepareInstrumentation('clone');

    await instrument(
      spanName,
      () => this.git.clone(repo, dir, options),
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
      () => this.git.commit(message, files, options),
      spanOptions,
    );
  }
  status(args?: string[]): Response<StatusResult> {
    const { spanName, options } = prepareInstrumentation('status');

    return instrument(spanName, () => this.git.status(args), options);
  }
  async log<T = DefaultLogFields>(
    options?: TaskOptions | LogOptions<T>,
  ): Promise<LogResult<T>> {
    const { spanName, options: spanOptions } = prepareInstrumentation('log');

    return await instrument(spanName, () => this.git.log(options), spanOptions);
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
  async show(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('show');

    return await instrument(spanName, () => this.git.show(args), options);
  }
  async diff(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('diff');

    return await instrument(spanName, () => this.git.diff(args), options);
  }

  async diffSummary(options: TaskOptions): Promise<DiffResult> {
    const { spanName, options: spanOptions } = prepareInstrumentation('diff');

    return await instrument(
      spanName,
      () => this.git.diffSummary(options),
      spanOptions,
    );
  }
  async getRemotes(
    verbose?: boolean,
  ): Promise<RemoteWithRefs[] | RemoteWithoutRefs[]> {
    const { spanName, options } = prepareInstrumentation('remote');

    return await instrument(
      spanName,
      async () => {
        if (verbose === true) {
          return await instrument('other', () => this.git.getRemotes(true));
        } else {
          return await instrument('other', () => this.git.getRemotes());
        }
      },
      options,
    );
  }
  async addRemote(name: string, repo: string): Promise<void> {
    const { spanName, options } = prepareInstrumentation('remote');

    await instrument(spanName, () => this.git.addRemote(name, repo), options);
  }
  env(env: Record<string, string>): this {
    this.git = this.git.env(env);
    return this;
  }
  async catFile(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('remote');

    return await instrument(spanName, () => this.git.catFile(args), options);
  }
  async listRemote(args: string[]): Promise<string> {
    const { spanName, options } = prepareInstrumentation('ls-remote');

    return await instrument(spanName, () => this.git.listRemote(args), options);
  }
  async submoduleUpdate(args: string[]): Promise<void> {
    const { spanName, options } = prepareInstrumentation('submodule');

    await instrument(spanName, () => this.git.submoduleUpdate(args), options);
  }
}
