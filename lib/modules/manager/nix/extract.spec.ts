import { fs } from '../../../../test/util';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

describe('modules/manager/nix/extract', () => {
  it('returns null for no flake.lock', async () => {
    const res = await extractPackageFile('', 'flake.nix');

    expect(res).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    fs.readLocalFile.mockResolvedValueOnce('invalid-json');
    const res = await extractPackageFile('', 'flake.nix');

    expect(res).toBeNull();
  });

  it('returns null for invalid lock file', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{}');
    const res = await extractPackageFile('', 'flake.nix');

    expect(res).toBeNull();
  });

  it('returns null when no nixpkgs', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`{
  "nodes": {
    "root": {
      "inputs": {}
    }
  },
  "root": "root",
  "version": 7
}
`);
    const res = await extractPackageFile('', 'flake.nix');

    expect(res).toBeNull();
  });

  it('returns nixpkgs', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`{
  "nodes": {
    "nixpkgs": {
      "locked": {
        "lastModified": 1659131907,
        "narHash": "sha256-8bz4k18M/FuVC+EVcI4aREN2PsEKT7LGmU2orfjnpCg=",
        "owner": "nixos",
        "repo": "nixpkgs",
        "rev": "8d435fca5c561da8168abb30270788d2da2a7951",
        "type": "github"
      },
      "original": {
        "owner": "nixos",
        "ref": "nixos-unstable",
        "repo": "nixpkgs",
        "type": "github"
      }
    },
    "root": {
      "inputs": {
        "nixpkgs": "nixpkgs"
      }
    }
  },
  "root": "root",
  "version": 7
}`);

    const res = await extractPackageFile('', 'flake.nix');

    expect(res?.deps).toHaveLength(1);
    expect(res?.deps[0]).toMatchObject({
      depName: 'nixpkgs',
      currentValue: 'nixos-unstable',
      skipReason: 'unsupported-version',
    });
  });
});
