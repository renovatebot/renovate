import { isVersion } from '../../versioning/swift';
import { Upgrade } from '../common';

const fromParam = /^\s*from\s*:\s*"([^"]+)"\s*$/;

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string {
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const oldVal = isVersion(currentValue) ? `"${currentValue}"` : currentValue;
  let newVal;
  if (fromParam.test(oldVal)) {
    const [, version] = oldVal.match(fromParam);
    newVal = oldVal.replace(version, newValue);
  } else if (isVersion(newValue)) {
    newVal = `"${newValue}"`;
  } else {
    newVal = newValue;
  }
  if (rightPart.indexOf(oldVal) === 0) {
    return leftPart + rightPart.replace(oldVal, newVal);
  }
  if (rightPart.indexOf(newVal) === 0) {
    return fileContent;
  }
  return null;
}
