import { logger } from '../../../logger';
import type { ExtractConfig, PackageFile } from '../types';
import dependencyExtractors from './extractors';
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
  for (const extractor of dependencyExtractors) {
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

  for (const extractor of dependencyExtractors) {
    const deps = extractor.extract(hclMap, locks);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);
  if (dependencies.some((dep) => dep.skipReason !== 'local')) {
    return { deps: dependencies };
  }
  return null;
}
