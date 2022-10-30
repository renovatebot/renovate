import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import type { PackageDependency, PackageFile } from '../types';
import {
  FlakeLockGitHubNode,
  FlakeLockNode,
  FlakeLockRootSchema,
} from './schema';

function isNixPkgs(input: FlakeLockNode): input is FlakeLockGitHubNode {
  return (
    'original' in input &&
    input.original.type === 'github' &&
    input.original.owner.toUpperCase() === 'NIXOS' &&
    input.original.repo.toUpperCase() === 'NIXPKGS'
  );
}

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFile | null> {
  const lockFileName = packageFile.replace(regEx(/\.nix$/), '.lock');
  const lockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (!lockFileContent) {
    logger.debug('No flake.lock found');
    return null;
  }

  try {
    const res = await FlakeLockRootSchema.safeParseAsync(
      JSON.parse(lockFileContent)
    );
    if (!res.success) {
      return null;
    }

    const deps: PackageDependency[] = [];
    for (const [, value] of Object.entries(res.data.nodes)) {
      if (isNixPkgs(value)) {
        deps.push({
          depName: 'nixpkgs',
          currentValue: value.original.ref,
          packageName: 'https://github.com/NixOS/nixpkgs',
          datasource: GitRefsDatasource.id,
          skipReason: 'unsupported-version',
        });
      }
    }

    if (deps.length) {
      return { deps };
    }
  } catch (err) {
    logger.warn({ err }, 'Error extracting nixpkgs');
  }

  return null;
}
