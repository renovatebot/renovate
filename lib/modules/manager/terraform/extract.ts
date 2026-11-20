import {
  isNonEmptyArray,
  isNonEmptyObject,
  isNullOrUndefined,
} from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import type { DependencyExtractor } from './base.ts';
import { ModuleExtractor } from './extractors/others/modules.ts';
import { resourceExtractors } from './extractors.ts';
import * as hcl from './hcl/index.ts';
import {
  checkFileContainsDependency,
  extractLocksForPackageFile,
  readSiblingHclFiles,
} from './util.ts';

// a `locals`/`variable` declaration may be used by modules of other files
const declarationRegex = regEx(/^\s*(?:locals|variable)\b/m);

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace({ content }, `terraform.extractPackageFile(${packageFile})`);

  const passedExtractors: DependencyExtractor[] = [];
  for (const extractor of resourceExtractors) {
    if (checkFileContainsDependency(content, extractor.getCheckList())) {
      passedExtractors.push(extractor);
    }
  }

  if (
    declarationRegex.test(content) &&
    !passedExtractors.some((extractor) => extractor instanceof ModuleExtractor)
  ) {
    passedExtractors.push(
      resourceExtractors.find((e) => e instanceof ModuleExtractor)!,
    );
  }

  if (!passedExtractors.length) {
    logger.debug(
      { packageFile },
      'preflight content check has not found any relevant content',
    );
    return null;
  }
  logger.trace(
    { packageFile },
    `preflight content check passed for extractors: [${passedExtractors
      .map((value) => value.constructor.name)
      .toString()}]`,
  );

  const dependencies: PackageDependency[] = [];
  const hclMap = await hcl.parseHCL(content, packageFile);
  if (isNullOrUndefined(hclMap)) {
    logger.debug({ packageFile }, 'failed to parse HCL file');
    return null;
  }

  const locks = await extractLocksForPackageFile(packageFile);

  const siblings =
    isNonEmptyArray(hclMap.locals) || isNonEmptyObject(hclMap.variable)
      ? await readSiblingHclFiles(packageFile)
      : [];

  for (const extractor of passedExtractors) {
    const deps = extractor.extract(hclMap, locks, config, siblings);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);
  return dependencies.length ? { deps: dependencies } : null;
}
