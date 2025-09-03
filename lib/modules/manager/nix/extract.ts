import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import type { PackageDependency, PackageFileContent } from '../types';
import { NixFlakeLock } from './schema';

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(?<domain>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+)/archive/(?<rev>.+).tar.gz$',
);

const lockableChannelOriginalUrl = regEx(
  '^https://nixos.org/channels/(?<channel>[^/]+)/nixexprs.tar.xz$',
);
const lockableChannelLockedUrl = regEx(
  '^https://releases.nixos.org/nixpkgs/(?<channel>[^/-]+)-(?<release>[^/]+)pre[0-9]+.(?<ref>[^/]+)/nixexprs.tar.xz$',
);

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: Record<string, any>,
): Promise<PackageFileContent | null> {
  // flake.lock
  const flakeLockFile = getSiblingFileName(packageFile, 'flake.lock');
  const flakeLockContents = await readLocalFile(flakeLockFile, 'utf8');

  logger.trace(`nix.extractPackageFile(${flakeLockContents})`);

  const deps: PackageDependency[] = [];

  const flakeLockParsed = NixFlakeLock.safeParse(flakeLockContents);
  if (!flakeLockParsed.success) {
    logger.debug(
      { flakeLockFile, error: flakeLockParsed.error },
      `invalid flake.lock file`,
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;
  const rootInputs = flakeLock.nodes.root.inputs;

  if (!rootInputs) {
    logger.debug(
      { flakeLockFile, error: flakeLockParsed.error },
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

    // flakeLocked example: { rev: '56a49ffef2908dad1e9a8adef1f18802bc760962', type: 'github' }
    const flakeLocked = flakeInput.locked;
    // flakeOriginal example: { owner: 'NuschtOS', repo: 'search', type: 'github' }
    const flakeOriginal = flakeInput.original;

    // istanbul ignore if: if we are not in a root node then original and locked always exist which cannot be easily expressed in the type
    if (flakeLocked === undefined || flakeOriginal === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        `Found empty flake input, skipping`,
      );
      continue;
    }

    // indirect inputs cannot be reliably updated because they depend on the flake registry
    if (flakeOriginal.type === 'indirect') {
      continue;
    }

    const isLockableTarball =
      flakeOriginal.url && lockableChannelOriginalUrl.test(flakeOriginal.url);

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined && !isLockableTarball) {
      continue;
    }

    // istanbul ignore if: if there's a new digest, set the corresponding digest in the lockfile so confirmations pass
    const currentDigest = config?.currentDigest;
    const newDigest = config?.newDigest;
    if (
      currentDigest &&
      newDigest &&
      flakeOriginal.rev &&
      flakeOriginal.rev === currentDigest && // currentDigest is the old digest
      content.includes(newDigest) // flake.nix contains the new digest
    ) {
      flakeOriginal.rev = newDigest;
    }

    const dep: PackageDependency = {
      depName,
      datasource: GitRefsDatasource.id,
      currentDigest: flakeOriginal.rev,
      replaceString: flakeOriginal.rev,

      // if rev is set, the dep contains a digest and can be updated directly
      currentValue: flakeOriginal.rev ? flakeOriginal.ref : undefined,
      // otherwise, set lockedVersion so it is updated during lock file maintenance
      lockedVersion: flakeOriginal.rev ? undefined : flakeLocked.rev,
    };

    switch (flakeLocked.type) {
      case 'github':
        // special case for the main nixpkgs repo to use the dedicated versioning scheme
        if (
          flakeOriginal.owner === 'NixOS' &&
          flakeOriginal.repo === 'nixpkgs'
        ) {
          dep.packageName = 'https://github.com/NixOS/nixpkgs';
          dep.depName = 'nixpkgs';
          dep.versioning = nixpkgsVersioning;
          break;
        }

        dep.packageName = `https://${flakeOriginal.host ?? 'github.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`;
        break;

      case 'gitlab':
        dep.packageName = `https://${flakeOriginal.host ?? 'gitlab.com'}/${decodeURIComponent(flakeOriginal.owner!)}/${flakeOriginal.repo}`;
        break;

      case 'git':
        dep.packageName = flakeOriginal.url;
        break;

      case 'sourcehut':
        dep.packageName = `https://${flakeOriginal.host ?? 'git.sr.ht'}/${flakeOriginal.owner}/${flakeOriginal.repo}`;
        break;

      case 'tarball':
        if (isLockableTarball) {
          dep.packageName = 'https://github.com/NixOS/nixpkgs';

          // lockable tarballs do not have a flakeLocked.rev, but we can extract it from the URL
          dep.lockedVersion = flakeLocked.url!.replace(
            lockableChannelLockedUrl,
            '$<ref>',
          );
          break;
        }

        dep.packageName = flakeOriginal.url!.replace(
          lockableHTTPTarballProtocol,
          'https://$<domain>/$<owner>/$<repo>',
        );
        break;

      // istanbul ignore next: just a safeguard
      default:
        logger.debug(
          { flakeLockFile },
          `Unknown flake.lock type "${flakeLocked.type}", skipping`,
        );

        continue;
    }

    deps.push(dep);
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
