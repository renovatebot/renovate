import { id as npmId } from '../../datasource/npm';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  let deps: PackageDependency[] = [];
  const npmDepends = regEx(/\nNpm\.depends\({([\s\S]*?)}\);/).exec(content);
  if (!npmDepends) {
    return null;
  }
  try {
    deps = npmDepends[1]
      .replace(regEx(/(\s|\\n|\\t|'|")/g), '')
      .split(',')
      .map((dep) => dep.trim())
      .filter((dep) => dep.length)
      .map((dep) => dep.split(regEx(/:(.*)/)))
      .map((arr) => {
        const [depName, currentValue] = arr;
        // istanbul ignore if
        if (!(depName && currentValue)) {
          logger.warn({ content }, 'Incomplete npm.depends match');
        }
        return {
          depName,
          currentValue,
          datasource: npmId,
        };
      })
      .filter((dep) => dep.depName && dep.currentValue);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ content }, 'Failed to parse meteor package.js');
  }
  // istanbul ignore if
  if (!deps.length) {
    return null;
  }
  return { deps };
}
