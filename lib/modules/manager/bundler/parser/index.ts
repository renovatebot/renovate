import type { SgNode } from '@ast-grep/napi';
import { parseAsync } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import { uniq } from '../../../../util/uniq';
import type { PackageDependency, PackageFileContent } from '../../types';
import { extractKvArgs, loadRuby, resolveIdentifier } from './common';
import { extractDepNameData, extractVersionData, gemDefPattern } from './gem';
import { extractGitRefData } from './git';
import { extractRubyVersion } from './ruby-version';
import {
  aliasRubygemsSource,
  extractGlobalRegistries,
  extractParentBlockData,
} from './scope';

interface DependencyTypesData {
  depType?: string;
  depTypes?: string[];
}

function getDepTypesData(
  outerDepTypes: string[],
  innerDepType: unknown,
): DependencyTypesData {
  let depTypes: string[] = [...outerDepTypes];

  if (is.string(innerDepType)) {
    depTypes.push(innerDepType);
  } else if (is.array(innerDepType, is.string)) {
    depTypes.push(...innerDepType);
  }

  depTypes = uniq(depTypes);
  if (depTypes.length === 1) {
    return { depType: depTypes[0] };
  } else if (depTypes.length > 1) {
    return { depTypes };
  }

  return {};
}

type RegistryUrlsData = Pick<PackageDependency, 'registryUrls' | 'skipReason'>;

function getRegistryUrlsData(
  gemDef: SgNode,
  gemRegistryUrls: string | symbol | (string | symbol)[] | undefined | null,
  blockRegistryUrls: string[],
  globalRegistryUrls: string[],
): RegistryUrlsData {
  const urls = [...blockRegistryUrls];

  if (is.string(gemRegistryUrls)) {
    urls.unshift(aliasRubygemsSource(gemRegistryUrls));
  } else if (is.symbol(gemRegistryUrls)) {
    const resolvedValue = resolveIdentifier(
      gemDef,
      gemRegistryUrls.description,
    );
    if (resolvedValue) {
      urls.unshift(resolvedValue);
    }
  }

  if (urls.length !== 0) {
    return { registryUrls: uniq(urls) };
  } else if (globalRegistryUrls.length === 0) {
    return { skipReason: 'unknown-registry' };
  }

  return {};
}

function mergeData(
  dep: PackageDependency,
  data: Partial<PackageDependency>,
): PackageDependency {
  const skipReason = dep.skipReason ?? data.skipReason;
  const res = Object.assign(dep, data);
  if (skipReason) {
    res.skipReason = skipReason;
  }
  return res;
}

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
    const kvArgs = extractKvArgs(gemDef);
    const [blockDepTypes, blockRegistryUrls] = extractParentBlockData(gemDef);

    const dep: PackageDependency = { datasource: 'rubygems' };

    const depNameData = extractDepNameData(gemDef);
    mergeData(dep, depNameData);

    const { path } = kvArgs;
    if (is.string(path)) {
      delete dep.skipReason;
      const skipReason = 'internal-package';
      mergeData(dep, { skipReason });
      deps.push(dep);
      continue;
    }

    // Handle git refs
    const gitRefData = extractGitRefData(kvArgs);
    if (gitRefData) {
      mergeData(dep, gitRefData);
      deps.push(dep);
      continue;
    }

    const versionData = extractVersionData(gemDef);
    mergeData(dep, versionData);

    const depTypesData = getDepTypesData(blockDepTypes, kvArgs.group);
    mergeData(dep, depTypesData);

    const gemRegistryUrls = kvArgs.source;
    const registryUrlsData = getRegistryUrlsData(
      gemDef,
      gemRegistryUrls,
      blockRegistryUrls,
      globalRegistryUrls,
    );
    mergeData(dep, registryUrlsData);

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
