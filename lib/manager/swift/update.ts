import { isVersion } from '../../versioning/swift';
import { UpdateDependencyConfig } from '../common';

const fromParam = /^\s*from\s*:\s*"([^"]+)"\s*$/;

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const oldVal = isVersion(currentValue) ? `"${currentValue}"` : currentValue;
  let newVal;
  if (fromParam.test(oldVal)) {
    const [, version] = fromParam.exec(oldVal);
    newVal = oldVal.replace(version, newValue);
  } else if (isVersion(newValue)) {
    newVal = `"${newValue}"`;
  } else {
    newVal = newValue;
  }
  if (rightPart.startsWith(oldVal)) {
    return leftPart + rightPart.replace(oldVal, newVal);
  }
  if (rightPart.startsWith(newVal)) {
    return fileContent;
  }
  return null;
}
