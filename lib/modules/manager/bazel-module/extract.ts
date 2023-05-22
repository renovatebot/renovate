import { dirname } from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseArray } from '../../../util/schema-utils';
import type { PackageFileContent } from '../types';
import * as bazelrc from './bazelrc';
import { parse } from './parser';
import { RuleToBazelModulePackageDep } from './rules';
import * as rules from './rules';

export async function extractPackageFile(
  content: string,
  filename: string
): Promise<PackageFileContent | null> {
  try {
    const records = parse(content);
    const pfc: PackageFileContent = LooseArray(RuleToBazelModulePackageDep)
      .transform(rules.toPackageDependencies)
      .transform((deps) => ({ deps }))
      .parse(records);
    if (!pfc.deps.length) {
      return null;
    }

    const registryUrls = (await bazelrc.read(dirname(filename)))
      // Ignore any entries for custom configurations
      .filter((ce) => ce.config === undefined)
      .map((ce) => ce.getOption('registry')?.value)
      .filter(isNotNullOrUndefined);
    if (registryUrls.length) {
      pfc.registryUrls = registryUrls;
    }

    return pfc;
  } catch (err) {
    logger.debug({ err, filename }, 'Failed to parse bazel module file.');
    return null;
  }
}
