import { codeBlock } from 'common-tags';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import { extractPackageFile } from '.';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/manager/devenv/extract', () => {
  it('returns null when no root inputs exist', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    const devenvNix = codeBlock`{
      inputs = {};
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile(devenvNix, 'devenv.nix')).toBeNull();
  });

  it('returns null when no inputs', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('returns null when inputs are missing locked', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "original": {
            "owner": "NixOS",
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
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('returns null when inputs are missing original', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1720031269,
            "narHash": "sha256-rwz8NJZV+387rnWpTYcXaRNvzUSnnF9aHONoJIYmiUQ=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "9f4128e00b0ae8ec65918efeba59db998750ead6",
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
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('returns null when inputs are indirect', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1720031269,
            "narHash": "sha256-rwz8NJZV+387rnWpTYcXaRNvzUSnnF9aHONoJIYmiUQ=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "9f4128e00b0ae8ec65918efeba59db998750ead6",
            "type": "indirect"
          },
          "original": {
            "id": "nixpkgs",
            "type": "indirect"
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
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('returns null when inputs are path', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "local": {
          "locked": {
            "lastModified": 1720031269,
            "path": "./local",
            "type": "path"
          },
          "original": {
            "path": "./local",
            "type": "path"
          }
        },
        "root": {
          "inputs": {
            "local": "local"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('extracts nixpkgs input', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1720031269,
            "narHash": "sha256-rwz8NJZV+387rnWpTYcXaRNvzUSnnF9aHONoJIYmiUQ=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "9f4128e00b0ae8ec65918efeba59db998750ead6",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
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
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    const result = await extractPackageFile('', 'devenv.nix');
    expect(result).toEqual({
      deps: [
        {
          currentValue: 'nixos-unstable',
          datasource: GitRefsDatasource.id,
          depName: 'nixpkgs',
          lockedVersion: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: nixpkgsVersioning,
        },
      ],
    });
  });

  it('extracts github input', async () => {
    const devenvLock = codeBlock`{
      "nodes": {
        "devenv": {
          "locked": {
            "lastModified": 1720031269,
            "narHash": "sha256-rwz8NJZV+387rnWpTYcXaRNvzUSnnF9aHONoJIYmiUQ=",
            "owner": "cachix",
            "repo": "devenv",
            "rev": "9f4128e00b0ae8ec65918efeba59db998750ead6",
            "type": "github"
          },
          "original": {
            "owner": "cachix",
            "repo": "devenv",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "devenv": "devenv"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(devenvLock);
    const result = await extractPackageFile('', 'devenv.nix');
    expect(result).toEqual({
      deps: [
        {
          datasource: GitRefsDatasource.id,
          depName: 'devenv',
          lockedVersion: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          packageName: 'https://github.com/cachix/devenv',
          versioning: 'git',
        },
      ],
    });
  });

  it('returns null for invalid devenv.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('invalid json');
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });

  it('returns null when devenv.lock is missing', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(await extractPackageFile('', 'devenv.nix')).toBeNull();
  });
});
