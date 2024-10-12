import { GitRefsDatasource } from '../../datasource/git-refs';
import { logger } from '../../../logger';
import type { PackageDependency, PackageFileContent } from '../types';
import { InputType, NixFlakeLock } from './types';

// TODO: add support to update nixpkgs branches in flakes.nix using nixpkgsVersioning

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`nix.extractPackageFile(${packageFile})`);

  const deps: PackageDependency[] = [];
  let lock: NixFlakeLock;

  try {
    lock = JSON.parse(content);
  } catch {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  if (lock.version !== 7) {
    logger.debug({ packageFile }, 'Unsupported flake lock version');
    return null;
  }

  for (const depName of Object.keys(lock.nodes ?? {})) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (depName === 'root') {
      continue;
    }

    const flakeInput = lock.nodes[depName];
    const flakeLocked = flakeInput.locked;
    const flakeOriginal = flakeInput.original;

    if (flakeLocked === undefined || flakeOriginal === undefined) {
      logger.debug(
        { packageFile },
        `Found empty flake input '${JSON.stringify(flakeInput)}', skipping`,
      );
      continue;
    }

    // indirect inputs cannot be updated via normal means
    if (flakeOriginal.type === InputType.indirect) {
      continue;
    }

    if (flakeLocked.type === InputType.github) {
      deps.push({
        depName,
        currentDigest: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: `https://github.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
      });
    } else if (flakeLocked.type === InputType.gitlab) {
      deps.push({
        depName,
        currentDigest: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: `https://gitlab.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
      });
    } else if (flakeOriginal.type === InputType.git) {
      deps.push({
        depName,
        currentDigest: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: flakeOriginal.url,
      });
    } else if (flakeLocked.type === InputType.sourcehut) {
      deps.push({
        depName,
        currentDigest: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: `https://git.sr.ht/${flakeOriginal.owner}/${flakeOriginal.repo}`,
      });
    } else {
      logger.debug(
        { packageFile },
        `Unknown flake.lock type "${flakeLocked.type}", skipping`,
      );
      continue;
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
