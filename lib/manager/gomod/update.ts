import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`gomod.updateDependency: ${updateOptions.newValue}`);
    const { depName, depType } = updateOptions;
    let depNameNoVersion = depName
      .split('/')
      .slice(0, 3)
      .join('/');
    if (depNameNoVersion.startsWith('gopkg.in')) {
      depNameNoVersion = depNameNoVersion.replace(/\.v\d+$/, '');
    }
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    if (
      !lineToChange.includes(depNameNoVersion) &&
      !lineToChange.includes('rethinkdb/rethinkdb-go.v5')
    ) {
      logger.debug(
        { lineToChange, depName },
        "go.mod current line doesn't contain dependency"
      );
      return null;
    }
    let updateLineExp: RegExp;
    if (depType === 'replace') {
      updateLineExp = new RegExp(
        /^(replace\s+[^\s]+[\s]+[=][>]+\s+)([^\s]+\s+)([^\s]+)/
      );
    } else if (depType === 'require') {
      if (updateOptions.managerData.multiLine) {
        updateLineExp = new RegExp(/^(\s+[^\s]+)(\s+)([^\s]+)/);
      } else {
        updateLineExp = new RegExp(/^(require\s+[^\s]+)(\s+)([^\s]+)/);
      }
    }
    if (updateLineExp && !updateLineExp.test(lineToChange)) {
      logger.debug('No image line found');
      return null;
    }
    let newLine: string;
    if (updateOptions.updateType === 'digest') {
      const newDigestRightSized = updateOptions.newDigest.substring(
        0,
        updateOptions.currentDigest.length
      );
      if (lineToChange.includes(newDigestRightSized)) {
        return fileContent;
      }
      logger.debug(
        { depName, lineToChange, newDigestRightSized },
        'gomod: need to update digest'
      );
      newLine = lineToChange.replace(
        updateLineExp,
        `$1$2${newDigestRightSized}`
      );
    } else {
      newLine = lineToChange.replace(
        updateLineExp,
        `$1$2${updateOptions.newValue}`
      );
    }
    if (updateOptions.updateType === 'major') {
      logger.debug({ depName }, 'gomod: major update');
      if (depName.startsWith('gopkg.in/')) {
        const oldV = depName.split('.').pop();
        newLine = newLine.replace(`.${oldV}`, `.v${updateOptions.newMajor}`);
        // Package renames - I couldn't think of a better place to do this
        newLine = newLine.replace(
          'gorethink/gorethink.v5',
          'rethinkdb/rethinkdb-go.v5'
        );
      } else if (
        updateOptions.newMajor > 1 &&
        !newLine.includes(`/v${updateOptions.newMajor}`)
      ) {
        // If package has no version, pin to latest one.
        newLine = newLine.replace(
          depName,
          depName + '/v' + updateOptions.newMajor
        );
        if (/^v(0|1)\./.test(upgrade.currentValue)) {
          // Add version
          newLine = newLine.replace(
            updateLineExp,
            `$1/v${updateOptions.newMajor}$2$3`
          );
        } else {
          // Replace version
          const [oldV] = updateOptions.currentValue.split('.');
          newLine = newLine.replace(
            new RegExp(`/${oldV}(\\s+)`),
            `/v${updateOptions.newMajor}$1`
          );
        }
      }
    }
    if (lineToChange.endsWith('+incompatible')) {
      let toAdd = '+incompatible';

      if (updateOptions.updateType === 'major' && updateOptions.newMajor >= 2) {
        toAdd = '';
      }
      newLine += toAdd;
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[updateOptions.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new go.mod version');
    return null;
  }
}
