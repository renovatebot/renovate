import { logger } from '../../logger';
import { dependencyPattern } from './extract';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    if (upgrade.currentValue === upgrade.newValue) return fileContent;
    logger.debug(`pip_requirements.updateDependency(): ${upgrade.newValue}`);
    const lines = fileContent.split('\n');
    const oldValue = lines[upgrade.managerData.lineNumber];
    let newValue;
    const multiDependencyRegex = new RegExp(
      `(install_requires\\s*[=]\\s*\\[.*)(${upgrade.depName}.+?(?='))(.*])`,
      'g'
    );
    const multipleDependencyMatch = multiDependencyRegex.exec(oldValue);
    if (multipleDependencyMatch) {
      const dependency = multipleDependencyMatch[2];
      const updatedDependency = dependency.replace(
        new RegExp(dependencyPattern),
        `$1$2${upgrade.newValue}`
      );
      newValue = oldValue.replace(
        multiDependencyRegex,
        `$1${updatedDependency}$3`
      );
    } else {
      newValue = oldValue.replace(
        new RegExp(dependencyPattern),
        `$1$2${upgrade.newValue}`
      );
    }
    lines[upgrade.managerData.lineNumber] = newValue;
    const result = lines.join('\n');

    const { currentDigest, newDigest } = upgrade;
    if (currentDigest && newDigest) {
      return result.replace(currentDigest, newDigest);
    }

    return result;
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
