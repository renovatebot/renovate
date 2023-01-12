import { regEx } from '../../../util/regex';

const SWIFT_TOOLS_VERSION_REGEX = regEx(
  /^\s*\/\/\s*swift-tools-version:\s*(?<version>\d+\.\d+(?:\.\d+)?)/
);

const SWIFT_TOOLS_SEMVER_REGEX = regEx(/\d+\.\d+\.\d+/);

/**
 * Extracts the Swift tools version from the given package file contents as a semver version.
 *
 * Tools version specification:
 * https://github.com/apple/swift-package-manager/blob/main/Documentation/Usage.md#swift-tools-version-specification
 */
export function extractSwiftToolsVersion(
  packageFileContent: string
): string | null {
  const toolsVersionMatch = SWIFT_TOOLS_VERSION_REGEX.exec(packageFileContent);

  if (toolsVersionMatch?.groups) {
    const version = toolsVersionMatch.groups.version;

    // The version is either '<major>.<minor>.<patch>' or '<major>.<minor>'
    // Ensure we always return a semver compatible version.
    if (version.match(SWIFT_TOOLS_SEMVER_REGEX)) {
      return version;
    } else {
      return version + '.0';
    }
  }

  return null;
}
