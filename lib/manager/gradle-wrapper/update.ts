import got from '../../util/got';
import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';
import { DISTRIBUTION_CHECKSUM_REGEX, DISTRIBUTION_URL_REGEX } from './search';

function replaceType(url: string): string {
  return url.replace('bin', 'all');
}

async function getChecksum(url: string): Promise<string> {
  try {
    const response = await got(url);
    return response.body as string;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug('Gradle checksum lookup failure: not found');
      logger.debug({ err });
    } else {
      logger.warn({ err }, 'Gradle checksum lookup failure: Unknown error');
    }
    throw err;
  }
}

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  try {
    logger.debug(upgrade, 'gradle-wrapper.updateDependency()');
    const lines = fileContent.split('\n');
    let { downloadUrl, checksumUrl } = upgrade;

    if (upgrade.managerData.gradleWrapperType === 'all') {
      downloadUrl = replaceType(downloadUrl);
      checksumUrl = replaceType(checksumUrl);
    }

    downloadUrl = downloadUrl.replace(':', '\\:');
    const checksum = await getChecksum(checksumUrl);

    lines[upgrade.managerData.lineNumber] = lines[
      upgrade.managerData.lineNumber
    ].replace(DISTRIBUTION_URL_REGEX, `$<assignment>${downloadUrl}`);

    if (upgrade.managerData.checksumLineNumber) {
      lines[upgrade.managerData.checksumLineNumber] = lines[
        upgrade.managerData.checksumLineNumber
      ].replace(DISTRIBUTION_CHECKSUM_REGEX, `$<assignment>${checksum}`);
    }
    // TODO: insert if not present

    return lines.join('\n');
  } catch (err) {
    logger.debug({ err }, 'Error setting new Gradle Wrapper release value');
    return null;
  }
}
