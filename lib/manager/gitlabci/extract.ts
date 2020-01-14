import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import { PackageFile, PackageDependency } from '../common';

function skipCommentLines(
  lines: string[],
  lineNumber: number
): { lineNumber: number; line: string } {
  let ln = lineNumber;
  while (ln < lines.length - 1 && lines[ln].match(/^\s*#/)) {
    ln += 1;
  }
  return { line: lines[ln], lineNumber: ln };
}

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const imageMatch = line.match(/^\s*image:\s*'?"?([^\s]+|)'?"?\s*$/);
      if (imageMatch) {
        switch (imageMatch[1]) {
          case '': {
            const imageNameLine = skipCommentLines(lines, lineNumber + 1);
            const imageNameMatch = imageNameLine.line.match(
              /^\s*name:\s*'?"?([^\s]+|)'?"?\s*$/
            );

            if (imageNameMatch) {
              lineNumber = imageNameLine.lineNumber;
              logger.trace(`Matched image name on line ${lineNumber}`);
              const currentFrom = imageNameMatch[1];
              const dep = getDep(currentFrom);
              dep.managerData = { lineNumber };
              dep.depType = 'image-name';
              deps.push(dep);
            }
            break;
          }
          default: {
            logger.trace(`Matched image on line ${lineNumber}`);
            const currentFrom = imageMatch[1];
            const dep = getDep(currentFrom);
            dep.managerData = { lineNumber };
            dep.depType = 'image';
            deps.push(dep);
          }
        }
      }
      const services = line.match(/^\s*services:\s*$/);
      if (services) {
        logger.trace(`Matched services on line ${lineNumber}`);
        let foundImage: boolean;
        do {
          foundImage = false;
          const serviceImageLine = skipCommentLines(lines, lineNumber + 1);
          logger.trace(`serviceImageLine: "${serviceImageLine.line}"`);
          const serviceImageMatch = serviceImageLine.line.match(
            /^\s*-\s*'?"?([^\s'"]+)'?"?\s*$/
          );
          if (serviceImageMatch) {
            logger.trace('serviceImageMatch');
            foundImage = true;
            const currentFrom = serviceImageMatch[1];
            lineNumber = serviceImageLine.lineNumber;
            const dep = getDep(currentFrom);
            dep.managerData = { lineNumber };
            dep.depType = 'service-image';
            deps.push(dep);
          }
        } while (foundImage);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting GitLab CI dependencies');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
