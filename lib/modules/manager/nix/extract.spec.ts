import { GitRefsDatasource } from '../../datasource/git-refs';
import { extractPackageFile } from '.';

describe('modules/manager/nix/extract', () => {
  it('returns null when no nixpkgs', () => {
    const content = `{
  inputs = {};
}`;
    const res = extractPackageFile(content);

    expect(res).toBeNull();
  });

  it('returns nixpkgs', () => {
    const content = `{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-21.11";
  };
}`;

    const res = extractPackageFile(content);

    expect(res?.deps).toHaveLength(1);
    expect(res?.deps).toEqual([
      {
        depName: 'nixpkgs',
        currentValue: 'nixos-21.11',
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/NixOS/nixpkgs',
        skipReason: 'unsupported-version',
      },
    ]);
  });

  it('is case insensitive', () => {
    const content = `{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-21.11";
  };
}`;

    const res = extractPackageFile(content);

    expect(res?.deps).toHaveLength(1);
    expect(res?.deps).toEqual([
      {
        depName: 'nixpkgs',
        currentValue: 'nixos-21.11',
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/NixOS/nixpkgs',
        skipReason: 'unsupported-version',
      },
    ]);
  });

  it('ignores nixpkgs with no explicit ref', () => {
    const content = `{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
  };
}`;

    const res = extractPackageFile(content);

    expect(res).toBeNull();
  });
});
