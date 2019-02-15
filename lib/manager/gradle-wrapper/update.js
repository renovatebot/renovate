const got = require('got');

module.exports = {
  updateDependency,
};

async function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(upgrade, 'gradle-wrapper.updateDependency()');
    const lines = fileContent.split('\n');
    let { downloadUrl, checksumUrl } = upgrade;

    if (upgrade.gradleWrapperType === 'all') {
      downloadUrl = replaceType(downloadUrl);
      checksumUrl = replaceType(checksumUrl);
    }

    downloadUrl = downloadUrl.replace(':', '\\:');
    const checksum = await getChecksum(checksumUrl);

    lines[upgrade.lineNumber] = `distributionUrl=${downloadUrl}`;

    if (upgrade.checksumLineNumber) {
      lines[upgrade.checksumLineNumber] = `distributionSha256Sum=${checksum}`;
    }
    // TODO: insert if not present

    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gradle Wrapper release value');
    return null;
  }
}

function replaceType(url) {
  return url.replace('bin', 'all');
}

async function getChecksum(url) {
  try {
    const response = await got(url, {});
    return response.body;
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
