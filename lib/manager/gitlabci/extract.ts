import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

function skipCommentLines(
  lines: string[],
  lineNumber: number
): { lineNumber: number; line: string } {
  let ln = lineNumber;
  const commentsRe = /^\s*#/;
  while (ln < lines.length - 1 && commentsRe.test(lines[ln])) {
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
      const imageMatch = /^\s*image:\s*'?"?([^\s'"]+|)'?"?\s*$/.exec(line);
      if (imageMatch) {
        switch (imageMatch[1]) {
          case '': {
            const imageNameLine = skipCommentLines(lines, lineNumber + 1);
            const imageNameMatch = /^\s*name:\s*'?"?([^\s'"]+|)'?"?\s*$/.exec(
              imageNameLine.line
            );

            if (imageNameMatch) {
              lineNumber = imageNameLine.lineNumber;
              logger.trace(`Matched image name on line ${lineNumber}`);
              const currentFrom = imageNameMatch[1];
              const dep = getDep(currentFrom);
              dep.depType = 'image-name';
              deps.push(dep);
            }
            break;
          }
          default: {
            logger.trace(`Matched image on line ${lineNumber}`);
            const currentFrom = imageMatch[1];
            const dep = getDep(currentFrom);
            dep.depType = 'image';
            deps.push(dep);
          }
        }
      }
      const services = /^\s*services:\s*$/.test(line);
      if (services) {
        logger.trace(`Matched services on line ${lineNumber}`);
        let foundImage: boolean;
        do {
          foundImage = false;
          const serviceImageLine = skipCommentLines(lines, lineNumber + 1);
          logger.trace(`serviceImageLine: "${serviceImageLine.line}"`);
          const serviceImageMatch = /^\s*-\s*'?"?([^\s'"]+)'?"?\s*$/.exec(
            serviceImageLine.line
          );
          if (serviceImageMatch) {
            logger.trace('serviceImageMatch');
            foundImage = true;
            const currentFrom = serviceImageMatch[1];
            lineNumber = serviceImageLine.lineNumber;
            const dep = getDep(currentFrom);
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
