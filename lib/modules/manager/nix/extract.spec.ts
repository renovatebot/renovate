import { codeBlock } from 'common-tags';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { id as nixpkgsVersioning } from '../../versioning/nixpkgs';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/manager/nix/extract', () => {
  const flakeEmptyLock = Fixtures.get('flake-empty.lock');
  const flakeNixpkgsLock = Fixtures.get('flake-nixpkgs.lock');
  const flakeGHELock = Fixtures.get('flake-github-enterprise.lock');

  // Helper function to create flake lock JSON
  function createFlakeLock(nodes: Record<string, any>, version = 7) {
    const rootInputs: Record<string, string> = {};
    for (const key of Object.keys(nodes)) {
      rootInputs[key] = key;
    }
    return JSON.stringify(
      {
        nodes: { root: { inputs: rootInputs }, ...nodes },
        root: 'root',
        version,
      },
      null,
      2,
    );
  }

  // Helper function to create a dependency node
  function createNode(
    type: string,
    owner: string | null,
    repo: string | null,
    options: any = {},
  ) {
    const base: any = {
      locked: {
        lastModified: 1720031269,
        narHash: 'sha256-test',
        rev: options.lockedRev ?? 'abc123',
        type,
        ...options.locked,
      },
      original: {
        type,
        ...options.original,
      },
    };

    if (owner !== null) {
      base.locked.owner = owner;
      base.original.owner = owner;
    }
    if (repo !== null) {
      base.locked.repo = repo;
      base.original.repo = repo;
    }

    return base;
  }

  describe('basic functionality', () => {
    it('returns null when no nixpkgs input exists', async () => {
      const flakeNix = codeBlock`{
        inputs = {};
      }`;
      fs.readLocalFile.mockResolvedValueOnce(flakeEmptyLock);
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
    });

    it('returns null for empty inputs', async () => {
      fs.readLocalFile.mockResolvedValueOnce(flakeEmptyLock);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });

    it('returns null when flake.lock cannot be read', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });

    it('returns null for invalid JSON', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{ invalid json');
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });

    it('handles unsupported lock version', async () => {
      const lockV6 = createFlakeLock({}, 6);
      fs.readLocalFile.mockResolvedValueOnce(lockV6);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });
  });

  describe('nixpkgs extraction', () => {
    it('extracts nixpkgs with ref', async () => {
      fs.readLocalFile.mockResolvedValueOnce(flakeNixpkgsLock);
      expect(await extractPackageFile('', 'flake.nix')).toEqual({
        deps: [
          {
            depName: 'nixpkgs',
            currentDigest: undefined,
            currentValue: 'nixos-unstable',
            datasource: GitRefsDatasource.id,
            packageName: 'https://github.com/NixOS/nixpkgs',
            replaceString: 'nixos-unstable',
            lockedVersion: undefined,
            versioning: nixpkgsVersioning,
          },
        ],
      });
    });

    it('handles nixpkgs case insensitive', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          nixpkgs.url = "github:NixOS/nixpkgs/nixos-21.11";
        };
      }`;
      fs.readLocalFile.mockResolvedValueOnce(flakeEmptyLock);
      expect(await extractPackageFile(flakeNix, 'flake.nix')).toBeNull();
    });

    it('handles nixpkgs without explicit ref', async () => {
      const lock = createFlakeLock({
        nixpkgs: createNode('github', 'NixOS', 'nixpkgs'),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'nixpkgs',
        packageName: 'https://github.com/NixOS/nixpkgs',
        lockedVersion: 'abc123',
      });
    });

    it('handles indirect nixpkgs type', async () => {
      const lock = createFlakeLock({
        nixpkgs: createNode('github', 'NixOS', 'nixpkgs', {
          original: { id: 'nixpkgs', type: 'indirect' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });
  });

  describe('GitHub sources', () => {
    it('extracts GitHub dependencies', async () => {
      const lock = createFlakeLock({
        'flake-utils': createNode('github', 'numtide', 'flake-utils'),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'flake-utils',
        datasource: 'git-refs',
        packageName: 'https://github.com/numtide/flake-utils',
        lockedVersion: 'abc123',
      });
    });

    it('handles GitHub Enterprise', async () => {
      fs.readLocalFile.mockResolvedValueOnce(flakeGHELock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'nixpkgs-extra-pkgs',
        packageName:
          'https://github.corp.example.com/my-org/nixpkgs-extra-pkgs',
        lockedVersion: '6bf2706348447df6f8b86b1c3e54f87b0afda84f',
      });
    });

    it('extracts GitHub shorthand from flake.nix', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          nixpkgs-branch.url = "github:NixOS/nixpkgs/nixos-24.05";
          nixpkgs-commit.url = "github:NixOS/nixpkgs/af51545ec9a44eadf3fe3547610a5cdd882bc34e";
        };
      }`;
      const lock = createFlakeLock({
        'nixpkgs-branch': createNode('github', 'NixOS', 'nixpkgs', {
          original: { ref: 'nixos-24.05' },
        }),
        'nixpkgs-commit': createNode('github', 'NixOS', 'nixpkgs', {
          original: { rev: 'af51545ec9a44eadf3fe3547610a5cdd882bc34e' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      fs.readLocalFile.mockResolvedValueOnce(flakeNix);

      const result = await extractPackageFile(flakeNix, 'flake.nix');
      expect(result?.deps).toHaveLength(2);
      expect(result?.deps[0]).toMatchObject({
        depName: 'nixpkgs-branch',
        currentValue: 'nixos-24.05',
        replaceString: 'nixos-24.05',
      });
      expect(result?.deps[1]).toMatchObject({
        depName: 'nixpkgs-commit',
        currentDigest: 'af51545ec9a44eadf3fe3547610a5cdd882bc34e',
        replaceString: 'af51545ec9a44eadf3fe3547610a5cdd882bc34e',
      });
    });
  });

  describe('GitLab sources', () => {
    it('extracts GitLab dependencies', async () => {
      const lock = createFlakeLock({
        'home-manager': createNode('gitlab', 'rycee', 'home-manager'),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'home-manager',
        packageName: 'https://gitlab.com/rycee/home-manager',
      });
    });

    it('handles GitLab with custom host', async () => {
      const lock = createFlakeLock({
        'custom-project': createNode('gitlab', 'group', 'project', {
          locked: { host: 'gitlab.example.com' },
          original: { host: 'gitlab.example.com' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        packageName: 'https://gitlab.example.com/group/project',
      });
    });

    it('decodes URL-encoded GitLab subgroups', async () => {
      const lock = createFlakeLock({
        'subgroup-project': createNode(
          'gitlab',
          'group%2Fsub-group',
          'subgroup-project',
        ),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        packageName: 'https://gitlab.com/group/sub-group/subgroup-project',
      });
    });
  });

  describe('SourceHut sources', () => {
    it('extracts SourceHut dependencies', async () => {
      const lock = createFlakeLock({
        ijq: createNode('sourcehut', '~gpanders', 'ijq'),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'ijq',
        packageName: 'https://git.sr.ht/~gpanders/ijq',
      });
    });

    it('handles SourceHut with custom host', async () => {
      const lock = createFlakeLock({
        'custom-project': createNode('sourcehut', '~user', 'project', {
          locked: { host: 'git.custom.org' },
          original: { host: 'git.custom.org' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        packageName: 'https://git.custom.org/~user/project',
      });
    });
  });

  describe('Git sources', () => {
    it('extracts git dependencies', async () => {
      const lock = createFlakeLock({
        patchelf: createNode('git', null, null, {
          locked: { url: 'https://github.com/NixOS/patchelf.git' },
          original: { url: 'https://github.com/NixOS/patchelf.git' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'patchelf',
        packageName: 'https://github.com/NixOS/patchelf.git',
      });
    });

    it('strips refs/tags and refs/heads prefixes', async () => {
      const lock = createFlakeLock({
        'example-with-tag': createNode('git', null, null, {
          locked: {
            url: 'ssh://git@example.com/org/example-repo',
            ref: 'refs/tags/2.8.0',
            rev: 'f4aeb03f994ad3b2388bc59eae848dcc2dd2f5b7',
          },
          original: {
            url: 'ssh://git@example.com/org/example-repo',
            ref: 'refs/tags/2.8.0',
            rev: 'f4aeb03f994ad3b2388bc59eae848dcc2dd2f5b7',
          },
        }),
        'repo-with-branch': createNode('git', null, null, {
          locked: {
            url: 'ssh://git@example.com/org/repo',
            ref: 'refs/heads/main',
            rev: 'abc123def456',
          },
          original: {
            url: 'ssh://git@example.com/org/repo',
            ref: 'refs/heads/main',
            rev: 'abc123def456',
          },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');

      expect(result?.deps[0]).toMatchObject({
        currentValue: '2.8.0',
        currentDigest: 'f4aeb03f994ad3b2388bc59eae848dcc2dd2f5b7',
      });
      expect(result?.deps[1]).toMatchObject({
        currentValue: 'main',
        currentDigest: 'abc123def456',
      });
    });

    it('handles git with ref but no rev', async () => {
      const lock = createFlakeLock({
        'example-project': createNode('git', null, null, {
          locked: {
            url: 'ssh://git@example.com/org/example-project.git',
            ref: 'refs/tags/7.17.0',
            dir: '.minimal',
          },
          original: {
            url: 'ssh://git@example.com/org/example-project.git',
            ref: 'refs/tags/7.17.0',
            dir: '.minimal',
          },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');

      expect(result?.deps[0]).toMatchObject({
        currentValue: '7.17.0',
        replaceString: 'refs/tags/7.17.0',
        lockedVersion: 'abc123',
      });
    });
  });

  describe('Tarball sources', () => {
    it('extracts tarball dependencies', async () => {
      const lock = createFlakeLock({
        'data-mesher': {
          locked: {
            lastModified: 1727355895,
            narHash: 'sha256-grZIaLgk5GgoDuTt49RTCLBh458H4YJdIAU4B3onXRw=',
            rev: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
            type: 'tarball',
            url: 'https://git.clan.lol/api/v1/repos/clan/data-mesher/archive/c7e39452affcc0f89e023091524e38b3aaf109e9.tar.gz',
          },
          original: {
            type: 'tarball',
            url: 'https://git.clan.lol/clan/data-mesher/archive/main.tar.gz',
          },
        },
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        depName: 'data-mesher',
        packageName: 'https://git.clan.lol/clan/data-mesher',
        lockedVersion: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
      });
    });

    it('skips pure tarball without git URL', async () => {
      const lock = createFlakeLock({
        'nixpkgs-lib': {
          locked: {
            type: 'tarball',
            url: 'https://github.com/NixOS/nixpkgs/archive/072a6db25e947df2f31aab9eccd0ab75d5b2da11.tar.gz',
          },
          original: {
            type: 'tarball',
            url: 'https://github.com/NixOS/nixpkgs/archive/072a6db25e947df2f31aab9eccd0ab75d5b2da11.tar.gz',
          },
        },
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });
  });

  describe('flake.nix parsing', () => {
    it('extracts updated ref from flake.nix when it differs from lock', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          nix-overlay.url = "git+ssh://git@github.com/example/nix-overlay?ref=refs/tags/25.128.0";
        };
      }`;
      const lock = createFlakeLock({
        'nix-overlay': createNode('git', null, null, {
          locked: {
            url: 'ssh://git@github.com/example/nix-overlay',
            ref: 'refs/tags/25.0.0',
            rev: 'e90490b57bbe472313ae4138e3ad92d047315b6a',
          },
          original: {
            url: 'ssh://git@github.com/example/nix-overlay',
            ref: 'refs/tags/25.0.0',
          },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile(flakeNix, 'flake.nix');
      expect(result?.deps[0]).toMatchObject({
        currentValue: '25.128.0',
        replaceString: 'refs/tags/25.128.0',
      });
    });

    it('handles currentDigest replacement in config', async () => {
      const flakeNix = codeBlock`{
        inputs = {
          disko.url = "github:nix-community/disko/newdigest123";
        };
      }`;
      const lock = createFlakeLock({
        disko: createNode('github', 'nix-community', 'disko', {
          original: { rev: 'olddigest123' },
        }),
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const config = {
        currentDigest: 'olddigest123',
        newDigest: 'newdigest123',
      };
      const result = await extractPackageFile(flakeNix, 'flake.nix', config);
      expect(result?.deps[0]).toMatchObject({
        currentDigest: 'newdigest123',
        depName: 'disko',
      });
    });
  });

  describe('edge cases', () => {
    it('handles unknown flake lock type', async () => {
      const lock = createFlakeLock({
        'unknown-flake': {
          locked: {
            type: 'unknown-type',
            rev: 'c7e39452affcc0f89e023091524e38b3aaf109e9',
          },
          original: { type: 'unknown-type' },
        },
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      expect(await extractPackageFile('', 'flake.nix')).toBeNull();
    });

    it('skips transitive dependencies', async () => {
      const lock = JSON.stringify({
        nodes: {
          root: { inputs: { direct: 'direct' } },
          direct: {
            locked: {
              type: 'github',
              owner: 'owner',
              repo: 'repo',
              rev: 'abc',
            },
            original: { type: 'github', owner: 'owner', repo: 'repo' },
          },
          transitive: {
            locked: { type: 'github', owner: 'other', repo: 'dep', rev: 'def' },
            original: { type: 'github', owner: 'other', repo: 'dep' },
          },
        },
        root: 'root',
        version: 7,
      });
      fs.readLocalFile.mockResolvedValueOnce(lock);
      const result = await extractPackageFile('', 'flake.nix');
      expect(result?.deps).toHaveLength(1);
      expect(result?.deps[0].depName).toBe('direct');
    });
  });
});
