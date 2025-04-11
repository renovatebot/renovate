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
  '^https://nixos.org/channels/(?<channel>[^/]+)/nixexprs.tar.xz$',
);
const lockableChannelLockedUrl = regEx(
  '^https://releases.nixos.org/nixpkgs/(?<channel>[^/-]+)-(?<release>[^/]+)pre[0-9]+.(?<ref>[^/]+)/nixexprs.tar.xz$',
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
    }
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

    const isLockableTarball =
      flakeOriginal.url && lockableChannelOriginalUrl.test(flakeOriginal.url);

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined && !isLockableTarball) {
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
          rangeStrategy: 'update-lockfile',
        });
        break;

      case 'gitlab':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'gitlab.com'}/${decodeURIComponent(flakeOriginal.owner!)}/${flakeOriginal.repo}`,
          rangeStrategy: 'update-lockfile',
        });
        break;

      case 'git':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: flakeOriginal.url,
          rangeStrategy: 'update-lockfile',
        });
        break;

      case 'sourcehut':
        deps.push({
          depName,
          currentValue: flakeOriginal.ref,
          currentDigest: flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'git.sr.ht'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
          rangeStrategy: 'update-lockfile',
        });
        break;

      case 'tarball':
        if (isLockableTarball) {
          const branch = flakeOriginal.url!.replace(
            lockableChannelOriginalUrl,
            '$<channel>',
          );
          const rev = flakeLocked.url!.replace(
            lockableChannelLockedUrl,
            '$<ref>',
          );
          deps.push({
            depName,
            currentValue: branch,
            currentDigest: rev,
            datasource: GitRefsDatasource.id,
            packageName: 'https://github.com/NixOS/nixpkgs',
            rangeStrategy: 'update-lockfile',
          });
        } else {
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
            rangeStrategy: 'update-lockfile',
          });
        }
        break;
      // istanbul ignore next: just a safeguard
      default:
        logger.debug(
          { packageLockFile },
          `Unknown flake.lock type "${flakeLocked.type}", skipping`,
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
