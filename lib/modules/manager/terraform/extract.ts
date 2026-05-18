import { isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import type { DependencyExtractor } from './base.ts';
import { resourceExtractors } from './extractors.ts';
import * as hcl from './hcl/index.ts';
import {
  checkFileContainsDependency,
  extractLocksForPackageFile,
} from './util.ts';

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

  for (const extractor of passedExtractors) {
    const deps = extractor.extract(hclMap, locks, config);
    dependencies.push(...deps);
  }

  // Post-process: for SHA-pinned GitHub module sources, extract version from
  // inline comment in the raw file content (the HCL parser strips comments).
  // Scan the content once and build a lookup map before iterating over deps.
  const shaCommentRegex = regEx(
    /\?ref=(?<sha>[0-9a-f]{40})"(?:[^\S\r\n]*#[^\S\r\n]*(?<version>v?[^\s]+))?/gi,
  );
  const shaInfoMap = new Map<
    string,
    { version: string | undefined; replaceString: string }
  >();
  for (const match of content.matchAll(shaCommentRegex)) {
    const sha = match.groups!.sha;
    shaInfoMap.set(sha, {
      version: match.groups?.version,
      replaceString: match[0].slice('?ref='.length),
    });
  }

  for (const dep of dependencies) {
    if (dep.currentDigest && dep.depType === 'module') {
      const info = shaInfoMap.get(dep.currentDigest);
      if (info?.version) {
        dep.currentValue = info.version;
        // replaceString: SHA + closing quote + inline comment
        // e.g. `6c5e082b...29" # v5.12.0`
        dep.replaceString = info.replaceString;
        dep.autoReplaceStringTemplate = '{{currentDigest}}" # {{newValue}}';
      } else {
        dep.skipReason = 'unversioned-reference';
      }
    }
  }

  dependencies.forEach((value) => delete value.managerData);
  return dependencies.length ? { deps: dependencies } : null;
}
