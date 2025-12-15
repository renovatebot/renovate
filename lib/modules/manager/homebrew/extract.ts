import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { PackageFileContent } from '../types';
import { findHandler } from './handlers';
import { extractRubyString } from './utils';

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('extractPackageFile()');

  // Extract class name: "class ClassName < Formula"
  const classRegex = regEx(/\bclass\s+(?<className>\w+)\s*<\s*Formula\b/);
  const classMatch = content.match(classRegex);
  if (!classMatch?.groups) {
    logger.debug('Invalid class definition');
    return null;
  }
  const className = classMatch.groups.className;

  // Extract URL and SHA256 using shared utilities
  const url = extractRubyString(content, 'url');
  const sha256 = extractRubyString(content, 'sha256');

  // Validate SHA256
  if (!sha256 || sha256?.length !== 64) {
    logger.debug('Error: Invalid sha256 field');
    return {
      deps: [{ depName: className, skipReason: 'invalid-sha256' }],
    };
  }

  // Find handler for URL
  const result = findHandler(url);
  if (!result) {
    logger.debug('Error: Unsupported URL field');
    return {
      deps: [{ depName: className, skipReason: 'unsupported-url' }],
    };
  }

  // Create dependency using handler
  const dep = result.handler.createDependency(result.parsed, sha256, url!);
  return { deps: [dep] };
}
