import { coerceArray } from '../array.ts';
import { readLocalFile } from '../fs/index.ts';
import type { FileAddition, FileChange, StatusResult } from './types.ts';

/**
 * The `git status` buckets which can be turned into {@link FileChange}s.
 *
 * All of them describe additions, except `deleted` which describes deletions
 * and `renamed` which describes a deletion followed by an addition.
 */
export type RepoStatusBucket =
  | 'modified'
  | 'not_added'
  | 'created'
  | 'conflicted'
  | 'renamed'
  | 'deleted';

/**
 * Extra metadata which can be attached to a {@link FileAddition}.
 */
export type FileAdditionMetadata = Partial<
  Omit<FileAddition, 'type' | 'path' | 'contents'>
>;

export interface CollectFileChangesOptions {
  /**
   * The `git status` buckets to collect, in output order.
   *
   * @default ['modified', 'not_added', 'deleted']
   */
  include?: RepoStatusBucket[];

  /**
   * Only paths for which this returns `true` are collected.
   */
  filter?: (path: string) => boolean;

  /**
   * Called for every addition to attach extra metadata, e.g. the executable bit.
   */
  additionMetadata?: (path: string) => Promise<FileAdditionMetadata>;
}

const defaultInclude: RepoStatusBucket[] = ['modified', 'not_added', 'deleted'];

async function toAddition(
  path: string,
  additionMetadata: CollectFileChangesOptions['additionMetadata'],
): Promise<FileAddition> {
  return {
    type: 'addition',
    path,
    contents: await readLocalFile(path),
    ...(await additionMetadata?.(path)),
  };
}

/**
 * Converts the result of `getRepoStatus()` into the {@link FileChange}s which
 * managers return as artifact updates. The contents of every addition are read
 * from the local directory.
 */
export async function collectFileChanges(
  status: StatusResult,
  options: CollectFileChangesOptions = {},
): Promise<FileChange[]> {
  const { include = defaultInclude, filter, additionMetadata } = options;
  const changes: FileChange[] = [];

  for (const bucket of include) {
    if (bucket === 'renamed') {
      for (const { from, to } of coerceArray(status.renamed)) {
        if (!filter || filter(from)) {
          changes.push({ type: 'deletion', path: from });
        }
        if (!filter || filter(to)) {
          changes.push(await toAddition(to, additionMetadata));
        }
      }
      continue;
    }

    for (const path of coerceArray(status[bucket])) {
      if (filter && !filter(path)) {
        continue;
      }

      if (bucket === 'deleted') {
        changes.push({ type: 'deletion', path });
      } else {
        changes.push(await toAddition(path, additionMetadata));
      }
    }
  }

  return changes;
}
