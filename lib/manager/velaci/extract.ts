import yaml from 'js-yaml';
import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(file: string): PackageFile | null {
  let doc;
  try {
    doc = yaml.safeLoad(file, { json: true });
  } catch (err) {
    logger.warn({ err, file }, 'Failed to parse Vela file.');
    return null;
  }
  let deps: PackageDependency[] = [];
  try {
    const lines = doc.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const match = /^\s* image:\s*'?"?([^\s'"]+)'?"?\s*$/.exec(line);
      if (match) {
        const currentFrom = match[1];
        const dep = getDep(currentFrom);
        logger.debug(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'VelaCI docker image'
        );
        dep.depType = 'docker';
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting VelaCI images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
