import { describe, expect, it, vi } from 'vitest';
import {
  extractPackageFile,
  isIgnoredPath,
  parseDependencyItem,
  parseRequiresItems,
} from './extract.ts';
import * as registry from './registry.ts';

vi.mock('./registry.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof registry>();
  return {
    ...actual,
    resolvePackageUrl: vi.fn(),
  };
});

describe('modules/manager/nimble/extract', () => {
  describe('parseRequiresItems', () => {
    it('extracts multiple comma-separated items', () => {
      const items = parseRequiresItems(
        'requires "zippy >= 0.10.4", "checksums >= 0.1.0"',
      );
      expect(items).toEqual(['zippy >= 0.10.4', 'checksums >= 0.1.0']);
    });

    it('extracts single quoted items', () => {
      const items = parseRequiresItems("requires 'nim >= 2.0.0'");
      expect(items).toEqual(['nim >= 2.0.0']);
    });

    it('skips empty elements in comma-separated strings', () => {
      const items = parseRequiresItems(
        'requires "zippy >= 0.10.4, , checksums"',
      );
      expect(items).toEqual(['zippy >= 0.10.4', 'checksums']);
    });
  });

  describe('parseDependencyItem', () => {
    it('handles standard constraint operators', () => {
      expect(parseDependencyItem('zippy >= 0.10.4')).toEqual({
        depName: 'zippy',
        currentValue: '>= 0.10.4',
      });
      expect(parseDependencyItem('yaml ^= 2.1.0')).toEqual({
        depName: 'yaml',
        currentValue: '^= 2.1.0',
      });
      expect(parseDependencyItem('chronos ~= 3.0.0')).toEqual({
        depName: 'chronos',
        currentValue: '~= 3.0.0',
      });
      expect(parseDependencyItem('jester == 0.5.0')).toEqual({
        depName: 'jester',
        currentValue: '== 0.5.0',
      });
      expect(parseDependencyItem('pkg >= 1.0.0 & < 2.0.0')).toEqual({
        depName: 'pkg',
        currentValue: '>= 1.0.0 & < 2.0.0',
      });
    });

    it('handles bare versions without operator', () => {
      expect(parseDependencyItem('jester 0.5.0')).toEqual({
        depName: 'jester',
        currentValue: '0.5.0',
      });
    });

    it('handles VCS ref pins', () => {
      expect(parseDependencyItem('ws#head')).toEqual({
        depName: 'ws',
        currentValue: '#head',
      });
      expect(parseDependencyItem('pkg#main')).toEqual({
        depName: 'pkg',
        currentValue: '#main',
      });
      expect(parseDependencyItem('pkg #feature-branch')).toEqual({
        depName: 'pkg',
        currentValue: '#feature-branch',
      });
    });

    it('handles bare packages without version and file:// URLs', () => {
      expect(parseDependencyItem('posix_utils')).toEqual({
        depName: 'posix_utils',
        currentValue: '',
      });
      expect(parseDependencyItem('file:///local/path >= 1.0')).toEqual({
        depName: 'file:///local/path >= 1.0',
        currentValue: '',
      });
    });

    it('strips feature flags', () => {
      expect(parseDependencyItem('cligen [cli] >= 1.0.0')).toEqual({
        depName: 'cligen',
        currentValue: '>= 1.0.0',
      });
      expect(parseDependencyItem('pkg[gui] 1.0.0')).toEqual({
        depName: 'pkg',
        currentValue: '1.0.0',
      });
    });

    it('returns empty depName for blank or whitespace string', () => {
      expect(parseDependencyItem('   ')).toEqual({
        depName: '',
        currentValue: '',
      });
    });
  });

  describe('isIgnoredPath', () => {
    it('returns false when packageFile is undefined', () => {
      expect(isIgnoredPath(undefined)).toBeFalse();
    });

    it('identifies ignored directory segments', () => {
      expect(isIgnoredPath('nimbledeps/pkg/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('deps/pkg/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('_deps/pkg/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('.atlas/pkg/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('.nimble/pkgs/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('nimcache/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('.nimcache/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('nimblecache/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('nested/dir/nimblecache/pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('nested\\dir\\.atlas\\pkg.nimble')).toBeTrue();
      expect(isIgnoredPath('src/packages/my_pkg.nimble')).toBeFalse();
    });
  });

  describe('extractPackageFile', () => {
    it('returns null on empty content', async () => {
      await expect(extractPackageFile('')).resolves.toBeNull();
    });

    it('returns null when manifest has content but no dependencies', async () => {
      const content = `
version     = "1.0.0"
author      = "Someone"
description = "A package with no deps"
license     = "MIT"
      `;
      await expect(extractPackageFile(content)).resolves.toBeNull();
    });

    it('extracts dependencies from real-world nimble manifest including bare packages and bare versions', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'nim') {
            return Promise.resolve('https://github.com/nim-lang/Nim');
          }
          if (depName === 'zippy') {
            return Promise.resolve('https://github.com/guzba/zippy');
          }
          if (depName === 'checksums') {
            return Promise.resolve('https://github.com/nim-lang/checksums');
          }
          if (depName === 'jester') {
            return Promise.resolve('https://github.com/dom96/jester');
          }
          return Promise.resolve(undefined);
        },
      );

      const content = `
# Package
version       = "0.1.0"
author        = "Axiomantic"
description   = "Sample package"
license       = "MIT"

# Dependencies
requires "nim >= 2.0.0"
requires "zippy >= 0.10.4", "checksums >= 0.1.0"
requires "jester 0.5.0"
requires "ws#head"
requires "posix_utils"

task test, "Run tests":
  exec "nim c -r tests/test_all.nim"
      `;

      const res = await extractPackageFile(content);
      expect(res).toEqual({
        deps: [
          {
            depName: 'nim',
            packageName: 'https://github.com/nim-lang/Nim',
            currentValue: '>= 2.0.0',
            datasource: 'git-tags',
            depType: 'compiler',
            replaceString: 'nim >= 2.0.0',
          },
          {
            depName: 'zippy',
            packageName: 'https://github.com/guzba/zippy',
            currentValue: '>= 0.10.4',
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'zippy >= 0.10.4',
          },
          {
            depName: 'checksums',
            packageName: 'https://github.com/nim-lang/checksums',
            currentValue: '>= 0.1.0',
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'checksums >= 0.1.0',
          },
          {
            depName: 'jester',
            packageName: 'https://github.com/dom96/jester',
            currentValue: '0.5.0',
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'jester 0.5.0',
          },
          {
            depName: 'ws',
            packageName: undefined,
            currentValue: '#head',
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'ws#head',
            skipReason: 'not-a-version',
          },
          {
            depName: 'posix_utils',
            packageName: undefined,
            currentValue: undefined,
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'posix_utils',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts parenthesized requires declarations (single-line and multiline)', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'nim') {
            return Promise.resolve('https://github.com/nim-lang/Nim');
          }
          if (depName === 'zippy') {
            return Promise.resolve('https://github.com/guzba/zippy');
          }
          if (depName === 'chronos') {
            return Promise.resolve('https://github.com/status-im/nim-chronos');
          }
          return Promise.resolve(undefined);
        },
      );

      const content = `
requires("nim >= 2.0.0")
requires ("zippy >= 0.10.4", "chronos >= 4.0.0")
requires(
  "chronos >= 4.0.0",
  "zippy >= 0.10.0"
)
      `;

      const res = await extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps).toHaveLength(5);
      expect(res?.deps[0]).toMatchObject({
        depName: 'nim',
        currentValue: '>= 2.0.0',
        depType: 'compiler',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'zippy',
        currentValue: '>= 0.10.4',
        depType: 'dependencies',
      });
      expect(res?.deps[2]).toMatchObject({
        depName: 'chronos',
        currentValue: '>= 4.0.0',
        depType: 'dependencies',
      });
      expect(res?.deps[3]).toMatchObject({
        depName: 'chronos',
        currentValue: '>= 4.0.0',
        depType: 'dependencies',
      });
      expect(res?.deps[4]).toMatchObject({
        depName: 'zippy',
        currentValue: '>= 0.10.0',
        depType: 'dependencies',
      });
    });

    it('handles parenthesized taskRequires declarations (single-line and multiline)', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'testament') {
            return Promise.resolve('https://github.com/nim-lang/testament');
          }
          if (depName === 'criterion') {
            return Promise.resolve('https://github.com/cblp/nim-criterion');
          }
          return Promise.resolve(undefined);
        },
      );

      const content = `
taskRequires("test", "testament >= 0.1.0")
taskRequires(bench, "criterion >= 0.2.0")
taskRequires("multi",
  "testament >= 0.2.0",
  "criterion >= 0.3.0"
)
      `;

      const res = await extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps).toHaveLength(4);
      expect(res?.deps[0]).toMatchObject({
        depName: 'testament',
        currentValue: '>= 0.1.0',
        depType: 'taskRequires',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'criterion',
        currentValue: '>= 0.2.0',
        depType: 'taskRequires',
      });
      expect(res?.deps[2]).toMatchObject({
        depName: 'testament',
        currentValue: '>= 0.2.0',
        depType: 'taskRequires',
      });
      expect(res?.deps[3]).toMatchObject({
        depName: 'criterion',
        currentValue: '>= 0.3.0',
        depType: 'taskRequires',
      });
    });

    it('resolves forge aliases and extracts clean repo name', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'github:nim-lang/cmark') {
            return Promise.resolve('https://github.com/nim-lang/cmark');
          }
          return Promise.resolve(undefined);
        },
      );

      const content = 'requires "github:nim-lang/cmark >= 0.10.0"';
      const res = await extractPackageFile(content);
      expect(res).toEqual({
        deps: [
          {
            depName: 'cmark',
            packageName: 'https://github.com/nim-lang/cmark',
            currentValue: '>= 0.10.0',
            datasource: 'git-tags',
            depType: 'dependencies',
            replaceString: 'github:nim-lang/cmark >= 0.10.0',
          },
        ],
      });
    });

    it('classifies nimrod and compiler as compiler depType', async () => {
      vi.mocked(registry.resolvePackageUrl).mockResolvedValue(
        'https://github.com/nim-lang/Nim',
      );

      const content = `
requires "nimrod >= 0.19.0"
requires "compiler >= 1.6.0"
      `;
      const res = await extractPackageFile(content);
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0]).toMatchObject({
        depName: 'nimrod',
        depType: 'compiler',
        packageName: 'https://github.com/nim-lang/Nim',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'compiler',
        depType: 'compiler',
        packageName: 'https://github.com/nim-lang/Nim',
      });
    });

    it('ignores requires inside task blocks and recovers on unindented line', async () => {
      vi.mocked(registry.resolvePackageUrl).mockResolvedValue(undefined);

      const content = `
version = "1.0.0"
requires "nim >= 2.0.0"

task test, "Run tests":
  echo "requires inside task block should be ignored"
  exec "echo requires not real"

requires "zippy >= 0.10.4"
      `;

      const res = await extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0].depName).toBe('nim');
      expect(res?.deps[1].depName).toBe('zippy');
    });

    it('skips empty or whitespace-only items in requires declarations', async () => {
      vi.mocked(registry.resolvePackageUrl).mockResolvedValue(undefined);

      const content =
        'requires "", "   ", "[cli]", "zippy >= 0.10.4", "file:///local/pkg"';
      const res = await extractPackageFile(content);
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0].depName).toBe('zippy');
      expect(res?.deps[1]).toEqual({
        depName: 'file:///local/pkg',
        datasource: 'git-tags',
        depType: 'dependencies',
        skipReason: 'file-dependency',
      });
    });

    it('ignores manifests inside nimbledeps, deps, _deps, .atlas, .nimble, and nimblecache', async () => {
      const content = 'requires "zippy >= 0.10.4"';
      await expect(
        extractPackageFile(content, 'nimbledeps/pkgs2/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, 'deps/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, 'src/deps/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, '_deps/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, '.atlas/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, '.nimble/foo/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, 'nimcache/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, '.nimcache/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, 'nimblecache/foo.nimble'),
      ).resolves.toBeNull();
      await expect(
        extractPackageFile(content, 'packages/foo/foo.nimble'),
      ).resolves.not.toBeNull();
    });

    it('sets official repository for nim compiler and direct git URLs (https, http, git@)', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'nim') {
            return Promise.resolve('https://github.com/nim-lang/Nim');
          }
          return Promise.resolve(depName);
        },
      );

      const content = `
requires "nim >= 2.0.0"
requires "https://github.com/guzba/zippy >= 0.10.4"
requires "http://github.com/nim-lang/packages >= 1.0.0"
requires "git@github.com:nim-lang/checksums.git >= 0.1.0"
requires "https://github.com/nim-lang/trailing/"
      `;
      const res = await extractPackageFile(content, 'foo.nimble');
      expect(res?.deps).toHaveLength(5);
      expect(res?.deps[0]).toMatchObject({
        depName: 'nim',
        packageName: 'https://github.com/nim-lang/Nim',
        depType: 'compiler',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'zippy',
        packageName: 'https://github.com/guzba/zippy',
      });
      expect(res?.deps[2]).toMatchObject({
        depName: 'packages',
        packageName: 'http://github.com/nim-lang/packages',
      });
      expect(res?.deps[3]).toMatchObject({
        depName: 'checksums',
        packageName: 'git@github.com:nim-lang/checksums.git',
      });
      expect(res?.deps[4]).toMatchObject({
        depName: 'https://github.com/nim-lang/trailing/',
        packageName: 'https://github.com/nim-lang/trailing/',
      });
    });

    it('extracts multiline requires continuations and comma-separated items', async () => {
      vi.mocked(registry.resolvePackageUrl).mockResolvedValue(undefined);

      const content = `
requires "nim >= 2.0.0",
         "checksums >= 0.1.0",
         "zippy >= 0.10.0, jester >= 0.5.0"
      `;
      const res = await extractPackageFile(content, 'foo.nimble');
      expect(res?.deps).toHaveLength(4);
      expect(res?.deps.map((d) => d.depName)).toEqual([
        'nim',
        'checksums',
        'zippy',
        'jester',
      ]);
    });

    it('extracts taskRequires dependencies with depType taskRequires', async () => {
      vi.mocked(registry.resolvePackageUrl).mockImplementation(
        (depName: string) => {
          if (depName === 'chronos') {
            return Promise.resolve('https://github.com/status-im/nim-chronos');
          }
          if (depName === 'stew') {
            return Promise.resolve('https://github.com/status-im/nim-stew');
          }
          if (depName === 'criterion') {
            return Promise.resolve('https://github.com/cblp/nim-criterion.git');
          }
          return Promise.resolve(undefined);
        },
      );

      const content = `
version = "0.1.0"

# Main dependencies
requires "nim >= 2.0.0"

# Task requirements (quoted task name, single and multiple)
taskRequires "test", "chronos >= 4.2.2"
taskRequires "bench", "criterion >= 0.2.0", "stew >= 0.1.0"
taskRequires baretask, "chronos >= 4.2.0"

task test, "Run tests":
  taskRequires "test", "stew#head"
  exec "nim c -r test"
      `;

      const res = await extractPackageFile(content, 'my_pkg.nimble');
      expect(res).not.toBeNull();
      expect(res?.deps).toHaveLength(6);

      // Main dep
      expect(res?.deps[0]).toMatchObject({
        depName: 'nim',
        depType: 'compiler',
      });

      // taskRequires "test", "chronos >= 4.2.2"
      expect(res?.deps[1]).toMatchObject({
        depName: 'chronos',
        packageName: 'https://github.com/status-im/nim-chronos',
        currentValue: '>= 4.2.2',
        depType: 'taskRequires',
        replaceString: 'chronos >= 4.2.2',
      });

      // taskRequires "bench", "criterion >= 0.2.0", "stew >= 0.1.0"
      expect(res?.deps[2]).toMatchObject({
        depName: 'criterion',
        packageName: 'https://github.com/cblp/nim-criterion.git',
        currentValue: '>= 0.2.0',
        depType: 'taskRequires',
        replaceString: 'criterion >= 0.2.0',
      });

      expect(res?.deps[3]).toMatchObject({
        depName: 'stew',
        packageName: 'https://github.com/status-im/nim-stew',
        currentValue: '>= 0.1.0',
        depType: 'taskRequires',
        replaceString: 'stew >= 0.1.0',
      });

      // taskRequires baretask, "chronos >= 4.2.0"
      expect(res?.deps[4]).toMatchObject({
        depName: 'chronos',
        packageName: 'https://github.com/status-im/nim-chronos',
        currentValue: '>= 4.2.0',
        depType: 'taskRequires',
        replaceString: 'chronos >= 4.2.0',
      });

      // Inside task block: taskRequires "test", "stew#head"
      expect(res?.deps[5]).toMatchObject({
        depName: 'stew',
        packageName: 'https://github.com/status-im/nim-stew',
        currentValue: '#head',
        depType: 'taskRequires',
        replaceString: 'stew#head',
      });
    });

    it('handles multiline taskRequires continuations and skips empty items', async () => {
      vi.mocked(registry.resolvePackageUrl).mockResolvedValue(undefined);

      const content = `
taskRequires "test",
  "chronos >= 4.2.2",
  "[testflags]",
  "stew >= 0.1.0"
      `;

      const res = await extractPackageFile(content, 'foo.nimble');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0]).toMatchObject({
        depName: 'chronos',
        currentValue: '>= 4.2.2',
        depType: 'taskRequires',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'stew',
        currentValue: '>= 0.1.0',
        depType: 'taskRequires',
      });
    });
  });
});
