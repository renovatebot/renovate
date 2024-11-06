import { logger } from '../../../logger';
import { getSiblingFileName } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import type { PackageDependency, PackageFileContent } from '../types';
import { NixFlakeLock } from './schema';

// TODO: add support to update nixpkgs branches in flakes.nix using nixpkgsVersioning

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(.+)/(.+)/(.+)/archive/(.+).tar.gz$',
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const packageLockFile = getSiblingFileName(packageFile, 'flake.lock');

  logger.trace(`nix.extractPackageFile(${packageLockFile})`);

  const deps: PackageDependency[] = [];

  const flakeLockParsed = NixFlakeLock.safeParse(content);
  if (!flakeLockParsed.success) {
    logger.debug(
      { packageLockFile, error: flakeLockParsed.error },
      `invalid flake.lock file`,
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;

  for (const depName of Object.keys(flakeLock.nodes)) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (depName === 'root') {
      continue;
    }

    // skip all locked nodes which are not in the flake.nix and cannot be updated
    // istanbul ignore if: a valid flake.lock file will never run into this
    if (!(depName in (flakeLock.nodes['root'].inputs ?? []))) {
      logger.debug(
        { packageLockFile, error: flakeLockParsed.error },
        `invalid flake.lock file because cannot find "root" node`,
      );
      continue;
    }

    const flakeInput = flakeLock.nodes[depName];
    const flakeLocked = flakeInput.locked;
    const flakeOriginal = flakeInput.original;

    // istanbul ignore if: if we are not in a root node then original and locked always exist which cannot be easily expressed in the type
    if (flakeLocked === undefined || flakeOriginal === undefined) {
      logger.debug(
        { packageLockFile },
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
          packageName: `https://${flakeOriginal.host ?? 'github.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'gitlab':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'gitlab.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
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
          packageName: `https://${flakeOriginal.host ?? 'git.sr.ht'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'tarball':
        deps.push({
          depName,
          currentValue: flakeLocked.ref,
          currentDigest: flakeLocked.rev,
          replaceString: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          // istanbul ignore next: type tarball always contains this link
          packageName: (flakeOriginal.url ?? '').replace(
            lockableHTTPTarballProtocol,
            'https://$1/$2/$3',
          ),
        });
        break;
      // istanbul ignore next: just a safeguard
      default:
        logger.debug(
          { packageLockFile },
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
