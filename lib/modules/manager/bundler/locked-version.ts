import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { isVersion } from '../../versioning/ruby';

const DEP_REGEX = regEx(/\((?<version>.*)\)/);

function stripPlatformSuffix(version: string, platforms: string[]): string {
  for (const platform of platforms) {
    if (version.endsWith(`-${platform}`)) {
      return version.slice(0, -platform.length - 1);
    }
  }
  return version;
}

function extractPlatforms(content: string): string[] {
  const platforms: string[] = [];
  let inPlatformsSection = false;

  for (const line of content.split(newlineRegex)) {
    const trimmed = line.trim();
    const indent = line.indexOf(trimmed);

    if (indent === 0 && trimmed === 'PLATFORMS') {
      inPlatformsSection = true;
    } else if (indent === 0 && trimmed && inPlatformsSection) {
      break;
    } else if (indent === 2 && inPlatformsSection && trimmed) {
      platforms.push(trimmed);
    }
  }

  return platforms;
}

export function extractLockFileEntries(
  lockFileContent: string,
): Map<string, string> {
  const gemLock = new Map<string, string>();

  try {
    const platforms = extractPlatforms(lockFileContent);
    let inGemSection = false;

    for (const line of lockFileContent.split(newlineRegex)) {
      const trimmed = line.trim();
      const indent = line.indexOf(trimmed);

      if (indent === 0 && trimmed === 'GEM') {
        inGemSection = true;
      } else if (indent === 0 && trimmed && inGemSection) {
        inGemSection = false;
      } else if (indent === 4 && inGemSection) {
        const version = line.match(DEP_REGEX)?.groups?.version;
        if (version) {
          const name = line.replace(`(${version})`, '').trim();
          const cleanedVersion = stripPlatformSuffix(version, platforms);

          if (!gemLock.has(name) && isVersion(cleanedVersion)) {
            gemLock.set(name, cleanedVersion);
          }
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, `Failed to parse Bundler lockfile`);
  }

  return gemLock;
}
