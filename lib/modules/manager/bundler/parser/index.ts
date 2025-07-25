import { parseAsync } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import { uniq } from '../../../../util/uniq';
import type { PackageDependency, PackageFileContent } from '../../types';
import { extractKvArgs, loadRuby, resolveIdentifier } from './common';
import { extractDepNameData, extractVersionData, gemDefPattern } from './gem';
import { extractGitRefData } from './git';
import { extractRubyVersion } from './ruby';
import {
  aliasRubygemsSource,
  extractGlobalRegistries,
  extractParentBlockData,
} from './scope';

export async function parseGemfile(
  content: string,
): Promise<PackageFileContent | null> {
  loadRuby();

  const deps: PackageDependency[] = [];

  const ast = await parseAsync('ruby', content);
  const astRoot = ast.root();

  const rubyDep = extractRubyVersion(astRoot);
  if (rubyDep) {
    deps.push(rubyDep);
  }

  const globalRegistryUrls = extractGlobalRegistries(astRoot);

  for (const gemDef of astRoot.findAll(gemDefPattern)) {
    const depNameData = extractDepNameData(gemDef);
    const versionData = extractVersionData(gemDef);

    const dep: PackageDependency = {
      datasource: 'rubygems',
      ...depNameData,
      ...versionData,
    };

    const [blockDepTypes, registryUrls] = extractParentBlockData(gemDef);

    const kvArgs = extractKvArgs(gemDef);

    // Check for path argument (local gems)
    const { path } = kvArgs;
    if (is.string(path)) {
      dep.skipReason = 'internal-package';
      deps.push(dep);
      continue;
    }

    // Handle git refs
    const gitRefData = extractGitRefData(kvArgs);
    if (gitRefData) {
      delete dep.skipReason;
      Object.assign(dep, gitRefData);
      deps.push(dep);
      continue;
    }

    const groupData = kvArgs.group;
    let depTypes: string[] = [...blockDepTypes];
    if (is.string(groupData)) {
      depTypes.push(groupData);
    } else if (is.array(groupData, is.string)) {
      depTypes.push(...groupData);
    }
    depTypes = uniq(depTypes);
    if (depTypes.length === 1) {
      dep.depType = depTypes[0];
    } else if (depTypes.length > 1) {
      Object.assign(dep, { depTypes });
    }

    const localRegistryUrl = kvArgs.source;
    if (is.string(localRegistryUrl)) {
      registryUrls.unshift(aliasRubygemsSource(localRegistryUrl));
    } else if (is.symbol(localRegistryUrl)) {
      const resolvedValue = resolveIdentifier(
        gemDef,
        localRegistryUrl.description,
      );
      if (resolvedValue) {
        registryUrls.unshift(resolvedValue);
      }
    }
    if (registryUrls.length !== 0) {
      dep.registryUrls = uniq(registryUrls);
    } else if (globalRegistryUrls.length === 0) {
      dep.skipReason ??= 'unknown-registry';
    }

    deps.push(dep);
  }

  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent = { deps };

  if (globalRegistryUrls.length) {
    res.registryUrls = globalRegistryUrls;
  }

  return res;
}
