import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import {
  getSiblingFileName,
  localPathIsFile,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { BufGenYaml, BufLock, BufYaml } from './schema.ts';

const remotePluginRegex = regEx(
  /^(?<host>[\w-]+(?:\.[\w-]+)+)\/(?<owner>[\w-]+)\/(?<name>[\w-]+)(?::(?<version>[\w.-]+))?$/,
);

// `buf.build/<owner>/<repository>[:<reference>]` — the module reference spelling
// shared by `buf.yaml` deps and (in `v2`) `buf.lock` `name` entries.
const moduleRefRegex = regEx(
  /^(?<host>[\w-]+(?:\.[\w-]+)+)\/(?<owner>[\w-]+)\/(?<repository>[\w-]+)(?::(?<reference>[\w.-]+))?$/,
);

function extractPlugin(ref: string): PackageDependency | null {
  const match = remotePluginRegex.exec(ref)?.groups;
  if (!match) {
    // Not a remote/curated plugin reference (e.g. a bare local plugin name)
    return null;
  }

  const { host, owner, name, version } = match;
  const dep: PackageDependency = {
    depName: `${owner}/${name}`,
    datasource: BufPluginDatasource.id,
    registryUrls: [`https://${host}`],
  };

  if (!version) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  dep.currentValue = version;
  dep.replaceString = ref;
  dep.autoReplaceStringTemplate = ref.replace(
    version,
    '{{#if newValue}}{{newValue}}{{/if}}',
  );

  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  let plugins: ReturnType<typeof BufGenYaml.parse>['plugins'];
  try {
    const doc = parseSingleYaml(content);
    ({ plugins } = BufGenYaml.parse(doc));
  } catch (err) {
    logger.debug({ packageFile, err }, 'Failed to parse buf.gen.yaml');
    return null;
  }

  for (const plugin of coerceArray(plugins)) {
    const ref = plugin.remote ?? plugin.plugin;
    if (!ref) {
      continue;
    }

    const dep = extractPlugin(ref);
    if (dep) {
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

/**
 * Build a `remote/owner/repository` -> resolved `commit` map from `buf.lock`.
 *
 * The commit is what pins each module, so it becomes the dep's
 * `currentDigest`; version bumps are then driven by the `buf-module`
 * datasource's digest resolution rather than by version ordering.
 */
function parseLockCommits(content: string): Map<string, string> {
  const commits = new Map<string, string>();

  let deps: ReturnType<typeof BufLock.parse>['deps'];
  try {
    ({ deps } = BufLock.parse(parseSingleYaml(content)));
  } catch (err) {
    logger.debug({ err }, 'buf: failed to parse buf.lock');
    return commits;
  }

  for (const dep of coerceArray(deps)) {
    if (!dep.commit) {
      continue;
    }

    // v2 spells the module as a single `name`; v1 as remote/owner/repository.
    let key: string | undefined;
    if (dep.name) {
      key = dep.name;
    } else if (dep.remote && dep.owner && dep.repository) {
      key = `${dep.remote}/${dep.owner}/${dep.repository}`;
    }

    if (key) {
      commits.set(key, dep.commit);
    }
  }

  return commits;
}

function extractModuleDep(
  ref: string,
  commits: Map<string, string>,
): PackageDependency | null {
  const match = moduleRefRegex.exec(ref)?.groups;
  if (!match) {
    return null;
  }

  const { host, owner, repository, reference } = match;
  const dep: PackageDependency = {
    depName: `${owner}/${repository}`,
    datasource: BufModuleDatasource.id,
    registryUrls: [`https://${host}`],
  };

  if (reference) {
    dep.currentValue = reference;
  }

  const commit = commits.get(`${host}/${owner}/${repository}`);
  if (commit) {
    dep.currentDigest = commit;
  } else {
    // No entry in buf.lock, so there is no resolved commit to bump from.
    dep.skipReason = 'unversioned-reference';
  }

  return dep;
}

async function extractBufModule(
  content: string,
  packageFile: string,
): Promise<PackageFile | null> {
  let bufYaml: ReturnType<typeof BufYaml.parse>;
  try {
    bufYaml = BufYaml.parse(parseSingleYaml(content));
  } catch (err) {
    logger.debug({ packageFile, err }, 'buf: failed to parse buf.yaml');
    return null;
  }

  if (!bufYaml.deps?.length) {
    return null;
  }

  const lockFile = getSiblingFileName(packageFile, 'buf.lock');
  const lockContent = (await localPathIsFile(lockFile))
    ? await readLocalFile(lockFile, 'utf8')
    : null;
  const commits = lockContent ? parseLockCommits(lockContent) : new Map();

  const deps: PackageDependency[] = [];
  for (const ref of bufYaml.deps) {
    const dep = extractModuleDep(ref, commits);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  const result: PackageFile = { deps, packageFile };
  if (lockContent) {
    result.lockFiles = [lockFile];
  }
  return result;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile[]> {
  const packageFiles: PackageFile[] = [];

  for (const packageFile of matchedFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'buf: package file has no content');
      continue;
    }

    if (upath.basename(packageFile).includes('buf.gen.')) {
      const res = extractPackageFile(content, packageFile, config);
      if (res) {
        packageFiles.push({ ...res, packageFile });
      }
      continue;
    }

    const res = await extractBufModule(content, packageFile);
    if (res) {
      packageFiles.push(res);
    }
  }

  return packageFiles;
}
