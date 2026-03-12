import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { getDigest } from '../../datasource/index.ts';
import { scm } from '../../platform/scm.ts';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import type { PackageResolvedPin } from './schema.ts';
import { PackageResolvedJson } from './schema.ts';

async function findPackageResolvedFiles(): Promise<string[]> {
  const fileList = await scm.getFileList();
  return fileList.filter((f) => f.endsWith('Package.resolved'));
}

function normalizeUrl(url: string): string {
  return url
    .replace(regEx(/\.git$/), '')
    .replace(regEx(/\/$/), '')
    .toLowerCase();
}

function matchPinForDep(
  dep: PackageDependency,
  pins: PackageResolvedPin[],
): PackageResolvedPin | null {
  let depUrl: string;

  if (dep.datasource === GitTagsDatasource.id) {
    depUrl = dep.depName ?? '';
  } else {
    const registryUrl = dep.registryUrls?.[0] ?? 'https://github.com';
    depUrl = `${registryUrl}/${dep.depName}`;
  }

  const normalizedDepUrl = normalizeUrl(depUrl);

  return (
    pins.find((pin) => normalizeUrl(pin.location) === normalizedDepUrl) ?? null
  );
}

async function resolveCommitSha(
  dep: Upgrade,
  newVersion: string,
): Promise<string | null> {
  if (dep.newDigest) {
    return dep.newDigest;
  }

  const datasource = dep.datasource;
  const packageName = dep.packageName ?? dep.depName;
  if (!datasource || !packageName) {
    return null;
  }

  try {
    const digest = await getDigest(
      {
        datasource,
        packageName,
        registryUrls: dep.registryUrls,
      },
      newVersion,
    );
    return digest;
  } catch (err) {
    logger.debug(
      { err, packageName, newVersion },
      'swift: failed to resolve commit SHA',
    );
    return null;
  }
}

function updatePinInJson(
  content: string,
  pin: PackageResolvedPin,
  newVersion: string,
  newRevision: string | null,
): string {
  let updated = content;

  // Find the pin block by its unique identity value
  const identityPattern = regEx(
    `"identity"\\s*:\\s*"${escapeRegExp(pin.identity)}"`,
  );
  const identityMatch = identityPattern.exec(updated);
  /* istanbul ignore if: identity always exists after JSON parse + matchPinForDep */
  if (!identityMatch) {
    return content;
  }

  // Find the enclosing object block (search for the opening brace before identity)
  const beforeIdentity = updated.slice(0, identityMatch.index);
  const blockStart = beforeIdentity.lastIndexOf('{');
  /* istanbul ignore if: valid JSON always has enclosing braces */
  if (blockStart === -1) {
    return content;
  }

  // Find the closing brace of this pin block (handle nested braces)
  let braceDepth = 0;
  let blockEnd = -1;
  for (let i = blockStart; i < updated.length; i++) {
    if (updated[i] === '{') {
      braceDepth++;
    } else if (updated[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        blockEnd = i + 1;
        break;
      }
    }
  }
  /* istanbul ignore if: valid JSON always has matching braces */
  if (blockEnd === -1) {
    return content;
  }

  let pinBlock = updated.slice(blockStart, blockEnd);

  // Replace version within the pin block
  const versionPattern = regEx(/("version"\s*:\s*)"[^"]*"/);
  pinBlock = pinBlock.replace(versionPattern, `$1"${newVersion}"`);

  // Replace revision within the pin block if we have a new one
  if (newRevision) {
    const revisionPattern = regEx(/("revision"\s*:\s*)"[^"]*"/);
    pinBlock = pinBlock.replace(revisionPattern, `$1"${newRevision}"`);
  }

  updated = updated.slice(0, blockStart) + pinBlock + updated.slice(blockEnd);
  return updated;
}

export async function updateArtifacts({
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (config.isLockFileMaintenance) {
    logger.debug('swift: lockFileMaintenance is not supported');
    return null;
  }

  if (!updatedDeps.length) {
    logger.debug('swift: no updatedDeps, nothing to do');
    return null;
  }

  const resolvedFiles = await findPackageResolvedFiles();
  if (!resolvedFiles.length) {
    logger.debug('swift: no Package.resolved files found');
    return null;
  }

  const results: UpdateArtifactsResult[] = [];

  for (const resolvedFile of resolvedFiles) {
    const content = await readLocalFile(resolvedFile, 'utf8');
    if (!content) {
      logger.debug({ resolvedFile }, 'swift: could not read Package.resolved');
      continue;
    }

    const parseResult = PackageResolvedJson.safeParse(content);
    if (!parseResult.success) {
      logger.debug(
        { resolvedFile, error: parseResult.error },
        'swift: could not parse Package.resolved',
      );
      continue;
    }

    const parsed = parseResult.data;
    let updated = content;

    for (const dep of updatedDeps) {
      const newVersion = dep.newVersion;
      if (!newVersion) {
        continue;
      }

      const pin = matchPinForDep(dep, parsed.pins);
      if (!pin) {
        logger.debug(
          { depName: dep.depName },
          'swift: no matching pin found in Package.resolved',
        );
        continue;
      }

      // Skip if already up-to-date
      if (pin.state.version === newVersion) {
        logger.debug(
          { depName: dep.depName, newVersion },
          'swift: pin already at target version',
        );
        continue;
      }

      const newRevision = await resolveCommitSha(dep, newVersion);
      updated = updatePinInJson(updated, pin, newVersion, newRevision);
    }

    if (updated !== content) {
      results.push({
        file: {
          type: 'addition',
          path: resolvedFile,
          contents: updated,
        },
      });
    }
  }

  return results.length ? results : null;
}
