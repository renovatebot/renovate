import { logger } from '../../logger';
import {
  PackageFile,
  PackageDependency,
  ExtractPackageFileConfig,
} from '../common';
import { DATASOURCE_NPM } from '../../constants/data-binary-source';

export function extractPackageFile({
  fileContent,
}: ExtractPackageFileConfig): PackageFile | null {
  let deps: PackageDependency[] = [];
  const npmDepends = fileContent.match(/\nNpm\.depends\({([\s\S]*?)}\);/);
  if (!npmDepends) {
    return null;
  }
  try {
    deps = npmDepends[1]
      .replace(/(\s|\\n|\\t|'|")/g, '')
      .split(',')
      .map(dep => dep.trim())
      .filter(dep => dep.length)
      .map(dep => dep.split(/:(.*)/))
      .map(arr => {
        const [depName, currentValue] = arr;
        // istanbul ignore if
        if (!(depName && currentValue)) {
          logger.warn({ fileContent }, 'Incomplete npm.depends match');
        }
        return {
          depName,
          currentValue,
          datasource: DATASOURCE_NPM,
        };
      })
      .filter(dep => dep.depName && dep.currentValue);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ fileContent }, 'Failed to parse meteor package.js');
  }
  // istanbul ignore if
  if (!deps.length) {
    return null;
  }
  return { deps };
}
