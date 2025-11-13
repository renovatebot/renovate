import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { getHttpUrl, parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import type { PackageDependency, PackageFileContent } from '../types';
import { NixFlakeLock } from './schema';

// as documented upstream
// https://github.com/NixOS/nix/blob/master/doc/manual/source/protocols/tarball-fetcher.md#gitea-and-forgejo-support
const lockableHTTPTarballProtocol = regEx(
  '^https://(?<domain>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+)/archive/(?<rev>.+)\\.tar\\.gz$',
);

const lockableChannelOriginalUrl = regEx(
  '^https://(?:channels\\.nixos\\.org|nixos\\.org/channels)/(?<channel>[^/]+)/nixexprs\\.tar\\.xz$',
);

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const flakeLockFile = getSiblingFileName(packageFile, 'flake.lock');
  const flakeLockContents = await readLocalFile(flakeLockFile, 'utf8');
  const deps: PackageDependency[] = [];

  logger.trace({ flakeLockFile }, 'nix.extractPackageFile()');

  const flakeLockParsed = NixFlakeLock.safeParse(flakeLockContents);
  if (!flakeLockParsed.success) {
    logger.debug(
      { flakeLockFile, error: flakeLockParsed.error },
      'invalid flake.lock file',
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;
  const rootInputs = new Map(
    Object.entries(flakeLock.nodes.root?.inputs ?? {}).map(([key, value]) => [
      value,
      key,
    ]),
  );

  if (!rootInputs.size) {
    logger.debug({ flakeLockFile }, 'flake.lock is missing "root" node');
    return null;
  }

  for (const [node, flakeInput] of Object.entries(flakeLock.nodes)) {
    // the root input is a magic string for the entrypoint and only references other flake inputs
    if (node === 'root') {
      continue;
    }

    // skip all locked and transitive nodes as they cannot be updated by regular means
    if (!rootInputs.has(node)) {
      continue;
    }

    const flakeLocked = flakeInput.locked;
    const flakeOriginal = flakeInput.original;

    if (flakeLocked === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        'input is missing locked, skipping',
      );
      continue;
    }

    if (flakeOriginal === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        'input is missing original, skipping',
      );
      continue;
    }

    // indirect inputs cannot be reliably updated because they depend on the flake registry
    if (flakeOriginal.type === 'indirect' || flakeLocked.type === 'indirect') {
      logger.debug(
        { flakeLockFile, flakeInput },
        'input is of type indirect, skipping',
      );
      continue;
    }

    // cannot update local path inputs
    if (flakeOriginal.type === 'path' || flakeLocked.type === 'path') {
      logger.debug(
        { flakeLockFile, flakeInput },
        'input is of type path, skipping',
      );
      continue;
    }

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        'locked input is not tracking a rev, skipping',
      );
      continue;
    }

    const dep: PackageDependency = {
      depName: rootInputs.get(node),
      datasource: GitRefsDatasource.id,
    };

    dep.currentValue = flakeOriginal.ref?.replace(/^refs\/(heads|tags)\//, '');
    dep.currentDigest = flakeLocked.rev;

    switch (flakeLocked.type) {
      case 'git':
        const gitUrl = parseGitUrl(flakeOriginal.url!);

        if (gitUrl.protocols.includes('file')) {
          continue;
        }

        dep.packageName = gitUrl.toString();
        break;

      case 'github':
        // set to nixpkgs if it is a nixpkgs reference
        if (
          flakeOriginal.owner?.toLowerCase() === 'nixos' &&
          flakeOriginal.repo?.toLowerCase() === 'nixpkgs'
        ) {
          dep.packageName = 'https://github.com/NixOS/nixpkgs';
          dep.versioning = nixpkgsVersioning;
          break;
        }

        dep.packageName = `https://${flakeOriginal.host ?? 'github.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`;
        break;

      case 'gitlab':
        dep.packageName = `https://${flakeOriginal.host ?? 'gitlab.com'}/${decodeURIComponent(flakeOriginal.owner!)}/${flakeOriginal.repo}`;
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

    if (flakeLocked.type !== 'tarball') {
      dep.sourceUrl = getHttpUrl(dep.packageName!).replace(/\.git$/, '');
    }

    deps.push(dep);
  }

  if (deps.length === 0) {
    return null;
  }

  return { deps };
}
