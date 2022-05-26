import { newlineRegex } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { currentValue, currentDigest, depName, newDigest, newName, newValue } =
    upgrade;

  let unfoldedLineNumbers: number[] = [];
  upgrade.managerData?.lineNumberRanges?.forEach((lineNumbers: number[]) => {
    unfoldedLineNumbers = unfoldedLineNumbers.concat(
      Array.from(
        { length: lineNumbers[1] - lineNumbers[0] + 1 },
        (_v, k) => k + lineNumbers[0]
      )
    );
  });

  let hasChanged = false;
  const lines = fileContent.split(newlineRegex);
  for (const lineNumber of unfoldedLineNumbers) {
    let line = lines[lineNumber];

    if (newName && depName && line.includes(depName)) {
      line = line.replace(depName, newName);
    }

    if (newValue && currentValue && line.includes(currentValue)) {
      line = line.replace(currentValue, newValue);
    }

    if (newDigest && currentDigest && line.includes(currentDigest)) {
      line = line.replace(currentDigest, newDigest);
    }

    if (line !== lines[lineNumber]) {
      lines[lineNumber] = line;
      hasChanged = true;
    }
  }

  const linefeed = fileContent.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  return hasChanged ? lines.join(linefeed) : fileContent;
}
