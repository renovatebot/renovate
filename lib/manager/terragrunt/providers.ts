import type { PackageDependency } from '../types';
import {
  ExtractionResult,
  TerragruntDependencyTypes,
  keyValueExtractionRegex,
} from './util';

export const sourceExtractionRegex = /^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/;

function extractBracesContent(content): number {
  const stack = [];
  let i = 0;
  for (i; i < content.length; i += 1) {
    if (content[i] === '{') {
      stack.push(content[i]);
    } else if (content[i] === '}') {
      stack.pop();
      if (stack.length === 0) {
        break;
      }
    }
  }
  return i;
}

export function extractTerragruntProvider(
  startingLine: number,
  lines: string[],
  moduleName: string
): ExtractionResult {
  const lineNumber = startingLine;
  let line: string;
  const deps: PackageDependency[] = [];
  const dep: PackageDependency = {
    managerData: {
      moduleName,
      terragruntDependencyType: TerragruntDependencyTypes.terragrunt,
    },
  };
  const teraformContent = lines
    .slice(lineNumber)
    .join('\n')
    .substring(0, extractBracesContent(lines.slice(lineNumber).join('\n')))
    .split('\n');

  for (let lineNo = 0; lineNo < teraformContent.length; lineNo += 1) {
    line = teraformContent[lineNo];
    const kvMatch = keyValueExtractionRegex.exec(line);
    if (kvMatch) {
      dep.managerData.source = kvMatch.groups.value;
      dep.managerData.sourceLine = lineNumber + lineNo;
    }
  }
  deps.push(dep);
  return { lineNumber, dependencies: deps };
}
