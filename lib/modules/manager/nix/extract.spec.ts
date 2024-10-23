import { Fixtures } from '../../../../test/fixtures';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { extractPackageFile } from '.';

const flake1Lock = Fixtures.get('flake.1.lock');
const flake2Lock = Fixtures.get('flake.2.lock');
const flake3Lock = Fixtures.get('flake.3.lock');
const flake4Lock = Fixtures.get('flake.4.lock');
const flake5Lock = Fixtures.get('flake.5.lock');
const flake6Lock = Fixtures.get('flake.6.lock');
const flake7Lock = Fixtures.get('flake.7.lock');
const flake8Lock = Fixtures.get('flake.8.lock');
const flake9Lock = Fixtures.get('flake.9.lock');
const flake10Lock = Fixtures.get('flake.10.lock');
const flake11Lock = Fixtures.get('flake.11.lock');

describe('modules/manager/nix/extract', () => {
  it('returns null when no inputs', () => {
    expect(extractPackageFile(flake1Lock, 'flake.lock')).toBeNull();
  });

  it('returns nixpkgs input', () => {
    expect(extractPackageFile(flake2Lock, 'flake.lock')?.deps).toEqual([
      {
        depName: 'nixpkgs',
        currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
        currentValue: 'nixos-unstable',
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/NixOS/nixpkgs',
        replaceString: '9f4128e00b0ae8ec65918efeba59db998750ead6',
      },
    ]);
  });

  it('includes nixpkgs with no explicit ref', () => {
    expect(extractPackageFile(flake3Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: '612ee628421ba2c1abca4c99684862f76cb3b089',
        datasource: 'git-refs',
        depName: 'nixpkgs',
        packageName: 'https://github.com/NixOS/nixpkgs',
      },
    ]);
  });

  it('includes patchelf from HEAD', () => {
    expect(extractPackageFile(flake4Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: 'a0f54334df36770b335c051e540ba40afcbf8378',
        datasource: 'git-refs',
        depName: 'patchelf',
        packageName: 'https://github.com/NixOS/patchelf.git',
      },
    ]);
  });

  it('includes ijq from sourcehut without a flake', () => {
    expect(extractPackageFile(flake5Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: '88f0d9ae98942bf49cba302c42b2a0f6e05f9b58',
        datasource: 'git-refs',
        depName: 'ijq',
        packageName: 'https://git.sr.ht/~gpanders/ijq',
      },
    ]);
  });

  it('includes home-manager from gitlab', () => {
    expect(extractPackageFile(flake6Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: '65ae9c147349829d3df0222151f53f79821c5134',
        datasource: 'git-refs',
        depName: 'home-manager',
        packageName: 'https://gitlab.com/rycee/home-manager',
      },
    ]);
  });

  it('test other version', () => {
    expect(extractPackageFile(flake7Lock, 'flake.lock')).toBeNull();
  });

  it('includes nixpkgs with ref and shallow arguments', () => {
    expect(extractPackageFile(flake8Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: '5633bcff0c6162b9e4b5f1264264611e950c8ec7',
        datasource: 'git-refs',
        depName: 'nixpkgs',
        packageName: 'https://github.com/NixOS/nixpkgs',
      },
    ]);
  });

  it('includes nixpkgs but using indirect type that cannot be updated', () => {
    expect(extractPackageFile(flake9Lock, 'flake.lock')).toBeNull();
  });

  it('includes flake from GitHub Enterprise', () => {
    expect(extractPackageFile(flake10Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: '6bf2706348447df6f8b86b1c3e54f87b0afda84f',
        datasource: 'git-refs',
        depName: 'nixpkgs-extra-pkgs',
        packageName:
          'https://github.corp.example.com/my-org/nixpkgs-extra-pkgs',
      },
    ]);
  });

  it('includes flake with tarball type', () => {
    expect(extractPackageFile(flake11Lock, 'flake.lock')?.deps).toMatchObject([
      {
        currentDigest: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
        datasource: 'git-refs',
        depName: 'data-mesher',
        packageName: 'https://git.clan.lol/clan/data-mesher',
      },
    ]);
  });
});
