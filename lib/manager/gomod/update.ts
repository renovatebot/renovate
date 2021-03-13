import { logger } from '../../logger';
import type { UpdateDependencyConfig } from '../types';

function getDepNameWithNoVersion(depName: string): string {
  let depNameNoVersion = depName.split('/').slice(0, 3).join('/');
  if (depNameNoVersion.startsWith('gopkg.in')) {
    depNameNoVersion = depNameNoVersion.replace(/\.v\d+$/, '');
  }
  return depNameNoVersion;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`gomod.updateDependency: ${upgrade.newValue}`);
    const { depName, depType } = upgrade;
    const depNameNoVersion = getDepNameWithNoVersion(depName);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
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
      if (upgrade.managerData.multiLine) {
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
    if (upgrade.updateType === 'digest') {
      const newDigestRightSized = upgrade.newDigest.substring(
        0,
        upgrade.currentDigest.length
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
      newLine = lineToChange.replace(updateLineExp, `$1$2${upgrade.newValue}`);
    }
    if (upgrade.updateType === 'major') {
      logger.debug({ depName }, 'gomod: major update');
      if (depName.startsWith('gopkg.in/')) {
        const oldV = depName.split('.').pop();
        newLine = newLine.replace(`.${oldV}`, `.v${upgrade.newMajor}`);
        // Package renames - I couldn't think of a better place to do this
        newLine = newLine.replace(
          'gorethink/gorethink.v5',
          'rethinkdb/rethinkdb-go.v5'
        );
      } else if (
        upgrade.newMajor > 1 &&
        !newLine.includes(`/v${upgrade.newMajor}`)
      ) {
        if (depName === depNameNoVersion) {
          // If package currently has no version, pin to latest one.
          newLine = newLine.replace(depName, `${depName}/v${upgrade.newMajor}`);
        } else {
          // Replace version
          const [oldV] = upgrade.currentValue.split('.');
          newLine = newLine.replace(
            new RegExp(`/${oldV}(\\s+)`),
            `/v${upgrade.newMajor}$1`
          );
        }
      }
    }
    if (lineToChange.endsWith('+incompatible')) {
      let toAdd = '+incompatible';

      if (upgrade.updateType === 'major' && upgrade.newMajor >= 2) {
        toAdd = '';
      }
      newLine += toAdd;
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.debug({ err }, 'Error setting new go.mod version');
    return null;
  }
}
