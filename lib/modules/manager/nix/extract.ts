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
    logger.debug({ packageFile, error: flakeLockParsed.error }, `invalid flake.lock file`);
    return null;
  }

  const flakeLock = flakeLockParsed.data;

  if (flakeLock.version !== 7) {
    logger.debug({ packageFile }, 'Unsupported flake lock version');
    return null;
  }

  for (const depName of Object.keys(flakeLock.nodes ?? {})) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (depName === 'root') {
      continue;
    }

    // skip if there are no inputs
    if (flakeLock.nodes === undefined) {
      continue;
    }

    const flakeInput = flakeLock.nodes[depName];
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
    if (flakeOriginal.type === 'indirect') {
      continue;
    }

    if (flakeLocked.type === 'github') {
      deps.push({
        depName,
        currentValue: flakeOriginal.ref,
        currentDigest: flakeLocked.rev,
        replaceString: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: `https://github.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
      });
    } else if (flakeLocked.type === 'gitlab') {
      deps.push({
        depName,
        currentValue: flakeOriginal.ref,
        currentDigest: flakeLocked.rev,
        replaceString: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: `https://gitlab.com/${flakeOriginal.owner}/${flakeOriginal.repo}`,
      });
    } else if (flakeOriginal.type === 'git') {
      deps.push({
        depName,
        currentValue: flakeOriginal.ref,
        currentDigest: flakeLocked.rev,
        replaceString: flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: flakeOriginal.url,
      });
    } else if (flakeLocked.type === 'sourcehut') {
      deps.push({
        depName,
        currentValue: flakeOriginal.ref,
        currentDigest: flakeLocked.rev,
        replaceString: flakeLocked.rev,
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
