import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as gitRefVersionID } from '../../versioning/git';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { NixFlakeLock } from './schema';

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(?<domain>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+)/archive/(?<rev>.+).tar.gz$',
);

const lockableChannelOriginalUrl = regEx(
  '^https://channels.nixos.org/(?<channel>[^/]+)/nixexprs.tar.xz$',
);

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
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

    // if we are not in a root node then original and locked should always exist
    if (!flakeLocked || !flakeOriginal) {
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

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined) {
      continue;
    }

    // if there's a new digest, set the corresponding digest in the lockfile so confirmations pass
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
      versioning: gitRefVersionID,
    };

    // if rev is set, the flake contains a digest and can be updated directly
    // otherwise set lockedVersion so it is updated during lock file maintenance
    if (flakeOriginal.rev) {
      dep.currentValue = flakeOriginal.ref;
      dep.currentDigest = flakeOriginal.rev;
      dep.replaceString = flakeOriginal.rev;
    } else {
      dep.lockedVersion = flakeLocked.rev;
    }

    switch (flakeLocked.type) {
      case 'github':
        // set to nixpkgs if it is a nixpkgs reference
        if (
          flakeOriginal.owner?.toLowerCase() === 'nixos' &&
          flakeOriginal.repo?.toLowerCase() === 'nixpkgs'
        ) {
          dep.packageName = 'https://github.com/NixOS/nixpkgs';
          dep.currentValue = flakeOriginal.ref;
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
        // set to nixpkgs if it is a lockable channel URL
        if (
          flakeOriginal.url &&
          lockableChannelOriginalUrl.test(flakeOriginal.url)
        ) {
          dep.packageName = 'https://github.com/NixOS/nixpkgs';
          dep.currentValue = flakeOriginal.url.replace(
            lockableChannelOriginalUrl,
            '$<channel>',
          );
          dep.versioning = nixpkgsVersioning;
          break;
        }

        dep.packageName = flakeOriginal.url!.replace(
          lockableHTTPTarballProtocol,
          'https://$<domain>/$<owner>/$<repo>',
        );
        break;

      default:
        logger.debug(
          { flakeLockFile },
          `Flake type "${flakeLocked.type} not yet supported", skipping`,
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
