import { isNullOrUndefined, isString } from '@sindresorhus/is';
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

  // Post-process: for SHA-pinned GitHub module sources, recover the version
  // from the inline comment in the raw file content (the HCL parser strips
  // comments). Only relevant when a module resolved to a commit digest, so
  // files without a SHA-pinned module are not scanned at all.
  if (
    dependencies.some(
      (dep) => dep.depType === 'module' && isString(dep.currentDigest),
    )
  ) {
    // The version must be dotted-numeric (e.g. `v1.2.3`) so trailing comments
    // such as `# updated ...`, a bare date `# 2026-04-01`, or a bare integer
    // are not mistaken for a version (a dot-separated date like `# 2026.04.01`
    // remains an accepted but unlikely false positive). `[?&]ref=` plus the
    // trailing-parameter capture supports sources such as `?ref=<sha>&depth=1`
    // and `?depth=1&ref=<sha>`.
    const shaCommentRegex = regEx(
      /[?&]ref=(?<replaceString>(?<sha>[0-9a-f]{40})(?<suffix>[^"\r\n]*)"(?:[^\S\r\n]*#[^\S\r\n]*(?<version>v?\d+(?:\.\d+){1,2}\S*))?)/gi,
    );
    const shaInfoMap = new Map<
      string,
      { version: string | undefined; suffix: string; replaceString: string }
    >();
    for (const match of content.matchAll(shaCommentRegex)) {
      const { sha, suffix, version, replaceString } = match.groups!;
      // Prefer an occurrence that carries a version comment: when the same SHA
      // is pinned by multiple modules, a bare `?ref=<sha>` must not overwrite a
      // `?ref=<sha> # v1.2.3` recorded for that SHA.
      if (shaInfoMap.get(sha)?.version && !version) {
        continue;
      }
      shaInfoMap.set(sha, { version, suffix, replaceString });
    }

    for (const dep of dependencies) {
      if (dep.depType === 'module' && isString(dep.currentDigest)) {
        const info = shaInfoMap.get(dep.currentDigest);
        if (info?.version) {
          dep.currentValue = info.version;
          // Replace `<sha>[<params>]" # <version>`, bumping both the digest and
          // the version comment while preserving any trailing parameters.
          dep.replaceString = info.replaceString;
          dep.autoReplaceStringTemplate = `{{newDigest}}${info.suffix}"{{#if newValue}} # {{newValue}}{{/if}}`;
        } else {
          dep.skipReason = 'unversioned-reference';
        }
      }
    }
  }

  dependencies.forEach((value) => delete value.managerData);
  return dependencies.length ? { deps: dependencies } : null;
}
