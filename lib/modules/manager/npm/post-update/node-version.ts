import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger';
import type { ToolConstraint } from '../../../../util/exec/types';
import { readLocalFile } from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import type { PostUpdateConfig, Upgrade } from '../../types';
import type { LazyPackageJson } from './utils';

async function getNodeFile(filename: string): Promise<string | null> {
  try {
    // TODO #22198
    const constraint = (await readLocalFile(filename, 'utf8'))!
      .split(newlineRegex)[0]
      .replace(regEx(/^v/), '');
    if (semver.validRange(constraint)) {
      logger.debug(`Using node constraint "${constraint}" from ${filename}`);
      return constraint;
    }
  } catch (err) {
    // do nothing
  }
  return null;
}

async function getPackageJsonConstraint(
  pkg: LazyPackageJson,
): Promise<string | null> {
  const constraint = (await pkg.getValue()).engines?.node;
  if (constraint && semver.validRange(constraint)) {
    logger.debug(`Using node constraint "${constraint}" from package.json`);
    return constraint;
  }
  return null;
}

// export only for testing
export async function getNodeConstraint(
  config: Partial<PostUpdateConfig>,
  upgrades: Upgrade[],
  lockFileDir: string,
  pkg: LazyPackageJson,
): Promise<string | null> {
  const constraint =
    getNodeUpdate(upgrades) ??
    config.constraints?.node ??
    (await getNodeFile(upath.join(lockFileDir, '.nvmrc'))) ??
    (await getNodeFile(upath.join(lockFileDir, '.node-version'))) ??
    (await getPackageJsonConstraint(pkg));
  if (!constraint) {
    logger.debug('No node constraint found - using latest');
  }
  return constraint;
}

export function getNodeUpdate(upgrades: Upgrade[]): string | undefined {
  return upgrades.find((u) => u.depName === 'node')?.newValue;
}

export async function getNodeToolConstraint(
  config: Partial<PostUpdateConfig>,
  upgrades: Upgrade[],
  lockFileDir: string,
  pkg: LazyPackageJson,
): Promise<ToolConstraint> {
  const constraint = await getNodeConstraint(
    config,
    upgrades,
    lockFileDir,
    pkg,
  );

  return {
    toolName: 'node',
    constraint,
  };
}
