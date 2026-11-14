import { regEx } from '../../../util/regex.ts';
import type { UpdateDependencyConfig } from '../types.ts';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, currentValue, newValue, replaceString } = upgrade;
  if (!newValue) {
    return fileContent;
  }

  const cleanVersion = newValue
    .replace(regEx('([><=!~^&]+\\s*)v([0-9])', 'gi'), '$1$2')
    .replace(regEx('^v([0-9])', 'i'), '$1');

  if (replaceString && fileContent.includes(replaceString)) {
    let updatedItem: string;
    if (currentValue && replaceString.includes(currentValue)) {
      // Preserve comparison operator if newValue is a bare version without operators
      const opMatch = regEx('^(?<op>[><=!~^&]+\\s*)').exec(currentValue);
      if (
        opMatch?.groups?.op &&
        !currentValue.includes('&') &&
        !regEx('[><=!~^&]').test(cleanVersion)
      ) {
        updatedItem = replaceString.replace(
          currentValue,
          `${opMatch.groups.op}${cleanVersion}`,
        );
      } else {
        updatedItem = replaceString.replace(currentValue, cleanVersion);
      }
    } else {
      updatedItem = `${depName} >= ${cleanVersion}`;
    }

    const lines = fileContent.split(regEx('\\r?\\n'));
    let replaced = false;
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (
        !replaced &&
        !trimmed.startsWith('#') &&
        line.includes(replaceString)
      ) {
        replaced = true;
        return line.replace(replaceString, updatedItem);
      }
      return line;
    });

    if (replaced) {
      return newLines.join('\n');
    }

    return fileContent.replace(replaceString, updatedItem);
  }

  const formattedValue = regEx('^[><=!~^]').test(cleanVersion)
    ? cleanVersion
    : `>= ${cleanVersion}`;

  // Fallback: replacement matching double or single quoted package declaration
  return fileContent
    .replace(
      regEx(`"${depName}(?:\\s+[^"]*)?"`, 'g'),
      `"${depName} ${formattedValue}"`,
    )
    .replace(
      regEx(`'${depName}(?:\\s+[^']*)?'`, 'g'),
      `'${depName} ${formattedValue}'`,
    );
}
