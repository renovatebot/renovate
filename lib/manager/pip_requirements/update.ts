import { logger } from '../../logger';
import { dependencyPattern } from './extract';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  try {
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
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
