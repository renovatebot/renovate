import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { BufGenYaml, BufLock } from './schema.ts';

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
 */
function extractBufLock(
  content: string,
  packageFile: string,
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

    deps.push({
      depName: `${owner}/${repository}`,
      datasource: BufModuleDatasource.id,
      registryUrls: [`https://${host}`],
      currentDigest: dep.commit,
    });
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
