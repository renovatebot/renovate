import got from '../../util/got';
import { logger } from '../../logger';
import { Upgrade } from '../common';

function replaceType(url: string): string {
  return url.replace('bin', 'all');
}

async function getChecksum(url: string): Promise<string> {
  try {
    const response = await got(url);
    return response.body as string;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info('Gradle checksum lookup failure: not found');
      logger.debug({ err });
    } else {
      logger.warn({ err }, 'Gradle checksum lookup failure: Unknown error');
    }
    throw err;
  }
}

export async function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): Promise<string | null> {
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

    lines[upgrade.managerData.lineNumber] = `distributionUrl=${downloadUrl}`;

    if (upgrade.managerData.checksumLineNumber) {
      lines[
        upgrade.managerData.checksumLineNumber
      ] = `distributionSha256Sum=${checksum}`;
    }
    // TODO: insert if not present

    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gradle Wrapper release value');
    return null;
  }
}
