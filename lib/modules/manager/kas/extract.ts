import type { Document } from 'yaml';
import { YAMLMap } from 'yaml';
import { logger } from '../../../logger/index.ts';
import { parseSingleYamlDocument } from '../../../util/yaml.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { id as looseVersioning } from '../../versioning/loose/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import {
  getLockFilePath,
  isYamlFilePath,
  loadKasConfigTree,
} from './include.ts';
import type { KasConfig, KasRepo } from './schema.ts';
import type { KasConfigFile } from './types.ts';

function extractRepoStrings(
  content: string,
  packageFile: string,
): Map<string, string> {
  const map = new Map<string, string>();
  // istanbul ignore if
  if (!isYamlFilePath(packageFile)) {
    return map;
  }
  let rawYamlDocument: Document;
  try {
    rawYamlDocument = parseSingleYamlDocument(content);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ packageFile, err }, `Parsing KAS YAML file failed`);
    return map;
  }
  let reposNode = rawYamlDocument.get('repos');
  if (!(reposNode instanceof YAMLMap)) {
    const overridesNode = rawYamlDocument.get('overrides');
    // istanbul ignore else
    if (overridesNode instanceof YAMLMap) {
      reposNode = overridesNode.get('repos');
    }
  }
  // istanbul ignore if
  if (!(reposNode instanceof YAMLMap) || reposNode.items.length === 0) {
    logger.debug({ packageFile }, 'no repos found in KAS file');
    return map;
  }
  for (const repoItem of reposNode.items) {
    const repoName = repoItem.key.toString();
    const repoNode = repoItem.value;
    // istanbul ignore else
    if (repoItem.key.range && repoNode?.range) {
      const [keyStart] = repoItem.key.range;
      const [, valueEnd] = repoNode.range;
      map.set(repoName, content.substring(keyStart, valueEnd));
    }
  }
  return map;
}

/**
 * Extract deps from one kas file. `merged` is the fully merged config
 * (includes + lockfiles) and decides which of this file's repo fields are
 * effective.
 */
export function extractPackageFile(
  { path: packageFile, content, config, isLockFile }: KasConfigFile,
  merged: KasConfig,
): PackageFileContent | null {
  logger.trace(`kas.extractPackageFile ${packageFile}`);
  logger.trace({ content });
  const isYamlFile = isYamlFilePath(packageFile);
  const repos: Record<string, KasRepo | null | undefined> | undefined =
    isLockFile ? config.overrides?.repos : config.repos;
  if (!repos) {
    logger.debug({ packageFile }, 'no repos found in KAS file');
    return null;
  }
  const repoStrings: Map<string, string> | null = isYamlFile
    ? extractRepoStrings(content, packageFile)
    : null;
  const deps: PackageDependency[] = [];
  for (const repoName of Object.keys(repos)) {
    const repo = repos[repoName];
    if (!repo) {
      logger.trace(
        { packageFile, repoName },
        'repo entry is null or undefined, skipping',
      );
      continue;
    }
    const mergedRepo: KasRepo | null | undefined = merged.repos?.[repoName];
    if (!mergedRepo) {
      logger.debug(
        { packageFile, repoName },
        'no corresponding repo in merged config. Skipping',
      );
      continue;
    }
    const overridesCommit: string | undefined =
      merged.overrides?.repos?.[repoName]?.commit;
    const effectiveCommit = overridesCommit ?? mergedRepo.commit;
    logger.trace(
      { packageFile, mergedRepo, repo },
      'corresponding merged repo details',
    );

    if (mergedRepo.type === 'hg' || repo.type === 'hg') {
      logger.debug(
        { repo, mergedRepo },
        'Mercurial repos are not supported by Renovate. Skipping.',
      );
      continue;
    }
    if (repo.url && mergedRepo.url && repo.url !== mergedRepo.url) {
      logger.warn(
        { repo, mergedRepo },
        'Repo URL in file does not match merged config. Skipping.',
      );
      continue;
    }
    const git = repo.url ?? mergedRepo.url;
    if (!isLockFile && !git) {
      logger.debug({ repo }, 'No repo URL found. Skipping');
      continue;
    }
    const isCommitInMerged = repo.commit && effectiveCommit === repo.commit;
    const isTagInMerged = repo.tag && repo.tag === mergedRepo.tag;
    if (!isCommitInMerged && !isTagInMerged) {
      logger.debug(
        { repo },
        'No relevant commit and tag found. Nothing to update.',
      );
      continue;
    }

    const commit = isCommitInMerged ? effectiveCommit : undefined;
    const branch = mergedRepo.branch ?? undefined;
    const tag = mergedRepo.tag ?? undefined;

    if (branch && tag) {
      logger.warn(
        { repo },
        'Cannot have both tag and branch defined. Skipping.',
      );
      continue;
    }

    let replaceString: string | undefined = undefined;
    if (isYamlFile) {
      replaceString = repoStrings?.get(repoName);
      // istanbul ignore if
      if (!replaceString) {
        logger.warn(
          { packageFile, repoName },
          'could not extract repo string from file, using entire file content',
        );
        replaceString = content;
      }
      logger.trace({ replaceString, repoName }, 'string to replace for repo');
    }

    const packageDependency: PackageDependency = {
      depName: repoName,
      packageName: git,
      versioning: mergedRepo.branch ? looseVersioning : undefined,
      replaceString: replaceString,
      currentDigest: commit,
    };

    if (tag) {
      packageDependency.datasource = GitTagsDatasource.id;
      packageDependency.currentValue = tag;
    } else {
      packageDependency.datasource = GitRefsDatasource.id;
      packageDependency.currentValue = branch;
    }

    logger.debug({ packageDependency }, 'extracted dependency');
    deps.push(packageDependency);
  }
  return deps.length > 0 ? { deps } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const results: PackageFile[] = [];
  const seen = new Set<string>();
  for (const rootFile of packageFiles) {
    logger.debug(
      { rootFile },
      'kas.extractAllPackageFiles: processing root file',
    );
    if (seen.has(rootFile)) {
      logger.warn(
        { rootFile },
        'only specify the root entry kas file in matchFiles renovate config. Skipping.',
      );
      continue;
    }
    const lockFile = getLockFilePath(rootFile);
    if (!lockFile) {
      logger.warn(
        { rootFile },
        'kas entry file must be a .yml, .yaml or .json project file. Skipping.',
      );
      continue;
    }
    const tree = await loadKasConfigTree(rootFile);
    if (!tree) {
      logger.debug({ rootFile }, 'kas config could not be loaded, skipping');
      continue;
    }
    logger.debug(`kas file format version ${tree.merged.header.version}`);
    for (const file of tree.files) {
      if (seen.has(file.path)) {
        continue;
      }
      seen.add(file.path);
      const packageFileContent = extractPackageFile(file, tree.merged);
      if (file.path === rootFile) {
        // entry file is always reported so lockFileMaintenance runs on it;
        // lockFiles marks it as entry for updateArtifacts
        results.push({
          packageFile: file.path,
          deps: [],
          ...packageFileContent,
          lockFiles: [lockFile],
        });
      } else if (packageFileContent) {
        results.push({ packageFile: file.path, ...packageFileContent });
      }
    }
    logger.debug(
      { files: tree.files.map((f) => f.path) },
      'Extracted all KAS files',
    );
  }
  return results;
}
