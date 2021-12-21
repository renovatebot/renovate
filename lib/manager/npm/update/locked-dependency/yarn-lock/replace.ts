import { regEx } from '../../../../../util/regex';

export function replaceConstraintVersion(
  lockFileContent: string,
  depNameConstraint: string,
  newVersion: string,
  newDepNameConstraint?: string
): string {
  const escaped = depNameConstraint.replace(/(@|\^|\.)/g, '\\$1');
  const matchString = `(${escaped}((",|,)[^\n:]+)?:\n)(.*\n)*?(\\s+dependencies|\n[@a-z])`;
  // yarn will fill in the details later
  const matchResult = regEx(matchString).exec(lockFileContent);
  let constraintLine = matchResult[1];
  if (newDepNameConstraint) {
    constraintLine = constraintLine.replace(
      depNameConstraint,
      newDepNameConstraint
    );
  }
  return lockFileContent.replace(
    regEx(matchString),
    `${constraintLine}  version: "${newVersion}"\n$5`
  );
}
