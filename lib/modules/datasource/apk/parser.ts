import { logger } from '../../../logger';
import type { ApkPackage } from './types';

/**
 * Parses an APK index file content and extracts package information
 *
 * @param indexContent - The extracted text content from APKINDEX.tar.gz file
 *                       (tar.gz extraction is handled upstream)
 * @returns Array of parsed APK package objects
 */
export function parseApkIndex(indexContent: string): ApkPackage[] {
  logger.debug('Parsing APK index content');

  const packages: ApkPackage[] = [];

  try {
    logger.debug(`APK index content length: ${indexContent.length}`);
    logger.debug(
      `APK index content preview: ${indexContent.substring(0, 200)}`,
    );

    // Split by package entries (each package is separated by a blank line)
    const packageEntries = indexContent
      .split('\n\n')
      .filter((entry) => entry.trim());

    logger.debug(`Found ${packageEntries.length} package entries in APK index`);

    for (const entry of packageEntries) {
      const lines = entry.split('\n');
      const packageInfo: Partial<ApkPackage> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          continue;
        }

        const key = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1).trim();

        switch (key) {
          case 'P':
            packageInfo.name = value;
            break;
          case 'V':
            packageInfo.version = value;
            break;
          case 'T':
            packageInfo.description = value;
            break;
          case 'U':
            packageInfo.url = value;
            break;
          case 'S':
            packageInfo.size = parseInt(value);
            break;
          case 'I':
            packageInfo.buildDate = parseInt(value);
            break;
          case 'o':
            packageInfo.origin = value;
            break;
          case 'A':
            packageInfo.arch = value;
            break;
          case 'L':
            packageInfo.license = value;
            break;
          case 'D':
            packageInfo.depends = value ? value.split(' ') : [];
            break;
          case 'p':
            packageInfo.provides = value ? value.split(' ') : [];
            break;
          case 'c':
            packageInfo.conflicts = value ? value.split(' ') : [];
            break;
          case 'r':
            packageInfo.replaces = value ? value.split(' ') : [];
            break;
        }
      }

      if (packageInfo.name && packageInfo.version) {
        packages.push(packageInfo as ApkPackage);
      } else {
        logger.warn(
          { packageInfo },
          'Skipping package entry due to missing required fields',
        );
      }
    }

    logger.debug(`Parsed ${packages.length} packages from APK index`);
    return packages;
  } catch (err) {
    logger.warn({ err }, 'Error parsing APK index');
    return [];
  }
}
