import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger';
import type { ToolConstraint } from '../../../../util/exec/types';
import { readLocalFile } from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import type { PostUpdateConfig, Upgrade } from '../../types';

async function getNodeFile(filename: string): Promise<string | null> {
  try {
    // TODO #7154
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

function getPackageJsonConstraint(
  config: Partial<PostUpdateConfig>
): string | null {
  const constraint: string =
    config.constraints?.node ?? config.extractedConstraints?.node;
  if (constraint && semver.validRange(constraint)) {
    logger.debug(`Using node constraint "${constraint}" from package.json`);
    return constraint;
  }
  return null;
}

export async function getNodeConstraint(
  config: Partial<PostUpdateConfig>,
  lockFileDir: string
): Promise<string | null> {
  // TODO: fix types (#7154)
  const constraint =
    (await getNodeFile(upath.join(lockFileDir, '.nvmrc'))) ??
    (await getNodeFile(upath.join(lockFileDir, '.node-version'))) ??
    getPackageJsonConstraint(config);
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
  lockFileDir: string
): Promise<ToolConstraint> {
  const constraint =
    getNodeUpdate(upgrades) ?? (await getNodeConstraint(config, lockFileDir));

  return {
    toolName: 'node',
    constraint,
  };
}
