import { codeBlock } from 'common-tags';
import { ZodError } from 'zod';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import { id as semverCoercedVersioning } from '../../versioning/semver-coerced';
import { extractPackageFile } from '.';
import { fs, logger } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/manager/nix/extract', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (fileName, siblingName) => siblingName,
    );
  });

  it('returns null when flake.lock file cannot be read', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
  });

  it('returns null when flake.lock cannot be parsed', async () => {
    fs.readLocalFile.mockResolvedValueOnce('{ invalid json');
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { flakeLockFile: 'flake.lock', error: expect.any(ZodError) },
      'invalid flake.lock file',
    );
  });

  it('returns null when flake.lock is missing root node', async () => {
    const flakeLock = codeBlock`{
      "nodes": {},
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { flakeLockFile: 'flake.lock' },
      'flake.lock is missing "root" node',
    );
  });

  it('skips transitive dependencies', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
        "nixpkgs": {
          "locked": {
            "lastModified": 1743259260,
            "narHash": "sha256-ArWLUgRm1tKHiqlhnymyVqi5kLNCK5ghvm06mfCl4QY=",
            "owner": "NixOS",
            "repo": "nixpkgs",
            "rev": "eb0e0f21f15c559d2ac7633dc81d079d1caf5f5f",
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
            "disko": "disko"
          }
        }
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
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          original: {
            owner: 'NixOS',
            ref: 'nixos-unstable',
            repo: 'nixpkgs',
            type: 'github',
          },
        },
      },
      'input is missing locked, skipping',
    );
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
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
            type: 'github',
          },
        },
      },
      'input is missing original, skipping',
    );
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
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
            type: 'indirect',
          },
          original: {
            owner: 'NixOS',
            ref: 'nixos-unstable',
            repo: 'nixpkgs',
            type: 'github',
          },
        },
      },
      'input is of type indirect, skipping',
    );
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
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
            type: 'path',
          },
          original: {
            owner: 'NixOS',
            ref: 'nixos-unstable',
            repo: 'nixpkgs',
            type: 'github',
          },
        },
      },
      'input is of type path, skipping',
    );
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
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            rev: '9f4128e00b0ae8ec65918efeba59db998750ead6',
            type: 'github',
          },
          original: {
            owner: 'NixOS',
            ref: 'nixos-unstable',
            repo: 'nixpkgs',
            type: 'path',
          },
        },
      },
      'input is of type path, skipping',
    );
  });

  it('ignores locked inputs not tracking a rev', async () => {
    const flakeLock = codeBlock`{
      "nodes": {
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
            "nixpkgs-lib": "nixpkgs-lib"
          }
        }
      },
      "root": "root",
      "version": 7
    }`;
    fs.readLocalFile.mockResolvedValueOnce(flakeLock);
    expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            type: 'tarball',
            url: 'https://github.com/NixOS/nixpkgs/archive/5487e69da40cbd611ab2cadee0b4637225f7cfae.tar.gz',
          },
          original: {
            type: 'tarball',
            url: 'https://github.com/NixOS/nixpkgs/archive/5487e69da40cbd611ab2cadee0b4637225f7cfae.tar.gz',
          },
        },
      },
      'locked input is not tracking a rev, skipping',
    );
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

    expect(
      await extractPackageFile(flakeNix, 'flake.nix', config),
    ).toMatchObject({
      deps: [
        {
          currentDigest: config.newDigest,
          depName: 'disko',
          packageName: 'https://github.com/nix-community/disko',
        },
      ],
    });
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        flakeLockFile: 'flake.lock',
        flakeInput: {
          locked: {
            rev: '76c0a6dba345490508f36c1aa3c7ba5b6b460989',
            type: 'github',
          },
          original: {
            owner: 'nix-community',
            repo: 'disko',
            rev: config.newDigest,
            type: 'github',
          },
        },
      },
      `overriding rev ${config.currentDigest} with new digest ${config.newDigest}`,
    );
  });

  describe('Git inputs', () => {
    it('supports input with ref', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          cachix.url = "git+https://github.com/cachix/cachix.git?ref=refs/tags/v1.7.2";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "cachix": {
            "locked": {
              "lastModified": 1709700175,
              "narHash": "sha256-A0/6ZjLmT9qdYzKHmevnEIC7G+GiZ4UCr8v0poRPzds=",
              "ref": "refs/tags/v1.7.2",
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            },
            "original": {
              "ref": "refs/tags/v1.7.2",
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            }
          },
          "root": {
            "inputs": {
              "cachix": "cachix"
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
            currentValue: 'v1.7.2',
            datasource: GitRefsDatasource.id,
            depName: 'cachix',
            lockedVersion: 'be97b37989f11b724197b5f4c7ffd78f12c8c4bf',
            packageName: 'https://github.com/cachix/cachix.git',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports input with rev', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          cachix.url = "git+https://github.com/cachix/cachix.git?rev=be97b37989f11b724197b5f4c7ffd78f12c8c4bf";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "cachix": {
            "locked": {
              "lastModified": 1709700175,
              "narHash": "sha256-A0/6ZjLmT9qdYzKHmevnEIC7G+GiZ4UCr8v0poRPzds=",
              "ref": "refs/heads/master",
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            },
            "original": {
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            }
          },
          "root": {
            "inputs": {
              "cachix": "cachix"
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
            datasource: GitRefsDatasource.id,
            depName: 'cachix',
            packageName: 'https://github.com/cachix/cachix.git',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports input with ref and rev', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          cachix.url = "git+https://github.com/cachix/cachix.git?ref=refs/tags/v1.7.2&rev=be97b37989f11b724197b5f4c7ffd78f12c8c4bf";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "cachix": {
            "locked": {
              "lastModified": 1709700175,
              "narHash": "sha256-A0/6ZjLmT9qdYzKHmevnEIC7G+GiZ4UCr8v0poRPzds=",
              "ref": "refs/tags/v1.7.2",
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "ssh://git@github.com/cachix/cachix.git"
            },
            "original": {
              "ref": "refs/tags/v1.7.2",
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "ssh://git@github.com/cachix/cachix.git"
            }
          },
          "root": {
            "inputs": {
              "cachix": "cachix"
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
            datasource: GitRefsDatasource.id,
            depName: 'cachix',
            packageName: 'ssh://git@github.com/cachix/cachix.git',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports locked input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          cachix.url = "git+https://github.com/cachix/cachix.git";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "cachix": {
            "locked": {
              "lastModified": 1709700175,
              "narHash": "sha256-A0/6ZjLmT9qdYzKHmevnEIC7G+GiZ4UCr8v0poRPzds=",
              "ref": "refs/heads/master",
              "rev": "be97b37989f11b724197b5f4c7ffd78f12c8c4bf",
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            },
            "original": {
              "type": "git",
              "url": "https://github.com/cachix/cachix.git"
            }
          },
          "root": {
            "inputs": {
              "cachix": "cachix"
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
            datasource: GitRefsDatasource.id,
            depName: 'cachix',
            lockedVersion: 'be97b37989f11b724197b5f4c7ffd78f12c8c4bf',
            packageName: 'https://github.com/cachix/cachix.git',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });
  });

  describe('GitHub inputs', () => {
    it('supports input with rev', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          flake-parts.url = "github:hercules-ci/flake-parts/4524271976b625a4a605beefd893f270620fd751";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "flake-parts": {
            "locked": {
              "lastModified": 1756770412,
              "narHash": "sha256-+uWLQZccFHwqpGqr2Yt5VsW/PbeJVTn9Dk6SHWhNRPw=",
              "owner": "hercules-ci",
              "repo": "flake-parts",
              "rev": "4524271976b625a4a605beefd893f270620fd751",
              "type": "github"
            },
            "original": {
              "owner": "hercules-ci",
              "repo": "flake-parts",
              "rev": "4524271976b625a4a605beefd893f270620fd751",
              "type": "github"
            }
          },
          "root": {
            "inputs": {
              "flake-parts": "flake-parts"
            }
          }
        },
        "root": "root",
        "version": 7
      }`;
      fs.readLocalFile.mockResolvedValueOnce(flakeLock);
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
        deps: [
          {
            currentDigest: '4524271976b625a4a605beefd893f270620fd751',
            datasource: GitRefsDatasource.id,
            depName: 'flake-parts',
            packageName: 'https://github.com/hercules-ci/flake-parts',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports locked input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          flake-parts.url = "github:hercules-ci/flake-parts";
        };7
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "flake-parts": {
            "locked": {
              "lastModified": 1756770412,
              "narHash": "sha256-+uWLQZccFHwqpGqr2Yt5VsW/PbeJVTn9Dk6SHWhNRPw=",
              "owner": "hercules-ci",
              "repo": "flake-parts",
              "rev": "4524271976b625a4a605beefd893f270620fd751",
              "type": "github"
            },
            "original": {
              "owner": "hercules-ci",
              "repo": "flake-parts",
              "type": "github"
            }
          },
          "root": {
            "inputs": {
              "flake-parts": "flake-parts"
            }
          }
        },
        "root": "root",
        "version": 7
      }`;
      fs.readLocalFile.mockResolvedValueOnce(flakeLock);
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
        deps: [
          {
            datasource: GitRefsDatasource.id,
            depName: 'flake-parts',
            lockedVersion: '4524271976b625a4a605beefd893f270620fd751',
            packageName: 'https://github.com/hercules-ci/flake-parts',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports nixpkgs input with ref', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          flake-utils.url = "github:NixOS/nixpkgs/nixos-unstable";
        };
      }`;
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
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toEqual({
        deps: [
          {
            currentValue: 'nixos-unstable',
            datasource: GitRefsDatasource.id,
            depName: 'nixpkgs',
            packageName: 'https://github.com/NixOS/nixpkgs',
            lockedVersion: '9f4128e00b0ae8ec65918efeba59db998750ead6',
            versioning: nixpkgsVersioning,
          },
        ],
      });
    });

    it('supports locked nixpkgs input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          flake-utils.url = "github:NixOS/nixpkgs";
        };
      }`;
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
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toMatchObject({
        deps: [
          {
            datasource: GitRefsDatasource.id,
            depName: 'nixpkgs',
            lockedVersion: '612ee628421ba2c1abca4c99684862f76cb3b089',
            packageName: 'https://github.com/NixOS/nixpkgs',
          },
        ],
      });
    });
  });

  describe('GitHub Enterprise inputs', () => {
    it('supports ...', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          nixpkgs-extra-pkgs.url = "github:my-org/nixpkgs-extra-pkgs?host=github.corp.example.com";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "nixpkgs-extra-pkgs": {
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
          }
        },
        "root": "root",
        "version": 7
      }`;
      fs.readLocalFile.mockResolvedValueOnce(flakeLock);
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toMatchObject({
        deps: [
          {
            datasource: GitRefsDatasource.id,
            depName: 'nixpkgs-extra-pkgs',
            lockedVersion: '6bf2706348447df6f8b86b1c3e54f87b0afda84f',
            packageName:
              'https://github.corp.example.com/my-org/nixpkgs-extra-pkgs',
          },
        ],
      });
    });
  });

  describe('GitLab inputs', () => {
    it('supports locked input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          home-manager.url = "gitlab:rycee/home-manager";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "home-manager": {
            "locked": {
              "lastModified": 1757385184,
              "narHash": "sha256-LCxtQn9ajvOgGRbQIRUJgfP7clMGGvV1SDW1HcSb0zk=",
              "owner": "rycee",
              "repo": "home-manager",
              "rev": "26993d87fd0d3b14f7667b74ad82235f120d986e",
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
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toMatchObject({
        deps: [
          {
            datasource: GitRefsDatasource.id,
            depName: 'home-manager',
            lockedVersion: '26993d87fd0d3b14f7667b74ad82235f120d986e',
            packageName: 'https://gitlab.com/rycee/home-manager',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });
  });

  describe('SourceHut inputs', () => {
    it('supports locked input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          firefox-addons.url = "sourcehut:~rycee/nur-expressions?dir=pkgs/firefox-addons";
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "firefox-addons": {
            "locked": {
              "dir": "pkgs/firefox-addons",
              "lastModified": 1755702597,
              "narHash": "sha256-Z56emoVLFBhX/WcoXWiXienLX8jHrBExyqQjNd5/r0k=",
              "owner": "~rycee",
              "repo": "nur-expressions",
              "rev": "2dcb371b407ba4009e27a8e8adf88e6f93d40bfb",
              "type": "sourcehut"
            },
            "original": {
              "dir": "pkgs/firefox-addons",
              "owner": "~rycee",
              "repo": "nur-expressions",
              "type": "sourcehut"
            }
          },
          "root": {
            "inputs": {
              "firefox-addons": "firefox-addons"
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
            datasource: GitRefsDatasource.id,
            depName: 'firefox-addons',
            lockedVersion: '2dcb371b407ba4009e27a8e8adf88e6f93d40bfb',
            packageName: 'https://git.sr.ht/~rycee/nur-expressions',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });
  });

  describe('Tarball inputs', () => {
    it('supports locked input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          lix = {
            url = "https://git.lix.systems/lix-project/lix/archive/main.tar.gz";
            flake = false;
          };
        };
      }`;
      const flakeLock = codeBlock`{
        "nodes": {
          "lix": {
            "flake": false,
            "locked": {
              "lastModified": 1756426754,
              "narHash": "sha256-EVJDo/KjdGtvJKelVPoL92TsPNrqnOJUnaLTIqP+F0o=",
              "rev": "f4bdddf0fdaabc68546cf561c5343b83d95d2466",
              "type": "tarball",
              "url": "https://git.lix.systems/api/v1/repos/lix-project/lix/archive/f4bdddf0fdaabc68546cf561c5343b83d95d2466.tar.gz"
            },
            "original": {
              "type": "tarball",
              "url": "https://git.lix.systems/lix-project/lix/archive/main.tar.gz"
            }
          },
          "root": {
            "inputs": {
              "lix": "lix"
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
            datasource: GitRefsDatasource.id,
            depName: 'lix',
            lockedVersion: 'f4bdddf0fdaabc68546cf561c5343b83d95d2466',
            packageName: 'https://git.lix.systems/lix-project/lix',
            versioning: semverCoercedVersioning,
          },
        ],
      });
    });

    it('supports locked nixpkgs input', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.xz";
        };
      }`;
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
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toMatchObject({
        deps: [
          {
            currentValue: 'nixpkgs-unstable',
            datasource: GitRefsDatasource.id,
            depName: 'nixpkgs',
            lockedVersion: '0e6684e6c5755325f801bda1751a8a4038145d7d',
            packageName: 'https://github.com/NixOS/nixpkgs',
            versioning: nixpkgsVersioning,
          },
        ],
      });
    });
  });

  it('ignores unknown inputs types', async () => {
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
});
