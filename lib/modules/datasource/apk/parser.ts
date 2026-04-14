import readline from 'readline';
import { logger } from '../../../logger/index.ts';
import * as fs from '../../../util/fs/index.ts';
import type { ApkPackage } from './types.ts';

function applyApkIndexLine(
  line: string,
  packageInfo: Partial<ApkPackage>,
): void {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return;
  }

  // get fields based on the PKGINFO spec - https://wiki.alpinelinux.org/wiki/Apk_spec
  const key = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1).trim();

  switch (key) {
    case 'P':
      packageInfo.name = value;
      break;
    case 'V':
      packageInfo.version = value;
      break;
    case 'U':
      packageInfo.url = value;
      break;
    case 't':
      packageInfo.buildDate = parseInt(value, 10);
      break;
    default:
      break;
  }
}

function flushApkPackage(packageInfo: Partial<ApkPackage>): ApkPackage | null {
  if (packageInfo.name && packageInfo.version) {
    return packageInfo as ApkPackage;
  }
  if (Object.keys(packageInfo).length) {
    logger.warn(
      { packageInfo },
      'Skipping package entry due to missing required fields',
    );
  }
  return null;
}

/**
 * Parses an APK index file line-by-line to avoid loading large indexes into memory.
 *
 * @param extractedFile - Path to the extracted `APKINDEX` file (relative to Renovate cache).
 */
export async function parseApkIndexFile(
  extractedFile: string,
): Promise<ApkPackage[]> {
  logger.debug({ extractedFile }, 'Parsing APK index file');

  const packages: ApkPackage[] = [];
  const rl = readline.createInterface({
    input: fs.createCacheReadStream(extractedFile),
    terminal: false,
  });

  let packageInfo: Partial<ApkPackage> = {};

  for await (const line of rl) {
    if (line === '') {
      const pkg = flushApkPackage(packageInfo);
      if (pkg) {
        packages.push(pkg);
      }
      packageInfo = {};
    } else {
      applyApkIndexLine(line, packageInfo);
    }
  }

  const last = flushApkPackage(packageInfo);
  if (last) {
    packages.push(last);
  }

  logger.debug(`Parsed ${packages.length} packages from APK index`);
  return packages;
}

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
    logger.trace(
      `APK index content preview: ${indexContent.substring(0, 200)}`,
    );

    let packageInfo: Partial<ApkPackage> = {};
    const lines = indexContent.split(/\r?\n/);

    for (const line of lines) {
      if (line === '') {
        const pkg = flushApkPackage(packageInfo);
        if (pkg) {
          packages.push(pkg);
        }
        packageInfo = {};
      } else {
        applyApkIndexLine(line, packageInfo);
      }
    }

    const last = flushApkPackage(packageInfo);
    if (last) {
      packages.push(last);
    }

    logger.debug(`Parsed ${packages.length} packages from APK index`);
    return packages;
  } catch (err) {
    logger.warn({ err }, 'Error parsing APK index');
    return [];
  }
}
