import { logger } from '../../logger';
import { dependencyPattern } from './extract';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(
      `pip_requirements.updateDependency(): ${updateOptions.newValue}`
    );
    const lines = fileContent.split('\n');
    const oldValue = lines[updateOptions.managerData.lineNumber];
    let newValue;
    const multiDependencyRegex = new RegExp(
      `(install_requires\\s*[=]\\s*\\[.*)(${updateOptions.depName}.+?(?='))(.*])`,
      'g'
    );
    const multipleDependencyMatch = multiDependencyRegex.exec(oldValue);
    if (multipleDependencyMatch) {
      const dependency = multipleDependencyMatch[2];
      const updatedDependency = dependency.replace(
        new RegExp(dependencyPattern),
        `$1$2${updateOptions.newValue}`
      );
      newValue = oldValue.replace(
        multiDependencyRegex,
        `$1${updatedDependency}$3`
      );
    } else {
      newValue = oldValue.replace(
        new RegExp(dependencyPattern),
        `$1$2${updateOptions.newValue}`
      );
    }
    lines[updateOptions.managerData.lineNumber] = newValue;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
