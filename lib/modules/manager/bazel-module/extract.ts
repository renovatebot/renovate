import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { isNotNullOrUndefined } from '../../../util/array.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import * as bazelrc from './bazelrc.ts';
import type { ResultFragment } from './parser/fragments.ts';
import { parse } from './parser/index.ts';
import { RuleToMavenPackageDep, fillRegistryUrls } from './parser/maven.ts';
import { RuleToDockerPackageDep } from './parser/oci.ts';
import * as rules from './rules.ts';
import {
  GitRepositoryToPackageDep,
  RuleToBazelModulePackageDep,
} from './rules.ts';
import { transformRulesImgCalls } from './rules-img.ts';

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
