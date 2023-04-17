import { parse } from '@iarna/toml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { KrakenLockFile } from './types';

const packageNamePattern = '^([a-zA-Z0-9\\-_]+)';

export function extractPackageFile(
  content: string,
  fileName: string,
  _config?: ExtractConfig
): PackageFileContent | null {
  logger.info(`kraken.extractPackageFile(${fileName})`);

  let krakenLockFile: KrakenLockFile;
  try {
    krakenLockFile = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing .kraken.lock file');
    return null;
  }

  const requirements = krakenLockFile.requirements;
  const pinned = krakenLockFile.pinned;
  if (!requirements || !pinned) {
    logger.debug('Empty .kraken.lock file');
    return null;
  }

  const packageRequirements = requirements.requirements;
  if (!packageRequirements) {
    logger.debug('No Kraken requirements');
    return null;
  }

  const pkgRegex = regEx(packageNamePattern);
  const deps: PackageDependency[] = [];
  packageRequirements.forEach((packageRequirement) => {
    let dep: PackageDependency = {};
    const packageMatch = pkgRegex.exec(packageRequirement);
    if (!packageMatch) {
      logger.debug(
        `Cannot extract package name from ${packageRequirement} dependency`
      );
      return;
    }

    const [, depName] = packageMatch;
    const currentValue = pinned[depName.toLowerCase()];
    if (!currentValue) {
      logger.debug(`Skipping ${depName} as there is no pinned version`);
      return;
    }

    dep = {
      depName,
      currentValue,
      datasource: PypiDatasource.id,
    };
    deps.push(dep);
  });
  const res: PackageFileContent = { deps };

  if (requirements.index_url) {
    res.registryUrls = [requirements.index_url];
  }
  if (requirements.interpreter_constraint) {
    res.extractedConstraints = { python: requirements.interpreter_constraint };
  }
  return res;
}
