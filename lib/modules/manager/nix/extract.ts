import { regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import type { PackageDependency, PackageFileContent } from '../types';

const nixpkgsRegex = regEx(/"github:nixos\/nixpkgs\/(?<ref>[a-z0-9-.]+)"/i);

export function extractPackageFile(content: string): PackageFileContent | null {
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

  if (deps.length) {
    return { deps };
  }

  return null;
}
