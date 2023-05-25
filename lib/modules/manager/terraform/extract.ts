import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { ExtractConfig, PackageFileContent } from '../types';
import { resourceExtractors } from './extractors';
import * as hcl from './hcl';
import {
  checkFileContainsDependency,
  extractLocksForPackageFile,
} from './util';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent | null> {
  logger.trace({ content }, `terraform.extractPackageFile(${packageFile})`);

  const passedExtractors = [];
  for (const extractor of resourceExtractors) {
    if (checkFileContainsDependency(content, extractor.getCheckList())) {
      passedExtractors.push(extractor);
    }
  }

  if (!passedExtractors.length) {
    logger.debug(
      { packageFile },
      'preflight content check has not found any relevant content'
    );
    return null;
  }
  logger.trace(
    { packageFile },
    `preflight content check passed for extractors: [${passedExtractors
      .map((value) => value.constructor.name)
      .toString()}]`
  );

  const dependencies = [];
  const hclMap = await hcl.parseHCL(content, packageFile);
  if (is.nullOrUndefined(hclMap)) {
    logger.debug({ packageFile }, 'failed to parse HCL file');
    return null;
  }

  const locks = await extractLocksForPackageFile(packageFile);

  for (const extractor of passedExtractors) {
    const deps = extractor.extract(hclMap, locks, config);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);
  return { deps: dependencies };
}
