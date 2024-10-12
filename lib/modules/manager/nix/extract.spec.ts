import { Fixtures } from '../../../../test/fixtures';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { extractPackageFile } from '.';

const flake1Lock = Fixtures.get('flake.1.lock');
const flake2Lock = Fixtures.get('flake.2.lock');
const flake3Lock = Fixtures.get('flake.3.lock');
const flake4Lock = Fixtures.get('flake.4.lock');
const flake5Lock = Fixtures.get('flake.5.lock');
const flake6Lock = Fixtures.get('flake.6.lock');

describe('modules/manager/nix/extract', () => {
  it('returns null when no inputs', () => {
    expect(extractPackageFile(flake1Lock, 'flake.lock')).toBeNull();
  });

  it('returns nixpkgs input', () => {
    expect((extractPackageFile(flake2Lock, 'flake.lock'))?.deps).toEqual([
      {
        depName: 'nixpkgs',
        currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
        currentValue: "nixos-unstable",
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/NixOS/nixpkgs',
        replaceString: "9f4128e00b0ae8ec65918efeba59db998750ead6",
      },
    ]);
  });

  it('includes nixpkgs with no explicit ref', () => {
    expect((extractPackageFile(flake3Lock, 'flake.lock'))?.deps).toMatchObject([
      {
        currentDigest: '612ee628421ba2c1abca4c99684862f76cb3b089',
        datasource: 'git-refs',
        depName: 'nixpkgs',
        packageName: 'https://github.com/NixOS/nixpkgs',
        },
    ]);
  });

  it('includes patchelf from HEAD', () => {
    expect((extractPackageFile(flake4Lock, 'flake.lock'))?.deps).toMatchObject([
      {
        currentDigest: 'a0f54334df36770b335c051e540ba40afcbf8378',
        datasource: 'git-refs',
        depName: 'patchelf',
        packageName: 'https://github.com/NixOS/patchelf.git',
      },
    ]);
  });

  it('includes ijq from sourcehut without a flake', () => {
    expect((extractPackageFile(flake5Lock, 'flake.lock'))?.deps).toMatchObject([
      {
        currentDigest: '88f0d9ae98942bf49cba302c42b2a0f6e05f9b58',
        datasource: 'git-refs',
        depName: 'ijq',
        packageName: 'https://git.sr.ht/~gpanders/ijq',
      },
    ]);
  });

  it('includes home-manager from gitlab', () => {
    expect((extractPackageFile(flake6Lock, 'flake.lock'))?.deps).toMatchObject([
      {
        currentDigest: '65ae9c147349829d3df0222151f53f79821c5134',
        datasource: 'git-refs',
        depName: 'home-manager',
        packageName: 'https://gitlab.com/rycee/home-manager',
      },
    ]);
  });
});
