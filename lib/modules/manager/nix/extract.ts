import { logger } from '../../../logger';
import { GitRefsDatasource } from '../../datasource/git-refs';
import type { PackageDependency, PackageFileContent } from '../types';
import { NixFlakeLock } from './schema';

// TODO: add support to update nixpkgs branches in flakes.nix using nixpkgsVersioning

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`nix.extractPackageFile(${packageFile})`);

  const deps: PackageDependency[] = [];

  const flakeLockParsed = NixFlakeLock.safeParse(content);
  if (!flakeLockParsed.success) {
    logger.debug(
      { packageFile, error: flakeLockParsed.error },
      `invalid flake.lock file`,
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;

  // skip if there are no inputs
  if (flakeLock.nodes === undefined) {
    return null;
  }

  for (const depName of Object.keys(flakeLock.nodes)) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (depName === 'root') {
      continue;
    }

    // skip all locked nodes which are not in the flake.nix and cannot be updated
    if (!(depName in (flakeLock.nodes['root'].inputs ?? []))) {
      continue;
    }

    const flakeInput = flakeLock.nodes[depName];
    const flakeLocked = flakeInput.locked;
    const flakeOriginal = flakeInput.original;

    // istanbul ignore if: if we are not in a root node then original and locked always exist which cannot be easily expressed in the type
    if (flakeLocked === undefined || flakeOriginal === undefined) {
      logger.debug(
        { packageFile },
        `Found empty flake input '${JSON.stringify(flakeInput)}', skipping`,
      );
      continue;
    }

    // indirect inputs cannot be reliable updated because they depend on the flake registry
    if (flakeOriginal.type === 'indirect') {
      continue;
    }

    switch (flakeLocked.type) {
      case 'github':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://github.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'gitlab':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://gitlab.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'git':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: flakeOriginal.url,
        });
        break;
      case 'sourcehut':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://git.sr.ht/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      // istanbul ignore next: just a safeguard
      default:
        logger.debug(
          { packageFile },
          `Unknown flake.lock type "${flakeLocked.type}", skipping`,
        );
        break;
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
