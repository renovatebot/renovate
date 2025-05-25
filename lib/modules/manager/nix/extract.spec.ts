import { codeBlock } from 'common-tags';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import { extractPackageFile } from '.';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/manager/nix/extract', () => {
  const flake1Lock = codeBlock`{
    "nodes": {
      "root": {}
    },
    "root": "root",
    "version": 7
  }`;

  it('returns null when no nixpkgs input exists', async () => {
    const flakeNix = codeBlock`{
      inputs = {};
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flake1Lock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
  });

  it('match nixpkgs input', async () => {
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs.url = "github:nixos/nixpkgs/nixos-21.11";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flake1Lock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: 'nixos-21.11',
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: nixpkgsVersioning,
        },
      ],
    });
  });

  it('match nixpkgs input case insensitive', async () => {
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs.url = "github:NixOS/nixpkgs/nixos-21.11";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flake1Lock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
      deps: [
        {
          depName: 'nixpkgs',
          currentValue: 'nixos-21.11',
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: nixpkgsVersioning,
        },
      ],
    });
  });

  it('includes nixpkgs input with no explicit ref', async () => {
    const flakeNix = codeBlock`{
      inputs = {
        nixpkgs.url = "github:NixOS/nixpkgs";
      };
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flake1Lock);
    expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
      deps: [
        {
          currentValue: undefined,
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
          versioning: 'nixpkgs',
        },
      ],
    });
  });

  it('returns null when no inputs', async () => {
    fs.readLocalFile.mockResolvedValueOnce(flake1Lock);
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
          depName: 'nixpkgs',
          currentDigest: '9f4128e00b0ae8ec65918efeba59db998750ead6',
          currentValue: 'nixos-unstable',
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/NixOS/nixpkgs',
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
          currentDigest: '612ee628421ba2c1abca4c99684862f76cb3b089',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
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
          currentDigest: 'a0f54334df36770b335c051e540ba40afcbf8378',
          datasource: 'git-refs',
          depName: 'patchelf',
          packageName: 'https://github.com/NixOS/patchelf.git',
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
          currentDigest: '88f0d9ae98942bf49cba302c42b2a0f6e05f9b58',
          datasource: 'git-refs',
          depName: 'ijq',
          packageName: 'https://git.sr.ht/~gpanders/ijq',
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
          currentDigest: '65ae9c147349829d3df0222151f53f79821c5134',
          datasource: 'git-refs',
          depName: 'home-manager',
          packageName: 'https://gitlab.com/rycee/home-manager',
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
          currentDigest: '5633bcff0c6162b9e4b5f1264264611e950c8ec7',
          datasource: 'git-refs',
          depName: 'nixpkgs',
          packageName: 'https://github.com/NixOS/nixpkgs',
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
          currentDigest: '6bf2706348447df6f8b86b1c3e54f87b0afda84f',
          datasource: 'git-refs',
          depName: 'nixpkgs-extra-pkgs',
          packageName:
            'https://github.corp.example.com/my-org/nixpkgs-extra-pkgs',
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
          currentDigest: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
          datasource: 'git-refs',
          depName: 'data-mesher',
          packageName: 'https://git.clan.lol/clan/data-mesher',
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
          currentDigest: '24b560624f154c9e962d146217b2a964faaf2055',
          datasource: 'git-refs',
          depName: 'subgroup-project',
          packageName: 'https://gitlab.com/group/sub-group/subgroup-project',
        },
      ],
    });
  });
});
