import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs/index.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/nix/extract', () => {
  it('returns null when no nixpkgs input exists', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    const flakeNix = codeBlock`{
      inputs = {};
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
  });

  it('does not include nixpkgs input with no explicit ref', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs.url = "github:NixOS/nixpkgs";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
  });

  it('includes nixpkgs input with only ref', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs-lib.url = "https://github.com/NixOS/nixpkgs/archive/072a6db25e947df2f31aab9eccd0ab75d5b2da11.tar.gz";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
  });

  it('returns null when no inputs', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when inputs are missing locked', async () => {
    const flakeLock = codeBlock`{
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when inputs are missing original', async () => {
    const flakeLock = codeBlock`{
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when original inputs are from local path', async () => {
    const flakeLock = codeBlock`{
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
            "type": "path"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when locked inputs are indirect', async () => {
    const flakeLock = codeBlock`{
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when locked inputs are from local path', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1720031269,
            "narHash": "sha256-rwz8NJZV+387rnWpTYcXaRNvzUSnnF9aHONoJIYmiUQ=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "9f4128e00b0ae8ec65918efeba59db998750ead6",
            "type": "path"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns nixpkgs input', async () => {
    const flakeLock = codeBlock`{
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toEqual({
      deps: [
        {
          currentValue: 'nixos-unstable',
          depName: 'nixpkgs',
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: nixpkgsVersioning,
          lockedVersion: '9f4128e00b0ae8ec65918efeba59db998750ead6',
        },
      ],
    });
  });

  it('includes nixpkgs with no explicit ref', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1728650607,
            "narHash": "sha256-0lOnVTzRXzpk5uxbHLm3Ti3tyPAvirAIQDfwEUd8arg=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "612ee628421ba2c1abca4c99684862f76cb3b089",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
          lockedVersion: '612ee628421ba2c1abca4c99684862f76cb3b089',
        },
      ],
    });
  });

  it('includes patchelf from HEAD', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1672057183,
            "narHash": "sha256-GN7/10DNNvs1FPj9tlZA2qgNdFuYKKuS3qlHTqAxasQ=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "b139e44d78c36c69bcbb825b20dbfa51e7738347",
            "type": "github"
          },
          "original": {
            "id": "nixpkgs",
            "ref": "nixpkgs-unstable",
            "type": "indirect"
          }
        },
        "patchelf": {
          "inputs": {
            "nixpkgs": "nixpkgs"
          },
          "locked": {
            "lastModified": 1718457448,
            "narHash": "sha256-FSoxTcRZMGHNJh8dNtKOkcUtjhmhU6yQXcZZfUPLhQM=",
            "ref": "refs/heads/master",
            "rev": "a0f54334df36770b335c051e540ba40afcbf8378",
            "revCount": 844,
            "type": "git",
            "url": "https://github.com/NixOS/patchelf.git"
          },
          "original": {
            "type": "git",
            "url": "https://github.com/NixOS/patchelf.git"
          }
        },
        "root": {
          "inputs": {
            "patchelf": "patchelf"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'patchelf',
          packageName: 'https://github.com/NixOS/patchelf.git',
          lockedVersion: 'a0f54334df36770b335c051e540ba40afcbf8378',
        },
      ],
    });
  });

  it('includes ijq from sourcehut without a flake', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "ijq": {
          "flake": false,
          "locked": {
            "lastModified": 1723569650,
            "narHash": "sha256-Ho/sAhEUeSug52JALgjrKVUPCBe8+PovbJj/lniKxp8=",
            "owner": "~gpanders",
            "repo": "ijq",
            "rev": "88f0d9ae98942bf49cba302c42b2a0f6e05f9b58",
            "type": "sourcehut"
          },
          "original": {
            "owner": "~gpanders",
            "repo": "ijq",
            "type": "sourcehut"
          }
        },
        "root": {
          "inputs": {
            "ijq": "ijq"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'ijq',
          packageName: 'https://git.sr.ht/~gpanders/ijq',
          lockedVersion: '88f0d9ae98942bf49cba302c42b2a0f6e05f9b58',
        },
      ],
    });
  });

  it('includes home-manager from gitlab', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "home-manager": {
          "flake": false,
          "locked": {
            "lastModified": 1728650932,
            "narHash": "sha256-mGKzqdsRyLnGNl6WjEr7+sghGgBtYHhJQ4mjpgRTCsU=",
            "owner": "rycee",
            "repo": "home-manager",
            "rev": "65ae9c147349829d3df0222151f53f79821c5134",
            "type": "gitlab"
          },
          "original": {
            "owner": "rycee",
            "repo": "home-manager",
            "type": "gitlab"
          }
        },
        "root": {
          "inputs": {
            "home-manager": "home-manager"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'home-manager',
          packageName: 'https://gitlab.com/rycee/home-manager',
          lockedVersion: '65ae9c147349829d3df0222151f53f79821c5134',
        },
      ],
    });
  });

  it('test other version', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 6
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('includes nixpkgs with ref and shallow arguments', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1728492678,
            "narHash": "sha256-9UTxR8eukdg+XZeHgxW5hQA9fIKHsKCdOIUycTryeVw=",
            "ref": "nixos-unstable",
            "rev": "5633bcff0c6162b9e4b5f1264264611e950c8ec7",
            "shallow": true,
            "type": "git",
            "url": "https://github.com/NixOS/nixpkgs"
          },
          "original": {
            "ref": "nixos-unstable",
            "shallow": true,
            "type": "git",
            "url": "https://github.com/NixOS/nixpkgs"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
          lockedVersion: '5633bcff0c6162b9e4b5f1264264611e950c8ec7',
        },
      ],
    });
  });

  it('includes nixpkgs but using indirect type that cannot be updated', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1728538411,
            "narHash": "sha256-f0SBJz1eZ2yOuKUr5CA9BHULGXVSn6miBuUWdTyhUhU=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "b69de56fac8c2b6f8fd27f2eca01dcda8e0a4221",
            "type": "github"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('includes nixpkgs but using indirect type and path locked type that cannot be updated', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1687274257,
            "narHash": "sha256-TutzPriQcZ8FghDhEolnHcYU2oHIG5XWF+/SUBNnAOE=",
            "path": "/nix/store/22qgs3skscd9bmrxv9xv4q5d4wwm5ppx-source",
            "rev": "2c9ecd1f0400076a4d6b2193ad468ff0a7e7fdc5",
            "type": "path"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('includes flake from GitHub Enterprise', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "flake-utils": {
          "inputs": {
            "systems": "systems"
          },
          "locked": {
            "lastModified": 1726560853,
            "narHash": "sha256-X6rJYSESBVr3hBoH0WbKE5KvhPU5bloyZ2L4K60/fPQ=",
            "owner": "numtide",
            "repo": "flake-utils",
            "rev": "c1dfcf08411b08f6b8615f7d8971a2bfa81d5e8a",
            "type": "github"
          },
          "original": {
            "owner": "numtide",
            "repo": "flake-utils",
            "type": "github"
          }
        },
        "nixpkgs": {
          "locked": {
            "lastModified": 1728492678,
            "narHash": "sha256-9UTxR8eukdg+XZeHgxW5hQA9fIKHsKCdOIUycTryeVw=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "5633bcff0c6162b9e4b5f1264264611e950c8ec7",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
            "ref": "nixos-unstable",
            "repo": "nixpkgs",
            "type": "github"
          }
        },
        "nixpkgs-extra-pkgs": {
          "inputs": {
            "flake-utils": "flake-utils",
            "nixpkgs": "nixpkgs"
          },
          "locked": {
            "host": "github.corp.example.com",
            "lastModified": 1728666512,
            "narHash": "sha256-p+l16Zzyl2DXG695yks6KQP7NkjsnEksu5GBvtL1QYg=",
            "owner": "my-org",
            "repo": "nixpkgs-extra-pkgs",
            "rev": "6bf2706348447df6f8b86b1c3e54f87b0afda84f",
            "type": "github"
          },
          "original": {
            "host": "github.corp.example.com",
            "owner": "my-org",
            "repo": "nixpkgs-extra-pkgs",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "nixpkgs-extra-pkgs": "nixpkgs-extra-pkgs"
          }
        },
        "systems": {
          "locked": {
            "lastModified": 1681028828,
            "narHash": "sha256-Vy1rq5AaRuLzOxct8nz4T6wlgyUR7zLU309k9mBC768=",
            "owner": "nix-systems",
            "repo": "default",
            "rev": "da67096a3b9bf56a91d16901293e51ba5b49a27e",
            "type": "github"
          },
          "original": {
            "owner": "nix-systems",
            "repo": "default",
            "type": "github"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'nixpkgs-extra-pkgs',
          packageName:
            'https://github.corp.example.com/my-org/nixpkgs-extra-pkgs',
          lockedVersion: '6bf2706348447df6f8b86b1c3e54f87b0afda84f',
        },
      ],
    });
  });

  it('includes flake with tarball type', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "data-mesher": {
          "inputs": {
            "flake-parts": "flake-parts",
            "nixpkgs": "nixpkgs",
            "treefmt-nix": "treefmt-nix"
          },
          "locked": {
            "lastModified": 1727355895,
            "narHash": "sha256-grZIaLgk5GgoDuTt49RTCLBh458H4YJdIAU4B3onXRw=",
            "rev": "c7e39452affcc0f89e023091524e38b3aaf109e9",
            "type": "tarball",
            "url": "https://git.clan.lol/api/v1/repos/clan/data-mesher/archive/c7e39452affcc0f89e023091524e38b3aaf109e9.tar.gz"
          },
          "original": {
            "type": "tarball",
            "url": "https://git.clan.lol/clan/data-mesher/archive/main.tar.gz"
          }
        },
        "flake-parts": {
          "inputs": {
            "nixpkgs-lib": [
              "data-mesher",
              "nixpkgs"
            ]
          },
          "locked": {
            "lastModified": 1726153070,
            "narHash": "sha256-HO4zgY0ekfwO5bX0QH/3kJ/h4KvUDFZg8YpkNwIbg1U=",
            "owner": "hercules-ci",
            "repo": "flake-parts",
            "rev": "bcef6817a8b2aa20a5a6dbb19b43e63c5bf8619a",
            "type": "github"
          },
          "original": {
            "owner": "hercules-ci",
            "repo": "flake-parts",
            "type": "github"
          }
        },
        "nixpkgs": {
          "locked": {
            "lastModified": 1726871744,
            "narHash": "sha256-V5LpfdHyQkUF7RfOaDPrZDP+oqz88lTJrMT1+stXNwo=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "a1d92660c6b3b7c26fb883500a80ea9d33321be2",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
            "ref": "nixpkgs-unstable",
            "repo": "nixpkgs",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "data-mesher": "data-mesher"
          }
        },
        "treefmt-nix": {
          "inputs": {
            "nixpkgs": [
              "data-mesher",
              "nixpkgs"
            ]
          },
          "locked": {
            "lastModified": 1726734507,
            "narHash": "sha256-VUH5O5AcOSxb0uL/m34dDkxFKP6WLQ6y4I1B4+N3L2w=",
            "owner": "numtide",
            "repo": "treefmt-nix",
            "rev": "ee41a466c2255a3abe6bc50fc6be927cdee57a9f",
            "type": "github"
          },
          "original": {
            "owner": "numtide",
            "repo": "treefmt-nix",
            "type": "github"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'data-mesher',
          packageName: 'https://git.clan.lol/clan/data-mesher',
          lockedVersion: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
        },
      ],
    });
  });

  it('uri decode gitlab subgroup', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "subgroup-project": {
          "locked": {
            "lastModified": 1739792862,
            "narHash": "sha256-n0MrSIZZknq2OqOYgNS0iMp2yVRekpBFGhrhsT7aXGg=",
            "owner": "group%2Fsub-group",
            "repo": "subgroup-project",
            "rev": "24b560624f154c9e962d146217b2a964faaf2055",
            "type": "gitlab"
          },
          "original": {
            "owner": "group%2Fsub-group",
            "repo": "subgroup-project",
            "type": "gitlab"
          }
        },
        "root": {
          "inputs": {
            "subgroup-project": "subgroup-project"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'subgroup-project',
          packageName: 'https://gitlab.com/group/sub-group/subgroup-project',
          lockedVersion: '24b560624f154c9e962d146217b2a964faaf2055',
        },
      ],
    });
  });

  it('includes flake with only tarball type', async () => {
    const flakeLock = codeBlock`{
    "nodes": {
      "nixpkgs-lib": {
        "locked": {
          "lastModified": 1738452942,
          "narHash": "sha256-vJzFZGaCpnmo7I6i416HaBLpC+hvcURh/BQwROcGIp8=",
          "type": "tarball",
          "url": "https://github.com/NixOS/nixpkgs/archive/072a6db25e947df2f31aab9eccd0ab75d5b2da11.tar.gz"
        },
        "original": {
          "type": "tarball",
          "url": "https://github.com/NixOS/nixpkgs/archive/072a6db25e947df2f31aab9eccd0ab75d5b2da11.tar.gz"
        }
      },
      "root": {
        "inputs": {
          "nixpkgs-lib": "nixpkgs-lib"
        }
      }
    },
    "root": "root",
    "version": 7
  }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('includes flake with nixpkgs-lib as tarball type', async () => {
    const flakeLock = codeBlock`{
    "nodes": {
      "flake-parts": {
        "inputs": {
          "nixpkgs-lib": "nixpkgs-lib"
        },
        "locked": {
          "lastModified": 1733312601,
          "narHash": "sha256-4pDvzqnegAfRkPwO3wmwBhVi/Sye1mzps0zHWYnP88c=",
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "rev": "205b12d8b7cd4802fbcb8e8ef6a0f1408781a4f9",
          "type": "github"
        },
        "original": {
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "type": "github"
        }
      },
      "nixpkgs": {
        "locked": {
          "lastModified": 1734649271,
          "narHash": "sha256-4EVBRhOjMDuGtMaofAIqzJbg4Ql7Ai0PSeuVZTHjyKQ=",
          "owner": "nixos",
          "repo": "nixpkgs",
          "rev": "d70bd19e0a38ad4790d3913bf08fcbfc9eeca507",
          "type": "github"
        },
        "original": {
          "owner": "nixos",
          "ref": "nixos-unstable",
          "repo": "nixpkgs",
          "type": "github"
        }
      },
      "nixpkgs-lib": {
        "locked": {
          "lastModified": 1733096140,
          "narHash": "sha256-1qRH7uAUsyQI7R1Uwl4T+XvdNv778H0Nb5njNrqvylY=",
          "type": "tarball",
          "url": "https://github.com/NixOS/nixpkgs/archive/5487e69da40cbd611ab2cadee0b4637225f7cfae.tar.gz"
        },
        "original": {
          "type": "tarball",
          "url": "https://github.com/NixOS/nixpkgs/archive/5487e69da40cbd611ab2cadee0b4637225f7cfae.tar.gz"
        }
      },
      "root": {
        "inputs": {
          "flake-parts": "flake-parts",
          "nixpkgs": "nixpkgs"
        }
      }
    },
    "root": "root",
    "version": 7
  }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'flake-parts',
          packageName: 'https://github.com/hercules-ci/flake-parts',
          lockedVersion: '205b12d8b7cd4802fbcb8e8ef6a0f1408781a4f9',
        },
        {
          currentValue: 'nixos-unstable',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/nixos/nixpkgs',
          lockedVersion: 'd70bd19e0a38ad4790d3913bf08fcbfc9eeca507',
        },
      ],
    });
  });

  it('includes flake with nixpkgs channel as tarball type', async () => {
    const flakeLock = codeBlock`{
    "nodes": {
      "nixpkgs": {
        "locked": {
          "lastModified": 1756904031,
          "narHash": "sha256-V29Bu1nR6Ayt+uUhf/6L43DSxb66BQ+8E2wH1GHa5IA=",
          "rev": "0e6684e6c5755325f801bda1751a8a4038145d7d",
          "type": "tarball",
          "url": "https://releases.nixos.org/nixos/25.05/nixos-25.05.809350.0e6684e6c575/nixexprs.tar.xz"
        },
        "original": {
          "type": "tarball",
          "url": "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.xz"
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'nixpkgs-unstable',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
          lockedVersion: '0e6684e6c5755325f801bda1751a8a4038145d7d',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('finds currentDigest correctly when input sha is pinned', async () => {
    const flakeNix = codeBlock`{
      inputs = {
        disko.url = "github:nix-community/disko/76c0a6dba345490508f36c1aa3c7ba5b6b460989";
      };
    }`;
    const flakeLock = codeBlock`{
    "nodes": {
      "disko": {
        "locked": {
          "lastModified": 1744145203,
          "narHash": "sha256-I2oILRiJ6G+BOSjY+0dGrTPe080L3pbKpc+gCV3Nmyk=",
          "owner": "nix-community",
          "repo": "disko",
          "rev": "76c0a6dba345490508f36c1aa3c7ba5b6b460989",
          "type": "github"
        },
        "original": {
          "owner": "nix-community",
          "repo": "disko",
          "rev": "76c0a6dba345490508f36c1aa3c7ba5b6b460989",
          "type": "github"
        }
      },
      "root": {
        "inputs": {
          "disko": "disko"
        }
      }
    },
    "root": "root",
    "version": 7
  }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toMatchObject({
      deps: [
        {
          currentDigest: '76c0a6dba345490508f36c1aa3c7ba5b6b460989',
          datasource: 'git-refs',
          depName: 'disko',
          packageName: 'https://github.com/nix-community/disko',
        },
      ],
    });
  });

  it('does not duplicate nixpkgs dependency', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1756904031,
            "narHash": "sha256-V29Bu1nR6Ayt+uUhf/6L43DSxb66BQ+8E2wH1GHa5IA=",
            "rev": "0e6684e6c5755325f801bda1751a8a4038145d7d",
            "type": "tarball",
            "url": "https://releases.nixos.org/nixos/25.05/nixos-25.05.809350.0e6684e6c575/nixexprs.tar.xz"
          },
          "original": {
            "type": "tarball",
            "url": "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.xz"
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
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs.url = "github:nixos/nixpkgs/nixos-21.11";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
      deps: [
        {
          currentValue: 'nixpkgs-unstable',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
          lockedVersion: '0e6684e6c5755325f801bda1751a8a4038145d7d',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('returns null when flake.lock file cannot be read', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when flake.nix file cannot be read', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when flake.lock has invalid JSON', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{ invalid json');
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns deps when no root inputs but deps exist', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "root": {}
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);

    const result = await extractPackageFile('', 'flake.nix');
    expect(result).toBeNull();
  });

  it('handles currentDigest replacement when config provided', async () => {
    const flakeNix = codeBlock`{
      inputs = {
        disko.url = "github:nix-community/disko/newdigest123";
      };
    }`;
    const flakeLock = codeBlock`{
      "nodes": {
        "disko": {
          "locked": {
            "lastModified": 1744145203,
            "narHash": "sha256-I2oILRiJ6G+BOSjY+0dGrTPe080L3pbKpc+gCV3Nmyk=",
            "owner": "nix-community",
            "repo": "disko",
            "rev": "76c0a6dba345490508f36c1aa3c7ba5b6b460989",
            "type": "github"
          },
          "original": {
            "owner": "nix-community",
            "repo": "disko",
            "rev": "olddigest123",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "disko": "disko"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    const config = {
      currentDigest: 'olddigest123',
      newDigest: 'newdigest123',
    };

    const result = await extractPackageFile(flakeNix, 'flake.nix', config);
    expect(result?.deps[0]).toMatchObject({
      currentDigest: 'newdigest123',
      depName: 'disko',
      packageName: 'https://github.com/nix-community/disko',
    });
  });

  it('includes nixpkgs with ref when original has rev', async () => {
    const flakeLock = codeBlock`{
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
            "rev": "specific-commit-hash",
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
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'nixos-unstable',
          currentDigest: 'specific-commit-hash',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
        },
      ],
    });
  });

  it('includes github flake with ref when original has rev', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "flake-utils": {
          "locked": {
            "lastModified": 1726560853,
            "narHash": "sha256-X6rJYSESBVr3hBoH0WbKE5KvhPU5bloyZ2L4K60/fPQ=",
            "owner": "numtide",
            "repo": "flake-utils",
            "rev": "c1dfcf08411b08f6b8615f7d8971a2bfa81d5e8a",
            "type": "github"
          },
          "original": {
            "owner": "numtide",
            "repo": "flake-utils",
            "ref": "main",
            "rev": "specific-commit-hash",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "flake-utils": "flake-utils"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'main',
          currentDigest: 'specific-commit-hash',
          depName: 'flake-utils',
          packageName: 'https://github.com/numtide/flake-utils',
        },
      ],
    });
  });

  it('includes gitlab flake with custom host', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "custom-project": {
          "locked": {
            "lastModified": 1728650932,
            "narHash": "sha256-mGKzqdsRyLnGNl6WjEr7+sghGgBtYHhJQ4mjpgRTCsU=",
            "owner": "group",
            "repo": "project",
            "rev": "65ae9c147349829d3df0222151f53f79821c5134",
            "type": "gitlab",
            "host": "gitlab.example.com"
          },
          "original": {
            "owner": "group",
            "repo": "project",
            "type": "gitlab",
            "host": "gitlab.example.com"
          }
        },
        "root": {
          "inputs": {
            "custom-project": "custom-project"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'custom-project',
          packageName: 'https://gitlab.example.com/group/project',
          lockedVersion: '65ae9c147349829d3df0222151f53f79821c5134',
        },
      ],
    });
  });

  it('includes sourcehut flake with custom host', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "custom-project": {
          "locked": {
            "lastModified": 1723569650,
            "narHash": "sha256-Ho/sAhEUeSug52JALgjrKVUPCBe8+PovbJj/lniKxp8=",
            "owner": "~user",
            "repo": "project",
            "rev": "88f0d9ae98942bf49cba302c42b2a0f6e05f9b58",
            "type": "sourcehut",
            "host": "git.custom.org"
          },
          "original": {
            "owner": "~user",
            "repo": "project",
            "type": "sourcehut",
            "host": "git.custom.org"
          }
        },
        "root": {
          "inputs": {
            "custom-project": "custom-project"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'custom-project',
          packageName: 'https://git.custom.org/~user/project',
          lockedVersion: '88f0d9ae98942bf49cba302c42b2a0f6e05f9b58',
        },
      ],
    });
  });

  it('includes tarball flake with ref when original has rev', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "data-mesher": {
          "locked": {
            "lastModified": 1727355895,
            "narHash": "sha256-grZIaLgk5GgoDuTt49RTCLBh458H4YJdIAU4B3onXRw=",
            "rev": "c7e39452affcc0f89e023091524e38b3aaf109e9",
            "type": "tarball",
            "url": "https://git.clan.lol/api/v1/repos/clan/data-mesher/archive/c7e39452affcc0f89e023091524e38b3aaf109e9.tar.gz"
          },
          "original": {
            "type": "tarball",
            "url": "https://git.clan.lol/clan/data-mesher/archive/main.tar.gz",
            "ref": "main",
            "rev": "specific-commit-hash"
          }
        },
        "root": {
          "inputs": {
            "data-mesher": "data-mesher"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'main',
          currentDigest: 'specific-commit-hash',
          datasource: 'git-refs',
          depName: 'data-mesher',
          packageName: 'https://git.clan.lol/clan/data-mesher',
        },
      ],
    });
  });

  it('handles unknown flake lock type', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "unknown-flake": {
          "locked": {
            "lastModified": 1727355895,
            "narHash": "sha256-grZIaLgk5GgoDuTt49RTCLBh458H4YJdIAU4B3onXRw=",
            "rev": "c7e39452affcc0f89e023091524e38b3aaf109e9",
            "type": "unknown-type"
          },
          "original": {
            "type": "unknown-type"
          }
        },
        "root": {
          "inputs": {
            "unknown-flake": "unknown-flake"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('ignores unsupported file type and still extracts other inputs', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "file": {
          "flake": false,
          "locked": {
            "narHash": "sha256-55ZgnQaZD3uRr/Dom05x0K7ui4+Fnb6H30jW5Eu3ZE0=",
            "type": "file",
            "url": "https://raw.githubusercontent.com/NixOS/nixpkgs/a69c58b926f609e5b9c56b25b075d2af9a5b7dc5/README.md"
          },
          "original": {
            "type": "file",
            "url": "https://raw.githubusercontent.com/NixOS/nixpkgs/a69c58b926f609e5b9c56b25b075d2af9a5b7dc5/README.md"
          }
        },
        "nixpkgs": {
          "locked": {
            "lastModified": 1757068644,
            "narHash": "sha256-NOrUtIhTkIIumj1E/Rsv1J37Yi3xGStISEo8tZm3KW4=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "8eb28adfa3dc4de28e792e3bf49fcf9007ca8ac9",
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
            "file": "file",
            "nixpkgs": "nixpkgs"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    const result = await extractPackageFile('', 'flake.nix');
    expect(result?.deps).toHaveLength(1);
    expect(result?.deps[0].depName).toBe('nixpkgs');
  });

  it('should work with realistic case 1 out of 4', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "home-manager": {
          "inputs": {
            "nixpkgs": "nixpkgs"
          },
          "locked": {
            "lastModified": 1779506708,
            "narHash": "sha256-QOD/CNm196nCJRheux/URi4/HE66fthdOMqCJoPP1Y0=",
            "owner": "nix-community",
            "repo": "home-manager",
            "rev": "3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f",
            "type": "github"
          },
          "original": {
            "owner": "nix-community",
            "ref": "release-25.11",
            "repo": "home-manager",
            "type": "github"
          }
        },
        "nixpkgs": {
          "locked": {
            "lastModified": 1779102034,
            "narHash": "sha256-vZJZjLo513IeI8hjzHFc6TDezUd4uCE2Eq4SNO3DNNg=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "687f05a9184cad4eaf905c48b63649e3a86f5433",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
            "ref": "nixos-25.11",
            "repo": "nixpkgs",
            "type": "github"
          }
        },
        "nixpkgs_2": {
          "locked": {
            "lastModified": 1779796641,
            "narHash": "sha256-ZsIrKmhp4vbBXoXXmR/tBXA/UCsAQiJL9vsgZEduhVY=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "25f538306313eae3927264466c70d7001dcea1df",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
            "ref": "nixos-25.11",
            "repo": "nixpkgs",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "home-manager": "home-manager",
            "nixpkgs": "nixpkgs_2"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'release-25.11',
          datasource: 'git-refs',
          depName: 'home-manager',
          lockedVersion: '3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f',
          packageName: 'https://github.com/nix-community/home-manager',
          versioning: 'nixpkgs',
        },
        {
          currentValue: 'nixos-25.11',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          lockedVersion: '25f538306313eae3927264466c70d7001dcea1df',
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('should work with realistic case 2 out of 4', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "home-manager": {
          "inputs": {
            "nixpkgs": [
              "nixpkgs"
            ]
          },
          "locked": {
            "lastModified": 1779506708,
            "narHash": "sha256-QOD/CNm196nCJRheux/URi4/HE66fthdOMqCJoPP1Y0=",
            "owner": "nix-community",
            "repo": "home-manager",
            "rev": "3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f",
            "type": "github"
          },
          "original": {
            "owner": "nix-community",
            "ref": "release-25.11",
            "repo": "home-manager",
            "type": "github"
          }
        },
        "nixpkgs": {
          "locked": {
            "lastModified": 1779796641,
            "narHash": "sha256-ZsIrKmhp4vbBXoXXmR/tBXA/UCsAQiJL9vsgZEduhVY=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "25f538306313eae3927264466c70d7001dcea1df",
            "type": "github"
          },
          "original": {
            "owner": "NixOS",
            "ref": "nixos-25.11",
            "repo": "nixpkgs",
            "type": "github"
          }
        },
        "root": {
          "inputs": {
            "home-manager": "home-manager",
            "nixpkgs": "nixpkgs"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'release-25.11',
          datasource: 'git-refs',
          depName: 'home-manager',
          lockedVersion: '3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f',
          packageName: 'https://github.com/nix-community/home-manager',
          versioning: 'nixpkgs',
        },
        {
          currentValue: 'nixos-25.11',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          lockedVersion: '25f538306313eae3927264466c70d7001dcea1df',
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('should work with realistic case 3 out of 4', async () => {
    const flakeLock = codeBlock`{
    "nodes": {
      "celler": {
        "inputs": {
          "crane": "crane",
          "flake-compat": "flake-compat",
          "flake-parts": "flake-parts",
          "nixpkgs": [
            "nixpkgs"
          ],
          "nixpkgs-stable": "nixpkgs-stable"
        },
        "locked": {
          "lastModified": 1778143993,
          "narHash": "sha256-037tesii1mRYgt5nKe56DckvBQBvzmby6K2Ua31u0U4=",
          "owner": "blitz",
          "repo": "celler",
          "rev": "7504f70a4cf6e14e6052e726d9f05f6966637a2a",
          "type": "github"
        },
        "original": {
          "owner": "blitz",
          "repo": "celler",
          "type": "github"
        }
      },
      "crane": {
        "locked": {
          "lastModified": 1777830388,
          "narHash": "sha256-2uoQAqUk2H0ijQtGiWAyNeQYGYc6yfAcRRLlJAz4Gp8=",
          "owner": "ipetkov",
          "repo": "crane",
          "rev": "d459c1350e96ce1a7e3859c513ef5e9869d67d6f",
          "type": "github"
        },
        "original": {
          "owner": "ipetkov",
          "repo": "crane",
          "type": "github"
        }
      },
      "devour-flake": {
        "flake": false,
        "locked": {
          "lastModified": 1761148089,
          "narHash": "sha256-Cd9aWk4P2VGYrK2X28D3vVub2kQIaba7tCTVg+G0AII=",
          "owner": "srid",
          "repo": "devour-flake",
          "rev": "03d5d9112a79aa6ef80495b325fd015d806b98eb",
          "type": "github"
        },
        "original": {
          "owner": "srid",
          "repo": "devour-flake",
          "type": "github"
        }
      },
      "flake-compat": {
        "flake": false,
        "locked": {
          "lastModified": 1767039857,
          "narHash": "sha256-vNpUSpF5Nuw8xvDLj2KCwwksIbjua2LZCqhV1LNRDns=",
          "owner": "edolstra",
          "repo": "flake-compat",
          "rev": "5edf11c44bc78a0d334f6334cdaf7d60d732daab",
          "type": "github"
        },
        "original": {
          "owner": "edolstra",
          "repo": "flake-compat",
          "type": "github"
        }
      },
      "flake-compat_2": {
        "locked": {
          "lastModified": 1733328505,
          "narHash": "sha256-NeCCThCEP3eCl2l/+27kNNK7QrwZB1IJCrXfrbv5oqU=",
          "owner": "edolstra",
          "repo": "flake-compat",
          "rev": "ff81ac966bb2cae68946d5ed5fc4994f96d0ffec",
          "type": "github"
        },
        "original": {
          "owner": "edolstra",
          "repo": "flake-compat",
          "type": "github"
        }
      },
      "flake-file": {
        "locked": {
          "lastModified": 1769416693,
          "narHash": "sha256-pPNc9y+Vhgf5qw9Qvb+8L7iWedX7dQ/7oRH0QWzwJkg=",
          "owner": "vic",
          "repo": "flake-file",
          "rev": "c09729628983ed1e35c8dd43aa3df91a06f80e65",
          "type": "github"
        },
        "original": {
          "owner": "vic",
          "repo": "flake-file",
          "type": "github"
        }
      },
      "flake-parts": {
        "inputs": {
          "nixpkgs-lib": [
            "celler",
            "nixpkgs"
          ]
        },
        "locked": {
          "lastModified": 1777678872,
          "narHash": "sha256-EPIFsulyon7Z1vLQq5Fk64GR8L7cQsT+IPhcsukVbgk=",
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "rev": "5250617bffd85403b14dbf43c3870e7f255d2c16",
          "type": "github"
        },
        "original": {
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "type": "github"
        }
      },
      "flake-parts_2": {
        "inputs": {
          "nixpkgs-lib": "nixpkgs-lib"
        },
        "locked": {
          "lastModified": 1778716662,
          "narHash": "sha256-m1Yf0wZ8j1OHjTc2UwHwyQRSnNeSgLJOd7q5Y45hzi4=",
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "rev": "f7c1a2d347e4c52d5fb8d10cb4d94b5884e546fb",
          "type": "github"
        },
        "original": {
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "type": "github"
        }
      },
      "flake-parts_3": {
        "inputs": {
          "nixpkgs-lib": "nixpkgs-lib_2"
        },
        "locked": {
          "lastModified": 1778716662,
          "narHash": "sha256-m1Yf0wZ8j1OHjTc2UwHwyQRSnNeSgLJOd7q5Y45hzi4=",
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "rev": "f7c1a2d347e4c52d5fb8d10cb4d94b5884e546fb",
          "type": "github"
        },
        "original": {
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "type": "github"
        }
      },
      "flake-parts_4": {
        "inputs": {
          "nixpkgs-lib": [
            "nix-oci",
            "nix-lib",
            "nixpkgs-lib"
          ]
        },
        "locked": {
          "lastModified": 1768135262,
          "narHash": "sha256-PVvu7OqHBGWN16zSi6tEmPwwHQ4rLPU9Plvs8/1TUBY=",
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "rev": "80daad04eddbbf5a4d883996a73f3f542fa437ac",
          "type": "github"
        },
        "original": {
          "owner": "hercules-ci",
          "repo": "flake-parts",
          "type": "github"
        }
      },
      "get-flake": {
        "inputs": {
          "flake-compat": "flake-compat_2"
        },
        "locked": {
          "lastModified": 1745945175,
          "narHash": "sha256-JGDbJRl5v1snA4JX+yp6m3UA6Mazr59Hrgz+UhhP91M=",
          "owner": "ursi",
          "repo": "get-flake",
          "rev": "38401aa2b3a99c77d0c02727471e99e7de2fc366",
          "type": "github"
        },
        "original": {
          "owner": "ursi",
          "repo": "get-flake",
          "type": "github"
        }
      },
      "import-tree": {
        "locked": {
          "lastModified": 1763762820,
          "narHash": "sha256-ZvYKbFib3AEwiNMLsejb/CWs/OL/srFQ8AogkebEPF0=",
          "owner": "vic",
          "repo": "import-tree",
          "rev": "3c23749d8013ec6daa1d7255057590e9ca726646",
          "type": "github"
        },
        "original": {
          "owner": "vic",
          "repo": "import-tree",
          "type": "github"
        }
      },
      "nix-github-actions": {
        "inputs": {
          "nixpkgs": [
            "nix-oci",
            "nix-lib",
            "nix-unit",
            "nixpkgs"
          ]
        },
        "locked": {
          "lastModified": 1737420293,
          "narHash": "sha256-F1G5ifvqTpJq7fdkT34e/Jy9VCyzd5XfJ9TO8fHhJWE=",
          "owner": "nix-community",
          "repo": "nix-github-actions",
          "rev": "f4158fa080ef4503c8f4c820967d946c2af31ec9",
          "type": "github"
        },
        "original": {
          "owner": "nix-community",
          "repo": "nix-github-actions",
          "type": "github"
        }
      },
      "nix-lib": {
        "inputs": {
          "devour-flake": "devour-flake",
          "flake-file": "flake-file",
          "flake-parts": "flake-parts_4",
          "get-flake": "get-flake",
          "import-tree": "import-tree",
          "nix-unit": "nix-unit",
          "nixpkgs": [
            "nix-oci",
            "nixpkgs"
          ],
          "nixpkgs-lib": [
            "nix-oci",
            "nix-lib",
            "nixpkgs"
          ],
          "systems": "systems",
          "treefmt-nix": "treefmt-nix_2"
        },
        "locked": {
          "lastModified": 1774266373,
          "narHash": "sha256-5O+Q1c7lTWW1yJ84N3rYppH6r7O+FEzw8bs5SoHUh2Q=",
          "owner": "Dauliac",
          "repo": "nix-lib",
          "rev": "16e03b82acd4f7af9d687b2cb6d92498ac51b3ce",
          "type": "github"
        },
        "original": {
          "owner": "Dauliac",
          "repo": "nix-lib",
          "type": "github"
        }
      },
      "nix-oci": {
        "inputs": {
          "flake-parts": "flake-parts_3",
          "nix-lib": "nix-lib",
          "nix2container": "nix2container",
          "nixpkgs": [
            "nixpkgs"
          ]
        },
        "locked": {
          "lastModified": 1780481772,
          "narHash": "sha256-Htegu4ruFNc0Mlc7PsFRjz6ro98lthQctIcfjT/JJ2U=",
          "owner": "Dauliac",
          "repo": "nix-oci",
          "rev": "654d7378390faf537e58fa819a1d27289ccc6014",
          "type": "github"
        },
        "original": {
          "owner": "Dauliac",
          "repo": "nix-oci",
          "type": "github"
        }
      },
      "nix-unit": {
        "inputs": {
          "flake-parts": [
            "nix-oci",
            "nix-lib",
            "flake-parts"
          ],
          "nix-github-actions": "nix-github-actions",
          "nixpkgs": [
            "nix-oci",
            "nix-lib",
            "nixpkgs"
          ],
          "treefmt-nix": "treefmt-nix"
        },
        "locked": {
          "lastModified": 1762774186,
          "narHash": "sha256-hRADkHjNt41+JUHw2EiSkMaL4owL83g5ZppjYUdF/Dc=",
          "owner": "nix-community",
          "repo": "nix-unit",
          "rev": "1c9ab50554eed0b768f9e5b6f646d63c9673f0f7",
          "type": "github"
        },
        "original": {
          "owner": "nix-community",
          "repo": "nix-unit",
          "type": "github"
        }
      },
      "nix2container": {
        "inputs": {
          "nixpkgs": "nixpkgs"
        },
        "locked": {
          "lastModified": 1775487831,
          "narHash": "sha256-2lguQpLPQaxpQCJjXhmEEAfabwsAhkP29Z7fgLzHARA=",
          "owner": "nlewo",
          "repo": "nix2container",
          "rev": "76be9608a7f4d6c985d28b0e7be903ae2547df3e",
          "type": "github"
        },
        "original": {
          "owner": "nlewo",
          "repo": "nix2container",
          "type": "github"
        }
      },
      "nixpkgs": {
        "locked": {
          "lastModified": 1767028467,
          "narHash": "sha256-7G+2aXClSMaTY1ogpX14CAxjRsvyVzpE0GRwL71WO7g=",
          "owner": "NixOS",
          "repo": "nixpkgs",
          "rev": "1cabc318c11299f07ca53e3cb719854682fe6eb3",
          "type": "github"
        },
        "original": {
          "owner": "NixOS",
          "repo": "nixpkgs",
          "type": "github"
        }
      },
      "nixpkgs-lib": {
        "locked": {
          "lastModified": 1777168982,
          "narHash": "sha256-GOkGPcboWE9BmGCRMLX3worL4EMnsnG8MyKmXNeYuhQ=",
          "owner": "nix-community",
          "repo": "nixpkgs.lib",
          "rev": "f5901329dade4a6ea039af1433fb087bd9c1fe14",
          "type": "github"
        },
        "original": {
          "owner": "nix-community",
          "repo": "nixpkgs.lib",
          "type": "github"
        }
      },
      "nixpkgs-lib_2": {
        "locked": {
          "lastModified": 1777168982,
          "narHash": "sha256-GOkGPcboWE9BmGCRMLX3worL4EMnsnG8MyKmXNeYuhQ=",
          "owner": "nix-community",
          "repo": "nixpkgs.lib",
          "rev": "f5901329dade4a6ea039af1433fb087bd9c1fe14",
          "type": "github"
        },
        "original": {
          "owner": "nix-community",
          "repo": "nixpkgs.lib",
          "type": "github"
        }
      },
      "nixpkgs-stable": {
        "locked": {
          "lastModified": 1777673416,
          "narHash": "sha256-5c2POKPOjU40Kh0MirOdScBLG0bu9TAuPYAtPRNZMBs=",
          "owner": "NixOS",
          "repo": "nixpkgs",
          "rev": "26ef669cffa904b6f6832ab57b77892a37c1a671",
          "type": "github"
        },
        "original": {
          "owner": "NixOS",
          "ref": "nixos-25.11",
          "repo": "nixpkgs",
          "type": "github"
        }
      },
      "nixpkgs_2": {
        "locked": {
          "lastModified": 1779796641,
          "narHash": "sha256-ZsIrKmhp4vbBXoXXmR/tBXA/UCsAQiJL9vsgZEduhVY=",
          "owner": "nixos",
          "repo": "nixpkgs",
          "rev": "25f538306313eae3927264466c70d7001dcea1df",
          "type": "github"
        },
        "original": {
          "owner": "nixos",
          "ref": "nixos-25.11",
          "repo": "nixpkgs",
          "type": "github"
        }
      },
      "root": {
        "inputs": {
          "celler": "celler",
          "flake-parts": "flake-parts_2",
          "nix-oci": "nix-oci",
          "nixpkgs": "nixpkgs_2"
        }
      },
      "systems": {
        "locked": {
          "lastModified": 1681028828,
          "narHash": "sha256-Vy1rq5AaRuLzOxct8nz4T6wlgyUR7zLU309k9mBC768=",
          "owner": "nix-systems",
          "repo": "default",
          "rev": "da67096a3b9bf56a91d16901293e51ba5b49a27e",
          "type": "github"
        },
        "original": {
          "owner": "nix-systems",
          "repo": "default",
          "type": "github"
        }
      },
      "treefmt-nix": {
        "inputs": {
          "nixpkgs": [
            "nix-oci",
            "nix-lib",
            "nix-unit",
            "nixpkgs"
          ]
        },
        "locked": {
          "lastModified": 1762410071,
          "narHash": "sha256-aF5fvoZeoXNPxT0bejFUBXeUjXfHLSL7g+mjR/p5TEg=",
          "owner": "numtide",
          "repo": "treefmt-nix",
          "rev": "97a30861b13c3731a84e09405414398fbf3e109f",
          "type": "github"
        },
        "original": {
          "owner": "numtide",
          "repo": "treefmt-nix",
          "type": "github"
        }
      },
      "treefmt-nix_2": {
        "inputs": {
          "nixpkgs": [
            "nix-oci",
            "nix-lib",
            "nixpkgs"
          ]
        },
        "locked": {
          "lastModified": 1769515380,
          "narHash": "sha256-CWWK3PaQ7zhr+Jcf5zyaTR2cfRBXPo09H7+5nWApL8s=",
          "owner": "numtide",
          "repo": "treefmt-nix",
          "rev": "9911802c2822def2eec3d22e2cafd1619ede94a5",
          "type": "github"
        },
        "original": {
          "owner": "numtide",
          "repo": "treefmt-nix",
          "type": "github"
        }
      }
    },
    "root": "root",
    "version": 7
  }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          datasource: 'git-refs',
          depName: 'celler',
          lockedVersion: '7504f70a4cf6e14e6052e726d9f05f6966637a2a',
          packageName: 'https://github.com/blitz/celler',
          versioning: 'git',
        },
        {
          datasource: 'git-refs',
          depName: 'flake-parts',
          lockedVersion: 'f7c1a2d347e4c52d5fb8d10cb4d94b5884e546fb',
          packageName: 'https://github.com/hercules-ci/flake-parts',
          versioning: 'git',
        },
        {
          datasource: 'git-refs',
          depName: 'nix-oci',
          lockedVersion: '654d7378390faf537e58fa819a1d27289ccc6014',
          packageName: 'https://github.com/Dauliac/nix-oci',
          versioning: 'git',
        },
        {
          currentValue: 'nixos-25.11',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          lockedVersion: '25f538306313eae3927264466c70d7001dcea1df',
          packageName: 'https://github.com/nixos/nixpkgs',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('should work with realistic case 4 out of 4', async () => {
    const flakeLock = codeBlock`{
        "nodes": {
          "aagl": {
            "inputs": {
              "flake-compat": "flake-compat",
              "nixpkgs": [
                "nixpkgs"
              ],
              "rust-overlay": "rust-overlay"
            },
            "locked": {
              "lastModified": 1779903930,
              "narHash": "sha256-qG/vxOP5r7c4+7d4xo/xct9q6EvvG1KhIgKQtv0Jpag=",
              "owner": "ezKEa",
              "repo": "aagl-gtk-on-nix",
              "rev": "f2ef82f7a42bc099e35eea0673d277348050c90c",
              "type": "github"
            },
            "original": {
              "owner": "ezKEa",
              "ref": "release-25.11",
              "repo": "aagl-gtk-on-nix",
              "type": "github"
            }
          },
          "flake-compat": {
            "flake": false,
            "locked": {
              "lastModified": 1767039857,
              "narHash": "sha256-vNpUSpF5Nuw8xvDLj2KCwwksIbjua2LZCqhV1LNRDns=",
              "owner": "edolstra",
              "repo": "flake-compat",
              "rev": "5edf11c44bc78a0d334f6334cdaf7d60d732daab",
              "type": "github"
            },
            "original": {
              "owner": "edolstra",
              "repo": "flake-compat",
              "type": "github"
            }
          },
          "home-manager": {
            "inputs": {
              "nixpkgs": [
                "nixpkgs"
              ]
            },
            "locked": {
              "lastModified": 1779506708,
              "narHash": "sha256-QOD/CNm196nCJRheux/URi4/HE66fthdOMqCJoPP1Y0=",
              "owner": "nix-community",
              "repo": "home-manager",
              "rev": "3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f",
              "type": "github"
            },
            "original": {
              "owner": "nix-community",
              "ref": "release-25.11",
              "repo": "home-manager",
              "type": "github"
            }
          },
          "impermanence": {
            "inputs": {
              "home-manager": [
                "home-manager"
              ],
              "nixpkgs": [
                "nixpkgs"
              ]
            },
            "locked": {
              "lastModified": 1769548169,
              "narHash": "sha256-03+JxvzmfwRu+5JafM0DLbxgHttOQZkUtDWBmeUkN8Y=",
              "owner": "nix-community",
              "repo": "impermanence",
              "rev": "7b1d382faf603b6d264f58627330f9faa5cba149",
              "type": "github"
            },
            "original": {
              "owner": "nix-community",
              "repo": "impermanence",
              "type": "github"
            }
          },
          "nix-gc-env": {
            "locked": {
              "lastModified": 1688934394,
              "narHash": "sha256-Y72My5Ym2w9jhprmw8kQrom7ObvzqZ3DfNO2r3ZqfOo=",
              "owner": "Julow",
              "repo": "nix-gc-env",
              "rev": "c1e41568772c21a8274ab8edf5d0faadd5df4c8c",
              "type": "github"
            },
            "original": {
              "owner": "Julow",
              "repo": "nix-gc-env",
              "type": "github"
            }
          },
          "nixpkgs": {
            "locked": {
              "lastModified": 1744536153,
              "narHash": "sha256-awS2zRgF4uTwrOKwwiJcByDzDOdo3Q1rPZbiHQg/N38=",
              "owner": "NixOS",
              "repo": "nixpkgs",
              "rev": "18dd725c29603f582cf1900e0d25f9f1063dbf11",
              "type": "github"
            },
            "original": {
              "owner": "NixOS",
              "ref": "nixpkgs-unstable",
              "repo": "nixpkgs",
              "type": "github"
            }
          },
          "nixpkgs_2": {
            "locked": {
              "lastModified": 1779796641,
              "narHash": "sha256-ZsIrKmhp4vbBXoXXmR/tBXA/UCsAQiJL9vsgZEduhVY=",
              "owner": "nixos",
              "repo": "nixpkgs",
              "rev": "25f538306313eae3927264466c70d7001dcea1df",
              "type": "github"
            },
            "original": {
              "owner": "nixos",
              "ref": "nixos-25.11",
              "repo": "nixpkgs",
              "type": "github"
            }
          },
          "plasma-manager": {
            "inputs": {
              "home-manager": [
                "home-manager"
              ],
              "nixpkgs": [
                "nixpkgs"
              ]
            },
            "locked": {
              "lastModified": 1775856943,
              "narHash": "sha256-b7Mp7P+q2Md5AGt4rjHfMcBykzMumFTen10ST++AuTU=",
              "owner": "nix-community",
              "repo": "plasma-manager",
              "rev": "a524a6160e6df89f7673ba293cf7d78b559eb1a5",
              "type": "github"
            },
            "original": {
              "owner": "nix-community",
              "repo": "plasma-manager",
              "type": "github"
            }
          },
          "root": {
            "inputs": {
              "aagl": "aagl",
              "home-manager": "home-manager",
              "impermanence": "impermanence",
              "nix-gc-env": "nix-gc-env",
              "nixpkgs": "nixpkgs_2",
              "plasma-manager": "plasma-manager"
            }
          },
          "rust-overlay": {
            "inputs": {
              "nixpkgs": "nixpkgs"
            },
            "locked": {
              "lastModified": 1778469574,
              "narHash": "sha256-NTZzJ7xJvMXOonYqut3WLUhryeZj5QuuL0ANcqS7d30=",
              "owner": "oxalica",
              "repo": "rust-overlay",
              "rev": "4852a8aa041c94af55e136cde5b8b6d42c3563e8",
              "type": "github"
            },
            "original": {
              "owner": "oxalica",
              "repo": "rust-overlay",
              "type": "github"
            }
          }
        },
        "root": "root",
        "version": 7
      }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toMatchObject({
      deps: [
        {
          currentValue: 'release-25.11',
          datasource: 'git-refs',
          depName: 'aagl',
          lockedVersion: 'f2ef82f7a42bc099e35eea0673d277348050c90c',
          packageName: 'https://github.com/ezKEa/aagl-gtk-on-nix',
          versioning: 'nixpkgs',
        },
        {
          currentValue: 'release-25.11',
          datasource: 'git-refs',
          depName: 'home-manager',
          lockedVersion: '3ee51fbdac8c8bdfe1e7e1fcaba6520a563f394f',
          packageName: 'https://github.com/nix-community/home-manager',
          versioning: 'nixpkgs',
        },
        {
          datasource: 'git-refs',
          depName: 'impermanence',
          lockedVersion: '7b1d382faf603b6d264f58627330f9faa5cba149',
          packageName: 'https://github.com/nix-community/impermanence',
          versioning: 'git',
        },
        {
          datasource: 'git-refs',
          depName: 'nix-gc-env',
          lockedVersion: 'c1e41568772c21a8274ab8edf5d0faadd5df4c8c',
          packageName: 'https://github.com/Julow/nix-gc-env',
          versioning: 'git',
        },
        {
          currentValue: 'nixos-25.11',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          lockedVersion: '25f538306313eae3927264466c70d7001dcea1df',
          packageName: 'https://github.com/nixos/nixpkgs',
          versioning: 'nixpkgs',
        },
        {
          datasource: 'git-refs',
          depName: 'plasma-manager',
          lockedVersion: 'a524a6160e6df89f7673ba293cf7d78b559eb1a5',
          packageName: 'https://github.com/nix-community/plasma-manager',
          versioning: 'git',
        },
      ],
    });
  });
});
