import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];

      const first_line_match = regEx(/^\s* image:\s*(['"]([^\s'"]+)\\)$/).exec(
        line
      );
      if (first_line_match) {
        let currentFrom = first_line_match[2];
        let replaceString = first_line_match[1];

        for (let i = lineNumber + 1; i < lines.length; i += 1) {
          const internal_line = lines[i];
          const middle_line_match =
            regEx(/^(\s*([^\s'"]+)\\)$/).exec(internal_line);
          if (middle_line_match) {
            currentFrom += middle_line_match[2];
            replaceString += '\n' + middle_line_match[1];
          } else {
            const final_line_match = regEx(/^(\s*([^\s'"]+)['"])$/).exec(
              internal_line
            );
            if (final_line_match) {
              currentFrom += final_line_match[2];
              replaceString += '\n' + final_line_match[1];

              const dep = getDep(currentFrom);
              dep.depType = 'docker';
              dep.replaceString = replaceString;
              deps.push(dep);
            }
            break;
          }
        }
      } else {
        const match = regEx(/^\s* image:\s*'?"?([^\s'"]+)'?"?\s*$/).exec(line);
        if (match) {
          const dep = getDep(match[1]);
          dep.depType = 'docker';
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting DroneCI images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
