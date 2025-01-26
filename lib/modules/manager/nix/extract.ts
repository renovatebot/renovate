import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import type { PackageDependency, PackageFileContent } from '../types';
import { NixFlakeLock } from './schema';

const nixpkgsRegex = regEx(/"github:nixos\/nixpkgs(\/(?<ref>[a-z0-9-.]+))?"/i);

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(?<domain>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+)/archive/(?<rev>.+).tar.gz$',
);

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const packageLockFile = getSiblingFileName(packageFile, 'flake.lock');
  const lockContents = await readLocalFile(packageLockFile, 'utf8');

  logger.trace(`nix.extractPackageFile(${packageLockFile})`);

  const deps: PackageDependency[] = [];

  const match = nixpkgsRegex.exec(content);
  if (match?.groups) {
    const { ref } = match.groups;
    deps.push({
      depName: 'nixpkgs',
      currentValue: ref,
      datasource: GitRefsDatasource.id,
      packageName: 'https://github.com/NixOS/nixpkgs',
      versioning: nixpkgsVersioning,
    });
  }

  const flakeLockParsed = NixFlakeLock.safeParse(lockContents);
  if (!flakeLockParsed.success) {
    logger.debug(
      { packageLockFile, error: flakeLockParsed.error },
      `invalid flake.lock file`,
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;
  const rootInputs = flakeLock.nodes['root'].inputs;

  if (!rootInputs) {
    logger.debug(
      { packageLockFile, error: flakeLockParsed.error },
      `flake.lock is missing "root" node`,
    );

    if (deps.length) {
      return { deps };
    }
    return null;
  }

  for (const [depName, flakeInput] of Object.entries(flakeLock.nodes)) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (depName === 'root') {
      continue;
    }

    // skip all locked and transitivie nodes as they cannot be updated by regular means
    if (!(depName in rootInputs)) {
      continue;
    }

    const flakeLocked = flakeInput.locked;
    const flakeOriginal = flakeInput.original;

    // istanbul ignore if: if we are not in a root node then original and locked always exist which cannot be easily expressed in the type
    if (flakeLocked === undefined || flakeOriginal === undefined) {
      logger.debug(
        { packageLockFile, flakeInput },
        `Found empty flake input, skipping`,
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
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'github.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'gitlab':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'gitlab.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'git':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: flakeOriginal.url,
        });
        break;
      case 'sourcehut':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'git.sr.ht'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'tarball':
        deps.push({
          depName,
          currentValue: flakeLocked.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          // type tarball always contains this link
          packageName: flakeOriginal.url!.replace(
            lockableHTTPTarballProtocol,
            'https://$<domain>/$<owner>/$<repo>',
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
