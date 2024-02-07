import { logger } from '../../../../../../logger';
import { regEx } from '../../../../../../util/regex';

export function replaceConstraintVersion(
  lockFileContent: string,
  depName: string,
  constraint: string,
  newVersion: string,
  newConstraint?: string,
): string {
  if (lockFileContent.startsWith('__metadata:')) {
    // Yarn 2+
    return lockFileContent;
  }
  const depNameConstraint = `${depName}@${constraint}`;
  const escaped = depNameConstraint.replace(/(@|\^|\.|\\|\|)/g, '\\$1');
  const matchString = `(${escaped}(("|",|,)[^\n:]*)?:\n)(.*\n)*?(\\s+dependencies|\n[@a-z])`;
  // yarn will fill in the details later
  const matchResult = regEx(matchString).exec(lockFileContent);
  // istanbul ignore if
  if (!matchResult) {
    logger.debug(
      { depName, constraint, newVersion },
      'Could not find constraint in lock file',
    );
    return lockFileContent;
  }
  let constraintLine = matchResult[1];
  if (newConstraint) {
    const newDepNameConstraint = `${depName}@${newConstraint}`;
    constraintLine = constraintLine.replace(
      depNameConstraint,
      newDepNameConstraint,
    );
  }
  return lockFileContent.replace(
    regEx(matchString),
    `${constraintLine}  version "${newVersion}"\n$5`,
  );
}
