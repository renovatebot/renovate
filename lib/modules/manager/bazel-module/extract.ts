import upath from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseArray } from '../../../util/schema-utils';
import type { PackageDependency, PackageFileContent } from '../types';
import * as bazelrc from './bazelrc';
import { parse } from './parser';
import type { ResultFragment } from './parser/fragments';
import { RuleToMavenPackageDep, fillRegistryUrls } from './parser/maven';
import { RuleToDockerPackageDep } from './parser/oci';
import {
  GitRepositoryToPackageDep,
  RuleToBazelModulePackageDep,
} from './rules';
import * as rules from './rules';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  try {
    const records = parse(content);
    const pfc = await extractBazelPfc(records, packageFile);
    const gitRepositoryDeps = extractGitRepositoryDeps(records);
    const mavenDeps = extractMavenDeps(records);
    const dockerDeps = LooseArray(RuleToDockerPackageDep).parse(records);

    if (gitRepositoryDeps.length) {
      pfc.deps.push(...gitRepositoryDeps);
    }

    if (mavenDeps.length) {
      pfc.deps.push(...mavenDeps);
    }

    if (dockerDeps.length) {
      pfc.deps.push(...dockerDeps);
    }

    return pfc.deps.length ? pfc : null;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse bazel module file.');
    return null;
  }
}

async function extractBazelPfc(
  records: ResultFragment[],
  packageFile: string,
): Promise<PackageFileContent> {
  const pfc: PackageFileContent = LooseArray(RuleToBazelModulePackageDep)
    .transform(rules.toPackageDependencies)
    .transform((deps) => ({ deps }))
    .parse(records);

  const registryUrls = (await bazelrc.read(upath.dirname(packageFile)))
    // Ignore any entries for custom configurations
    .filter((ce) => ce.config === undefined)
    .map((ce) => ce.getOption('registry')?.value)
    .filter(isNotNullOrUndefined);
  if (registryUrls.length) {
    pfc.registryUrls = registryUrls;
  }

  return pfc;
}

function extractGitRepositoryDeps(
  records: ResultFragment[],
): PackageDependency[] {
  return LooseArray(GitRepositoryToPackageDep).parse(records);
}

function extractMavenDeps(records: ResultFragment[]): PackageDependency[] {
  return LooseArray(RuleToMavenPackageDep)
    .transform(fillRegistryUrls)
    .parse(records);
}
