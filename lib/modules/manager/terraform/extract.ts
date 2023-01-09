import { logger } from '../../../logger';
import type { ExtractConfig, PackageFile } from '../types';
import { resourceExtractors } from './extractors';
import * as hcl from './hcl';
import {
  checkFileContainsDependency,
  extractLocksForPackageFile,
} from './util';

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace({ content }, 'terraform.extractPackageFile()');

  const passedExtractors = [];
  for (const extractor of resourceExtractors) {
    if (checkFileContainsDependency(content, extractor.getCheckList())) {
      passedExtractors.push(extractor);
    }
  }

  if (!passedExtractors.length) {
    logger.trace(
      { fileName },
      'preflight content check has not found any relevant content'
    );
    return null;
  }
  logger.trace(
    { fileName },
    `preflight content check passed for extractors: [${passedExtractors
      .map((value) => value.constructor.name)
      .toString()}]`
  );

  const dependencies = [];
  const hclMap = hcl.parseHCL(content);

  const locks = await extractLocksForPackageFile(fileName);

  for (const extractor of passedExtractors) {
    const deps = extractor.extract(hclMap, locks);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);
  return { deps: dependencies };
}
