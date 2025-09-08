import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import { id as semverCoercedVersioning } from '../../versioning/semver-coerced';
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

    // indirect inputs cannot be reliably updated because they depend on the flake registry
    if (flakeOriginal.type === 'indirect' || flakeLocked.type === 'indirect') {
      logger.debug(
        { flakeLockFile, flakeInput },
        `input is type ${flakeOriginal.type}, skipping`,
      );
      continue;
    }

    // cannot update local path inputs
    if (flakeOriginal.type === 'path' || flakeLocked.type === 'path') {
      logger.debug(
        { flakeLockFile, flakeInput },
        `input is type ${flakeOriginal.type}, skipping`,
      );
      continue;
    }

    // if no rev is being tracked, we cannot update this input
    if (flakeLocked.rev === undefined) {
      logger.debug(
        { flakeLockFile, flakeInput },
        `locked input is not tracking a rev, skipping`,
      );
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
      logger.debug(
        { flakeLockFile, flakeInput },
        `overriding rev ${flakeOriginal.rev} with new digest ${newDigest}`,
      );
      flakeOriginal.rev = newDigest;
    }

    // Try to get the actual ref/rev values from flake.nix content if available
    let actualRef = flakeOriginal.ref;
    let actualRev = flakeOriginal.rev;

    // Parse flake.nix to find the actual URL and extract ref/rev
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
    let strippedRef = actualRef;
    if (actualRef?.startsWith('refs/tags/')) {
      strippedRef = actualRef.replace('refs/tags/', '');
    } else if (actualRef?.startsWith('refs/heads/')) {
      strippedRef = actualRef.replace('refs/heads/', '');
    }

    const dep: PackageDependency = {
      depName,
      datasource: GitRefsDatasource.id,
      versioning: semverCoercedVersioning,
    };

    // if rev is set, the flake contains a digest and can be updated directly
    // if ref is set without rev, set currentValue to the ref for branch tracking
    // otherwise set lockedVersion so it is updated during lock file maintenance
    if (actualRev) {
      dep.currentValue = strippedRef;
      dep.currentDigest = actualRev;
      dep.replaceString = actualRev;
    } else if (strippedRef) {
      // Branch or tag tracking - set currentValue and replaceString
      dep.currentValue = strippedRef;
      dep.replaceString = actualRef || strippedRef;
      dep.lockedVersion = flakeLocked.rev;
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
          // Clear replaceString for nixpkgs as it uses special handling
          delete dep.replaceString;
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
          // Clear replaceString for nixpkgs as it uses special handling
          delete dep.replaceString;
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
