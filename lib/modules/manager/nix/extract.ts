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
  const packageLockFile = getSiblingFileName(packageFile, 'flake.lock');
  const lockContents = await readLocalFile(packageLockFile, 'utf8');

  logger.trace(`nix.extractPackageFile(${lockContents})`);

  const deps: PackageDependency[] = [];

  const flakeLockParsed = NixFlakeLock.safeParse(lockContents);
  if (!flakeLockParsed.success) {
    logger.debug(
      { packageLockFile, error: flakeLockParsed.error },
      `invalid flake.lock file`,
    );
    return null;
  }

  const flakeLock = flakeLockParsed.data;
  const rootInputs = flakeLock.nodes.root.inputs;

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
      content?.includes(newDigest) // flake.nix contains the new digest
    ) {
      flakeOriginal.rev = newDigest;
    }

    // Try to get the actual ref/rev values from flake.nix content if available
    let actualRef = flakeOriginal.ref;
    let actualRev = flakeOriginal.rev;

    if (content && depName) {
      // Look for the dependency URL in flake.nix
      // Match patterns like: depName.url = "...?ref=<ref>&rev=<rev>..."
      const depUrlPattern = new RegExp(
        `${depName}\\.url\\s*=\\s*"([^"]+)"`,
        'm',
      );
      const urlMatch = content.match(depUrlPattern);
      if (urlMatch) {
        const url = urlMatch[1];

        // Handle GitHub shorthand format: github:owner/repo/ref_or_commit
        const githubShorthandMatch = /^github:[^/]+\/[^/]+\/(.+)$/.exec(url);
        if (githubShorthandMatch) {
          const refOrCommit = githubShorthandMatch[1];
          // Check if it's a commit hash (40 char hex) or a branch/tag ref
          if (/^[0-9a-f]{40}$/i.test(refOrCommit)) {
            actualRev = refOrCommit;
          } else {
            actualRef = refOrCommit;
          }
        }

        // Extract ref from URL query parameters
        const refMatch = /[?&]ref=([^&]+)/.exec(url);
        if (refMatch) {
          actualRef = refMatch[1];
        }
        // Extract rev from URL query parameters
        const revMatch = /[?&]rev=([^&]+)/.exec(url);
        if (revMatch) {
          actualRev = revMatch[1];
        }
      }
    }

    // Strip refs/tags/ or refs/heads/ prefix from ref if present
    const refValue = actualRef;
    let strippedRef = refValue;
    if (refValue?.startsWith('refs/tags/')) {
      strippedRef = refValue.replace('refs/tags/', '');
    } else if (refValue?.startsWith('refs/heads/')) {
      strippedRef = refValue.replace('refs/heads/', '');
    }

    // Determine the replaceString based on what's in flake.nix
    // If rev is specified, use rev; otherwise use the full ref
    const replaceString = actualRev ?? refValue ?? flakeLocked.rev;

    // use nixpkgsVersioning for all nixpkgs inputs
    if (
      flakeOriginal.type === 'github' &&
      flakeOriginal.owner?.toLowerCase() === 'nixos' &&
      flakeOriginal.repo === 'nixpkgs'
    ) {
      deps.push({
        depName,
        currentValue: strippedRef,
        currentDigest: actualRev,
        replaceString,
        lockedVersion: actualRev || refValue ? undefined : flakeLocked.rev,
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/NixOS/nixpkgs',
        versioning: nixpkgsVersioning,
      });
      continue;
    }

    // if the input contains a digest as rev, we can update it
    // otherwise set lockedVersion so it is updated during lock file maintenance
    switch (flakeLocked.type) {
      case 'github':
        logger.debug(
          `Processing github dep: ${depName}, ref=${strippedRef}, rev=${actualRev}, replaceString=${replaceString}`,
        );
        deps.push({
          depName,
          currentValue: strippedRef,
          currentDigest: actualRev,
          replaceString,
          lockedVersion: actualRev ? undefined : flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'github.com'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'gitlab':
        deps.push({
          depName,
          currentValue: strippedRef,
          currentDigest: actualRev,
          replaceString,
          lockedVersion: actualRev ? undefined : flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'gitlab.com'}/${decodeURIComponent(flakeOriginal.owner!)}/${flakeOriginal.repo}`,
        });
        break;
      case 'git':
        deps.push({
          depName,
          currentValue: strippedRef,
          currentDigest: actualRev,
          replaceString,
          lockedVersion: actualRev ? undefined : flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: flakeOriginal.url,
        });
        break;
      case 'sourcehut':
        deps.push({
          depName,
          currentValue: strippedRef,
          currentDigest: actualRev,
          replaceString,
          lockedVersion: actualRev ? undefined : flakeLocked.rev,
          datasource: GitRefsDatasource.id,
          packageName: `https://${flakeOriginal.host ?? 'git.sr.ht'}/${flakeOriginal.owner}/${flakeOriginal.repo}`,
        });
        break;
      case 'tarball':
        if (isLockableTarball) {
          const branch = flakeOriginal.url!.replace(
            lockableChannelOriginalUrl,
            '$<channel>',
          );
          const rev = flakeOriginal.url!.replace(
            lockableChannelLockedUrl,
            '$<ref>',
          );
          deps.push({
            depName,
            currentValue: branch,
            lockedVersion: rev,
            datasource: GitRefsDatasource.id,
            packageName: 'https://github.com/NixOS/nixpkgs',
          });
        } else {
          deps.push({
            depName,
            currentValue: strippedRef,
            currentDigest: actualRev,
            replaceString,
            lockedVersion: actualRev ? undefined : flakeLocked.rev,
            datasource: GitRefsDatasource.id,
            // type tarball always contains this link
            packageName: flakeOriginal.url!.replace(
              lockableHTTPTarballProtocol,
              'https://$<domain>/$<owner>/$<repo>',
            ),
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
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
