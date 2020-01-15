import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  const { depName, currentValue, newValue } = upgrade;
  logger.debug(`meteor.updateDependency(): ${depName} = ${newValue}`);
  const regexReplace = new RegExp(
    `('|")(${depName})('|"):(\\s+)('|")${currentValue}('|")`
  );
  const newFileContent = fileContent.replace(
    regexReplace,
    `$1$2$3:$4$5${newValue}$6`
  );
  return newFileContent;
}
