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

  const contentCheckList = [];
  for (const extractor of resourceExtractors) {
    contentCheckList.push(...extractor.getCheckList());
  }

  if (!checkFileContainsDependency(content, contentCheckList)) {
    logger.trace(
      { fileName },
      'preflight content check has not found any relevant content'
    );
    return null;
  }

  const dependencies = [];
  const hclMap = hcl.parseHCL(content);

  const locks = await extractLocksForPackageFile(fileName);

  for (const extractor of resourceExtractors) {
    const deps = extractor.extract(hclMap, locks);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);
  return { deps: dependencies };
}
