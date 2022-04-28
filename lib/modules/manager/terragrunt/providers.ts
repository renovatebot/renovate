import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import { TerragruntDependencyTypes } from './common';
import type { ExtractionResult, TerraformManagerData } from './types';
import { keyValueExtractionRegex } from './util';

export const sourceExtractionRegex = regEx(
  /^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/
);

function extractBracesContent(content: string): number {
  const stack: string[] = [];
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
  const deps: PackageDependency<TerraformManagerData>[] = [];
  const managerData: TerraformManagerData = {
    moduleName,
    terragruntDependencyType: TerragruntDependencyTypes.terragrunt,
  };
  const dep: PackageDependency<TerraformManagerData> = { managerData };
  const teraformContent = lines
    .slice(lineNumber)
    .join('\n')
    .substring(0, extractBracesContent(lines.slice(lineNumber).join('\n')))
    .split(newlineRegex);

  for (let lineNo = 0; lineNo < teraformContent.length; lineNo += 1) {
    line = teraformContent[lineNo];
    const kvGroups = keyValueExtractionRegex.exec(line)?.groups;
    if (kvGroups) {
      managerData.source = kvGroups.value;
      managerData.sourceLine = lineNumber + lineNo;
    }
  }
  deps.push(dep);
  return { lineNumber, dependencies: deps };
}
