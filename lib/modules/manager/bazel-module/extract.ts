import upath from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseArray } from '../../../util/schema-utils';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
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
import { transformRulesImgCalls } from './rules-img';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  try {
    const records = parse(content);
    const pfc = await extractBazelPfc(records, packageFile);
    const gitRepositoryDeps = extractGitRepositoryDeps(records);
    const mavenDeps = extractMavenDeps(records);
    const dockerDeps = LooseArray(RuleToDockerPackageDep)
      .transform((deps) =>
        deps.map((dep) => {
          // Reconstruct the image reference from parsed data
          const imageRef = `${dep.packageName}${dep.currentValue ? `:${dep.currentValue}` : ''}${dep.currentDigest ? `@${dep.currentDigest}` : ''}`;
          // Use getDep to handle registry aliases properly
          const processedDep = getDep(imageRef, false, config?.registryAliases);
          return {
            ...processedDep,
            depType: 'oci_pull',
            depName: dep.depName, // Keep the original name field from bazel
            replaceString: dep.replaceString, // Keep the original replace string
          };
        }),
      )
      .parse(records);
    const rulesImgDeps = transformRulesImgCalls(records);

    if (gitRepositoryDeps.length) {
      pfc.deps.push(...gitRepositoryDeps);
    }

    if (mavenDeps.length) {
      pfc.deps.push(...mavenDeps);
    }

    if (dockerDeps.length) {
      pfc.deps.push(...dockerDeps);
    }

    if (rulesImgDeps.length) {
      pfc.deps.push(...rulesImgDeps);
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
