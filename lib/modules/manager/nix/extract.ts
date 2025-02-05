import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { id as gitRefVersioning } from '../../versioning/git/index.ts';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { NixFlakeLock } from './schema.ts';

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(?<domain>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+)/archive/(?<rev>.+).tar.gz$',
);

const lockableChannelOriginalUrl = regEx(
  '^https://(?:channels\\.nixos\\.org|nixos\\.org/channels)/(?<channel>[^/]+)/nixexprs\\.tar\\.xz$',
);

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  const flakeLockFile = getSiblingFileName(packageFile, 'flake.lock');
  const flakeLockContents = await readLocalFile(flakeLockFile, 'utf8');

  logger.trace(`nix.extractPackageFile(${flakeLockFile})`);

  const deps: PackageDependency[] = [];

  if (packageFile.match(regEx(/\.nix$/))) {
    const nixpkgsMatch = nixpkgsRegex.exec(content);
    if (nixpkgsMatch?.groups) {
      const { ref } = nixpkgsMatch.groups;
      // only add when we matched a ref
      if (ref !== undefined) {
        deps.push({
          depName: 'nixpkgs',
          currentValue: ref,
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: nixpkgsVersioning,
        });

        if (deps.length) {
          return { deps };
        }
      }
    }
    return null;
  }

  const flakeLockParsed = NixFlakeLock.safeParse(lockContents);
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

    if (flakeLocked === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        `input is missing locked, skipping`,
      );
      continue;
    }

    if (flakeOriginal === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        `input is missing original, skipping`,
      );
      continue;
    }

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined) {
      continue;
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
    }

    deps.push(dep);
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
