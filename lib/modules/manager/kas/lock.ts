import { parse, weave } from 'jsonc-weaver';
import { Document } from 'yaml';
import { logger } from '../../../logger/index.ts';
import { writeLocalFile } from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { parseSingleYamlDocument } from '../../../util/yaml.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { getDigest } from '../../datasource/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  getLockFilePath,
  isYamlFilePath,
  loadKasConfigTree,
} from './include.ts';
import type { KasConfig, KasRepo } from './schema.ts';
import type { KasConfigFile } from './types.ts';

const LOCKFILE_VERSION_MIN = 14;

/**
 * Port of `kas lock --update` (kas/plugins/lock.py), run as lock file
 * maintenance on entry files only (extract marks them via `lockFiles`).
 * Floating repos are pinned in the first lockfile that already locks them;
 * the rest go to `<entry>.lock.<ext>`.
 */
export async function updateArtifacts({
  packageFileName,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!config.isLockFileMaintenance) {
    return null;
  }
  const topPath = getLockFilePath(packageFileName);
  if (!config.lockFiles?.length || !topPath) {
    logger.trace(
      { packageFileName },
      'kas: not an entry file, skipping lock update',
    );
    return null;
  }
  const tree = await loadKasConfigTree(packageFileName);
  if (!tree) {
    return null;
  }
  if (tree.hasCrossRepoIncludes) {
    logger.warn(
      { packageFileName },
      'kas: includes from other repos are not supported, skipping lock update',
    );
    return null;
  }

  const toLock = new Map<string, string>();
  for (const [name, repo] of Object.entries(
    coerceObject(tree.mergedNoLock.repos),
  )) {
    const ref = floatingRef(name, repo, tree.mergedNoLock);
    if (!ref) {
      continue;
    }
    let sha: string | null = null;
    try {
      sha = await getDigest(
        { datasource: GitRefsDatasource.id, packageName: repo!.url! },
        ref,
      );
    } catch (err) {
      logger.warn(
        { packageFileName, name, ref, err },
        'kas: ref lookup failed',
      );
    }
    if (!sha) {
      logger.warn(
        { packageFileName, name, ref },
        'kas: could not resolve ref, not locking',
      );
      continue;
    }
    toLock.set(name, sha);
  }
  if (!toLock.size) {
    logger.debug(
      { packageFileName },
      'kas: no floating repos, nothing to lock',
    );
    return null;
  }

  // a lockfile may appear twice when its kas file is included twice
  const lockFiles = [
    ...new Map(
      tree.files.filter((f) => f.isLockFile).map((f) => [f.path, f]),
    ).values(),
  ];
  const changed = new Set<KasConfigFile>();
  for (const lockFile of lockFiles) {
    if (updateLockFile(lockFile, toLock, false)) {
      changed.add(lockFile);
    }
  }
  if (toLock.size) {
    const top = lockFiles.find((f) => f.path === topPath) ?? {
      path: topPath,
      isLockFile: true,
      content: '',
      config: { header: { version: LOCKFILE_VERSION_MIN } },
    };
    logger.debug(
      { repos: [...toLock.keys()], topPath },
      'kas: repos not covered by any lockfile, adding to top lockfile',
    );
    // always changes: every remaining repo is added
    updateLockFile(top, toLock, true);
    changed.add(top);
  }
  if (!changed.size) {
    return null;
  }
  const results: UpdateArtifactsResult[] = [];
  for (const f of changed) {
    // persist so entry files sharing this lockfile see the update
    await writeLocalFile(f.path, f.content);
    results.push({
      file: { type: 'addition', path: f.path, contents: f.content },
    });
  }
  return results;
}

/**
 * Ref to resolve for a repo kas would lock, else null. Mirrors
 * `Repo.factory`: `defaults.repos` applies when the key is absent (an
 * explicit `null` does not fall back), a commit in `overrides` pins too.
 */
function floatingRef(
  name: string,
  repo: KasRepo | null | undefined,
  config: KasConfig,
): string | null {
  if (!repo?.url || repo.type === 'hg') {
    return null;
  }
  if (repo.commit ?? config.overrides?.repos?.[name]?.commit) {
    return null;
  }
  const defaults = config.defaults?.repos;
  const tag = 'tag' in repo ? repo.tag : defaults?.tag;
  const branch = 'branch' in repo ? repo.branch : defaults?.branch;
  return tag ?? branch ?? null;
}

/**
 * lock.py `_update_lockfile`: rewrites `lockFile.content`, removes handled
 * repos from `toLock`. Returns whether the file changed.
 */
function updateLockFile(
  lockFile: KasConfigFile,
  toLock: Map<string, string>,
  addNew: boolean,
): boolean {
  const existing = coerceObject(lockFile.config.overrides?.repos);
  const edits = new Map<string, string>();
  for (const [name, sha] of toLock) {
    if (name in existing) {
      // ponytail: kas also accepts the annotated tag object sha as up to date; we only know the peeled sha
      if (existing[name].commit !== sha) {
        edits.set(name, sha);
      }
      toLock.delete(name);
    } else if (addNew) {
      edits.set(name, sha);
      toLock.delete(name);
    }
  }
  if (!edits.size) {
    return false;
  }
  const bumpVersion = lockFile.config.header.version < LOCKFILE_VERSION_MIN;
  lockFile.content = isYamlFilePath(lockFile.path)
    ? editYaml(lockFile.content, edits, bumpVersion)
    : editJson(lockFile.content, edits, bumpVersion);
  return true;
}

function editYaml(
  content: string,
  edits: Map<string, string>,
  bumpVersion: boolean,
): string {
  const doc = content
    ? parseSingleYamlDocument(content)
    : new Document({ header: { version: LOCKFILE_VERSION_MIN } });
  if (bumpVersion) {
    doc.setIn(['header', 'version'], LOCKFILE_VERSION_MIN);
  }
  for (const [name, sha] of edits) {
    doc.setIn(['overrides', 'repos', name, 'commit'], sha);
  }
  return doc.toString();
}

function editJson(
  content: string,
  edits: Map<string, string>,
  bumpVersion: boolean,
): string {
  const obj = content
    ? parse(content)
    : { header: { version: LOCKFILE_VERSION_MIN } };
  if (bumpVersion) {
    obj.header.version = LOCKFILE_VERSION_MIN;
  }
  obj.overrides ??= {};
  obj.overrides.repos ??= {};
  for (const [name, sha] of edits) {
    obj.overrides.repos[name] = { ...obj.overrides.repos[name], commit: sha };
  }
  return content ? weave(content, obj) : `${JSON.stringify(obj, null, 2)}\n`;
}
