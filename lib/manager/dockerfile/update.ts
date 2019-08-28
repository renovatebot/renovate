import { logger } from '../../logger';
import { Upgrade } from '../common';

export function getNewFrom(upgrade: Upgrade): string {
  const { depName, newValue, newDigest } = upgrade;
  let newFrom = depName;
  if (newValue) {
    newFrom += `:${newValue}`;
  }
  if (newDigest) {
    newFrom += `@${newDigest}`;
  }
  return newFrom;
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    const { lineNumber, fromSuffix } = upgrade.managerData;
    let { fromPrefix } = upgrade.managerData;
    const newFrom = getNewFrom(upgrade);
    logger.debug(`docker.updateDependency(): ${newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[lineNumber];
    const imageLine = new RegExp(/^(FROM |COPY --from=)/i);
    if (!lineToChange.match(imageLine)) {
      logger.debug('No image line found');
      return null;
    }
    if (!fromPrefix.endsWith('=')) {
      fromPrefix += ' ';
    }
    const newLine = `${fromPrefix}${newFrom} ${fromSuffix}`.trim();
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
