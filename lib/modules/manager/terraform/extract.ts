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
  const sourceDigestWithCommentRegex = regEx(
    /\?ref=(?<sha>[0-9a-f]{40})"(?:[^\S\r\n]*#[^\S\r\n]*(?<version>v?[^\s]+))?/gi,
  );
  for (const dep of dependencies) {
    if (dep.currentDigest && dep.depType === 'module') {
      const sha = dep.currentDigest;
      sourceDigestWithCommentRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      let found = false;
      while ((match = sourceDigestWithCommentRegex.exec(content)) !== null) {
        if (match.groups?.sha === sha) {
          found = true;
          const version = match.groups?.version;
          if (version) {
            dep.currentValue = version;
            // replaceString: everything from the SHA to end of inline comment
            // e.g. `6c5e082b...29" # v5.12.0`
            dep.replaceString = match[0].slice('?ref='.length);
            dep.autoReplaceStringTemplate = '{{currentDigest}}" # {{newValue}}';
          } else {
            dep.skipReason = 'unversioned-reference';
          }
          break;
        }
      }
      if (!found && !dep.currentValue && !dep.skipReason) {
        dep.skipReason = 'unversioned-reference';
      }
    }
  }

  dependencies.forEach((value) => delete value.managerData);
  return dependencies.length ? { deps: dependencies } : null;
}
