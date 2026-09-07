import { newlineRegex } from '../../../util/regex.ts';
import type { ExtractionResult } from '../terraform/types.ts';
import type { PackageDependency } from '../types.ts';
import type { TerraformManagerData } from './types.ts';
import { keyValueExtractionRegex } from './util.ts';

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
  moduleName: string,
): ExtractionResult<TerraformManagerData> {
  const lineNumber = startingLine;
  let line: string;
  const deps: PackageDependency<TerraformManagerData>[] = [];
  const managerData: TerraformManagerData = { moduleName };
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
