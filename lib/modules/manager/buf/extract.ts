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

function extractBufGenYaml(
  content: string,
  packageFile: string,
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
 * Extract the module dependencies pinned in a `buf.lock` file.
 *
 * The resolved commit (a 32-char hex string that lives in the file text)
 * becomes each dep's `currentDigest`, so a bump is applied by autoReplace
 * swapping the commit in place; `updateArtifacts` then runs `buf dep update`
 * to recompute the accompanying `b5:` content digest.
 *
 * Deps are emitted in file order so `depIndex` is stable across re-extraction
 * (autoReplace's `confirmIfDepUpdated` re-parses the modified file).
 *
 * `buf.lock` records the full transitive closure, but only direct deps are
 * independently updatable — `buf dep update` re-resolves everything else from
 * `buf.yaml`. When `directModules` is supplied, deps not in it are marked
 * transitive with a `skipReason` (they stay in the array so `depIndex` still
 * lines up with the unfiltered re-extraction autoReplace performs).
 */
function extractBufLock(
  content: string,
  packageFile: string,
  directModules?: Set<string>,
): PackageFileContent | null {
  let bufLock: ReturnType<typeof BufLock.parse>;
  try {
    bufLock = BufLock.parse(parseSingleYaml(content));
  } catch (err) {
    logger.debug({ packageFile, err }, 'Failed to parse buf.lock');
    return null;
  }

  const deps: PackageDependency[] = [];
  for (const dep of coerceArray(bufLock.deps)) {
    if (!dep.commit) {
      continue;
    }

    // v2 spells the module as a single `name`; v1 as remote/owner/repository.
    let host: string | undefined;
    let owner: string | undefined;
    let repository: string | undefined;
    if (dep.name) {
      [host, owner, repository] = dep.name.split('/');
    } else {
      host = dep.remote;
      owner = dep.owner;
      repository = dep.repository;
    }

    if (!host || !owner || !repository) {
      logger.debug(
        { packageFile, module: dep.name ?? dep.remote },
        'buf: skipping buf.lock dep with unparseable module name',
      );
      continue;
    }

    const packageDep: PackageDependency = {
      depName: `${owner}/${repository}`,
      datasource: BufModuleDatasource.id,
      registryUrls: [`https://${host}`],
      currentDigest: dep.commit,
    };

    if (directModules && !directModules.has(`${host}/${owner}/${repository}`)) {
      packageDep.skipReason = 'inherited-dependency';
    }

    deps.push(packageDep);
  }

  return deps.length ? { deps } : null;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  if (upath.basename(packageFile).includes('buf.gen.')) {
    return extractBufGenYaml(content, packageFile);
  }

  return extractBufLock(content, packageFile);
}

/**
 * The set of direct module references (`host/owner/repository`) declared in a
 * sibling `buf.yaml`, used to tell direct deps from transitive ones.
 *
 * Returns `undefined` when there is no sibling `buf.yaml` or it cannot be
 * parsed, so the caller leaves deps unfiltered rather than wrongly marking them
 * all transitive.
 */
async function resolveDirectModules(
  packageFile: string,
): Promise<Set<string> | undefined> {
  const bufYamlFile = getSiblingFileName(packageFile, 'buf.yaml');
  if (!(await localPathIsFile(bufYamlFile))) {
    logger.debug(
      { packageFile },
      'buf: no sibling buf.yaml; treating all buf.lock deps as updatable',
    );
    return undefined;
  }

  const content = await readLocalFile(bufYamlFile, 'utf8');
  if (!content) {
    return undefined;
  }

  let bufYaml: ReturnType<typeof BufYaml.parse>;
  try {
    bufYaml = BufYaml.parse(parseSingleYaml(content));
  } catch (err) {
    logger.debug(
      { packageFile, err },
      'buf: failed to parse sibling buf.yaml; leaving deps unfiltered',
    );
    return undefined;
  }

  const modules = new Set<string>();
  for (const ref of coerceArray(bufYaml.deps)) {
    // Drop any `:reference` suffix, keeping the `host/owner/repository` part.
    modules.add(ref.split(':')[0]);
  }
  return modules;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile[]> {
  const packageFiles: PackageFile[] = [];

  for (const packageFile of matchedFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'buf: package file has no content');
      continue;
    }

    const res = upath.basename(packageFile).includes('buf.gen.')
      ? // buf.gen.yaml plugins have no direct/transitive distinction.
        extractBufGenYaml(content, packageFile)
      : extractBufLock(
          content,
          packageFile,
          await resolveDirectModules(packageFile),
        );

    if (res) {
      packageFiles.push({ ...res, packageFile });
    }
  }

  return packageFiles;
}
