import { isArray, isNullOrUndefined } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import type { ToolConstraint } from '../../../../util/exec/types.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { newlineRegex } from '../../../../util/regex.ts';
import { stripVersionPrefix } from '../../../../util/string.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { resolveToolConstraint } from '../../util.ts';
import type { LazyPackageJson } from './types.ts';

async function getNodeFile(filename: string): Promise<string | null> {
  try {
    // TODO #22198
    const constraint = stripVersionPrefix(
      (await readLocalFile(filename, 'utf8'))!.split(newlineRegex)[0],
    );
    if (semver.validRange(constraint)) {
      logger.debug(`Using node constraint "${constraint}" from ${filename}`);
      return constraint;
    }
  } catch {
    // do nothing
  }
  return null;
}

async function getDevEnginesConstraint(
  pkg: LazyPackageJson,
): Promise<string | null> {
  const runtime = (await pkg.getValue()).devEngines?.runtime;
  const runtimes = isArray(runtime) ? runtime : [runtime];
  const constraint = runtimes.find((r) => r?.name === 'node')?.version;
  if (constraint && semver.validRange(constraint)) {
    logger.debug(
      `Using node constraint "${constraint}" from package.json devEngines`,
    );
    return constraint;
  }
  return null;
}

async function getPackageJsonConstraint(
  pkg: LazyPackageJson,
): Promise<string | null> {
  const pkgJson = await pkg.getValue();
  if (pkgJson.volta?.node) {
    const constraint = pkgJson.volta.node;
    // v8 ignore else -- TODO: add test #40625
    if (semver.validRange(constraint)) {
      logger.debug(
        `Using node constraint "${constraint}" from package.json volta`,
      );
      return constraint;
    }
  }
  if (pkgJson.engines?.node) {
    const constraint = pkgJson.engines.node;
    // v8 ignore else -- TODO: add test #40625
    if (semver.validRange(constraint)) {
      logger.debug(
        `Using node constraint "${constraint}" from package.json engines`,
      );
      return constraint;
    }
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
  let constraint: string | null | undefined = getNodeUpdate(upgrades);
  if (isNullOrUndefined(constraint)) {
    constraint = await resolveToolConstraint(config, 'node', async () => {
      let nodeConstraint = await getDevEnginesConstraint(pkg);
      if (isNullOrUndefined(nodeConstraint)) {
        nodeConstraint = await getNodeFile(upath.join(lockFileDir, '.nvmrc'));
      }
      if (isNullOrUndefined(nodeConstraint)) {
        nodeConstraint = await getNodeFile(
          upath.join(lockFileDir, '.node-version'),
        );
      }
      if (isNullOrUndefined(nodeConstraint)) {
        nodeConstraint = await getPackageJsonConstraint(pkg);
      }
      return nodeConstraint;
    });
  }
  constraint ??= null;
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
