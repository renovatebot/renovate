import { regEx } from '../../../util/regex';

const SWIFT_TOOLS_VERSION_REGEX = regEx(
  /^\s*\/\/\s*swift-tools-version:\s*(?<version>\d+\.\d+(?:\.\d+)?)/
);

/**
 * Extracts the Swift tools version from the given package file contents.
 *
 * Tools version specification:
 * https://github.com/apple/swift-package-manager/blob/main/Documentation/Usage.md#swift-tools-version-specification
 */
export function extractSwiftToolsVersion(
  packageFileContent: string
): string | null {
  const toolsVersionMatch = SWIFT_TOOLS_VERSION_REGEX.exec(packageFileContent);

  if (toolsVersionMatch?.groups) {
    return toolsVersionMatch.groups.version;
  }

  return null;
}
