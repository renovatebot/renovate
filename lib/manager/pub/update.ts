import { load } from 'js-yaml';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string {
  const { depName, depType, currentValue, newValue } = upgrade;

  if (currentValue === newValue) return fileContent;

  const sectionBeginRegExp = new RegExp(`^${depType}:`);
  const isSectionBegin = (line: string): boolean =>
    sectionBeginRegExp.test(line);
  const isSectionEnd = (line: string): boolean => /^[^\s]/.test(line);

  const simpleDepRegExp = new RegExp(`^\\s+${depName}:\\s*[^\\s]+\\s*$`);
  const isOneLineDep = (line: string): boolean => simpleDepRegExp.test(line);

  const multilineDepRegExp = new RegExp(`^\\s+${depName}:\\s*$`);
  const isMultilineDepRegExp = (line: string): boolean =>
    multilineDepRegExp.test(line);

  const versionRegExp = new RegExp('^\\s+version:\\s*[^\\s]+\\s*$');
  const isVersionLine = (line: string): boolean => versionRegExp.test(line);

  const isValidVersion = (line: string): boolean => {
    const version = load(line.replace(/^.*:\s*/, '')).toString();
    return version === currentValue;
  };

  let isSection = false;
  let indent = null;

  const lines = fileContent.split('\n');
  const len = lines.length;
  for (let idx = 0; idx < len; idx += 1) {
    const line = lines[idx];

    if (isSectionBegin(line)) {
      isSection = true;
    } else if (isSectionEnd(line)) {
      isSection = false;
    } else if (isSection) {
      if (isOneLineDep(line)) {
        if (!isValidVersion(line)) return null;
        lines[idx] = line.replace(currentValue, newValue);
        break;
      } else if (isMultilineDepRegExp(line)) {
        indent = line.search(/[^\s]/);
      } else if (indent) {
        const currentIndent = line.search(/[^\s]/);
        if (currentIndent <= indent) {
          indent = null;
        } else if (isVersionLine(line)) {
          if (!isValidVersion(line)) return null;
          lines[idx] = line.replace(currentValue, newValue);
          break;
        }
      }
    }
  }

  return lines.join('\n');
}
