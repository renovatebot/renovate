import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import { CONFIG_VALIDATION } from '../../constants/error-messages.ts';
import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import type { LfsState } from './lfs.ts';
import {
  LfsLsFiles,
  applyLfsConfig,
  chunk,
  findLfsConfigConflict,
  getGitLfsMode,
  getLfsAuthEndpoint,
  getLfsEndpoint,
  getLfsEndpointHost,
  getLfsForcedEnv,
  getLfsGitConfig,
  isGitLfsError,
  isLfsPointer,
  logWarningIfGitLfsPointer,
  mapGitLfsError,
  normalizeEndpointForCompare,
  parseGitLfsVersion,
  parseLfsPointer,
  sanitizeEnvForLfs,
  sanitizeLfsError,
  selectUploadOids,
  toGitLfsMode,
  validateGitLfsVersion,
} from './lfs.ts';
import {
  getLfsState,
  isGitLfsActive,
  newLfsState,
  setLfsState,
} from './lfs-state.ts';

const oid1 = 'a'.repeat(64);
const oid2 = 'b'.repeat(64);
const oid3 = 'c'.repeat(64);

const pointer = codeBlock`
  version https://git-lfs.github.com/spec/v1
  oid sha256:${oid1}
  size 12345
`;

function lfsState(state: Partial<LfsState>): LfsState {
  return {
    ...newLfsState(),
    active: true,
    endpoint: 'https://github.com/o/r.git/info/lfs',
    ...state,
  };
}

const skipEntries = [
  { key: 'filter.lfs.process', value: 'git-lfs filter-process --skip' },
  { key: 'filter.lfs.smudge', value: 'git-lfs smudge --skip -- %f' },
  { key: 'lfs.fetchinclude', value: '' },
  { key: 'lfs.fetchexclude', value: '*' },
];

describe('util/git/lfs', () => {
  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('lfs-state', () => {
    it('stores the state', () => {
      const state = lfsState({ mode: 'upload' });

      setLfsState(state);

      expect(getLfsState()).toBe(state);
      expect(isGitLfsActive()).toBeTrue();

      setLfsState(newLfsState());

      expect(isGitLfsActive()).toBeFalse();
      expect(getLfsState()).toEqual({
        mode: 'disabled',
        active: false,
        endpoint: null,
        authEndpoint: null,
        include: [],
        authenticated: false,
      });
    });
  });

  describe('getGitLfsMode()', () => {
    it('defaults to disabled', () => {
      expect(getGitLfsMode()).toBe('disabled');
    });

    it('returns the global config value', () => {
      GlobalConfig.set({ gitLfs: 'upload' });

      expect(getGitLfsMode()).toBe('upload');
    });

    it('treats an unknown value as disabled', () => {
      GlobalConfig.set({ gitLfs: 'yes' as never });

      expect(getGitLfsMode()).toBe('disabled');
    });
  });

  describe('toGitLfsMode()', () => {
    it.each`
      value         | expected
      ${'upload'}   | ${'upload'}
      ${'enabled'}  | ${'enabled'}
      ${'disabled'} | ${'disabled'}
      ${'true'}     | ${'disabled'}
      ${true}       | ${'disabled'}
      ${undefined}  | ${'disabled'}
    `('maps $value to $expected', ({ value, expected }) => {
      expect(toGitLfsMode(value)).toBe(expected);
    });
  });

  describe('getLfsEndpoint()', () => {
    it.each`
      remoteUrl                                        | expected
      ${'https://x-access-token:T@github.com/o/r.git'} | ${'https://github.com/o/r.git/info/lfs'}
      ${'https://github.com/o/r'}                      | ${'https://github.com/o/r.git/info/lfs'}
      ${'https://oauth2:T@gitlab.com/g/sub/r.git'}     | ${'https://gitlab.com/g/sub/r.git/info/lfs'}
      ${'https://dev.azure.com/org/p/_git/repo'}       | ${'https://dev.azure.com/org/p/_git/repo.git/info/lfs'}
      ${'https://h:8443/scm/p/r.git/'}                 | ${'https://h:8443/scm/p/r.git/info/lfs'}
      ${'https://GitHub.com/o/r.git?q=1#h'}            | ${'https://github.com/o/r.git/info/lfs'}
      ${'http://h/o/r.git'}                            | ${'http://h/o/r.git/info/lfs'}
      ${'file:///tmp/x/remote.git'}                    | ${'file:///tmp/x/remote.git'}
      ${'file:///tmp/x/remote.git/'}                   | ${'file:///tmp/x/remote.git'}
      ${'/tmp/x/remote.git'}                           | ${'file:///tmp/x/remote.git'}
      ${'git@github.com:o/r.git'}                      | ${null}
      ${'ssh://git@h/o/r.git'}                         | ${null}
      ${'git://h/o/r.git'}                             | ${null}
    `('$remoteUrl', ({ remoteUrl, expected }) => {
      expect(getLfsEndpoint(remoteUrl)).toBe(expected);
    });
  });

  describe('normalizeEndpointForCompare()', () => {
    const endpoint = 'https://github.com/o/r.git/info/lfs';

    it.each`
      value
      ${'https://github.com/o/r.git/info/lfs'}
      ${'https://user:pass@GITHUB.com/o/r.git/info/lfs/'}
      ${'https://github.com/o/r.git'}
      ${'https://token@github.com/o/r'}
    `('$value equals the endpoint', ({ value }) => {
      expect(normalizeEndpointForCompare(value)).toBe(endpoint);
    });

    it.each`
      value
      ${'https://evil.com/o/r.git/info/lfs'}
      ${'https://github.com/o/other.git/info/lfs'}
      ${'https://evil.com/o/r.git'}
    `('$value differs from the endpoint', ({ value }) => {
      expect(normalizeEndpointForCompare(value)).not.toBe(endpoint);
    });

    it('returns null for an invalid endpoint', () => {
      expect(normalizeEndpointForCompare('not a url/info/lfs')).toBeNull();
    });
  });

  describe('findLfsConfigConflict()', () => {
    const endpoint = 'https://github.com/o/r.git/info/lfs';

    it('returns null when all values match', () => {
      const output = codeBlock`
        lfs.url https://github.com/o/r.git/info/lfs
        remote.origin.lfsurl https://github.com/o/r.git
      `;

      expect(findLfsConfigConflict(`${output}\n`, endpoint)).toBeNull();
    });

    it('returns the host of a different server', () => {
      const output = codeBlock`
        lfs.url https://github.com/o/r.git/info/lfs
        lfs.pushurl https://user:pass@artifactory.example.com/api/lfs/r
      `;

      expect(findLfsConfigConflict(output, endpoint)).toBe(
        'artifactory.example.com',
      );
    });

    it('treats an unparsable value as a conflict', () => {
      expect(
        findLfsConfigConflict('lfs.url git@evil.com:o/r.git', endpoint),
      ).toBe('unknown');
    });
  });

  describe('getLfsAuthEndpoint()', () => {
    const endpoint = 'https://github.com/o/r.git/info/lfs';

    it.each`
      remoteUrl                                        | expected
      ${'https://x-access-token:T@github.com/o/r.git'} | ${'https://x-access-token:T@github.com/o/r.git/info/lfs'}
      ${'https://T@github.com/o/r.git'}                | ${'https://T:@github.com/o/r.git/info/lfs'}
      ${'https://u%40x:p%3Aw@github.com/o/r.git'}      | ${'https://u%40x:p%3Aw@github.com/o/r.git/info/lfs'}
      ${'https://github.com/o/r.git'}                  | ${endpoint}
      ${'http://T@github.com/o/r.git'}                 | ${endpoint}
      ${'git@github.com:o/r.git'}                      | ${endpoint}
    `('$remoteUrl -> $expected', ({ remoteUrl, expected }) => {
      expect(getLfsAuthEndpoint(remoteUrl, endpoint)).toBe(expected);
    });
  });

  describe('getLfsEndpointHost()', () => {
    it('returns the host', () => {
      expect(getLfsEndpointHost('https://github.com/o/r.git/info/lfs')).toBe(
        'github.com',
      );
    });

    it('returns unknown for an invalid URL', () => {
      expect(getLfsEndpointHost('invalid')).toBe('unknown');
    });
  });

  describe('getLfsGitConfig()', () => {
    const common = [
      { key: 'filter.lfs.clean', value: 'git-lfs clean -- %f' },
      { key: 'filter.lfs.required', value: 'true' },
      { key: 'core.hooksPath', value: '/dev/null' },
      { key: 'lfs.url', value: 'https://github.com/o/r.git/info/lfs' },
      { key: 'lfs.pushurl', value: 'https://github.com/o/r.git/info/lfs' },
      { key: 'lfs.locksverify', value: 'false' },
      { key: 'lfs.allowincompletepush', value: 'false' },
      { key: 'lfs.skipdownloaderrors', value: 'false' },
      { key: 'lfs.setlockablereadonly', value: 'false' },
    ];

    it('uses the skip variant with an empty include', () => {
      expect(getLfsGitConfig(lfsState({ mode: 'enabled' }))).toEqual([
        ...common,
        ...skipEntries,
      ]);
    });

    it('uses the skip variant in disabled mode', () => {
      expect(
        getLfsGitConfig(lfsState({ mode: 'disabled', include: ['x'] })),
      ).toEqual([...common, ...skipEntries]);
    });

    it('uses the skip variant in upload mode with an include', () => {
      expect(
        getLfsGitConfig(
          lfsState({ mode: 'upload', include: ['package-lock.json'] }),
        ),
      ).toEqual([...common, ...skipEntries]);
    });

    it('uses the selective variant in enabled mode with an include', () => {
      expect(
        getLfsGitConfig(
          lfsState({
            mode: 'enabled',
            include: ['package-lock.json', '.yarn/cache/**'],
          }),
        ),
      ).toEqual([
        ...common,
        { key: 'filter.lfs.process', value: 'git-lfs filter-process' },
        { key: 'filter.lfs.smudge', value: 'git-lfs smudge -- %f' },
        { key: 'lfs.fetchinclude', value: 'package-lock.json,.yarn/cache/**' },
        { key: 'lfs.fetchexclude', value: '' },
      ]);
    });

    it('never combines an empty fetchinclude with an empty fetchexclude', () => {
      const entries = getLfsGitConfig(
        lfsState({ mode: 'enabled', include: [] }),
      );

      expect(entries).toContainEqual({ key: 'lfs.fetchexclude', value: '*' });
      expect(entries).not.toContainEqual({
        key: 'lfs.fetchexclude',
        value: '',
      });
    });

    it('uses an empty endpoint when there is none', () => {
      expect(getLfsGitConfig(lfsState({ endpoint: null }))).toContainEqual({
        key: 'lfs.url',
        value: '',
      });
    });
  });

  describe('getLfsForcedEnv()', () => {
    it('skips smudge in the skip variant', () => {
      expect(getLfsForcedEnv(lfsState({ mode: 'upload' }))).toEqual({
        GIT_LFS_SKIP_PUSH: '1',
        GIT_LFS_SET_LOCKABLE_READONLY: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
      });
    });

    it('smudges in the selective variant', () => {
      expect(
        getLfsForcedEnv(lfsState({ mode: 'enabled', include: ['x'] })),
      ).toEqual({
        GIT_LFS_SKIP_PUSH: '1',
        GIT_LFS_SET_LOCKABLE_READONLY: '0',
        GIT_LFS_SKIP_SMUDGE: '0',
      });
    });
  });

  describe('sanitizeEnvForLfs()', () => {
    it('removes trace and LFS variables', () => {
      const env = {
        PATH: '/usr/bin',
        HOME: '/home/u',
        HTTPS_PROXY: 'http://proxy',
        GIT_CONFIG_PARAMETERS: "'lfs.pushurl'='file:///evil'",
        GIT_LFS_SKIP_DOWNLOAD_ERRORS: '1',
        GIT_LFS_PROGRESS: '/tmp/x',
        GIT_TRACE: '1',
        GIT_TRACE_CURL: '1',
        GIT_CURL_VERBOSE: '1',
        GIT_TRANSFER_TRACE: '1',
      };

      expect(sanitizeEnvForLfs(env, {}, {})).toEqual({
        PATH: '/usr/bin',
        HOME: '/home/u',
        HTTPS_PROXY: 'http://proxy',
      });
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('keeps admin GIT_CONFIG_* entries', () => {
      const env = {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.proxy',
        GIT_CONFIG_VALUE_0: 'http://proxy',
      };

      expect(sanitizeEnvForLfs(env, {}, env)).toEqual(env);
    });

    it('drops all GIT_CONFIG_* entries when the repository env has one', () => {
      const env = {
        PATH: '/usr/bin',
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: 'http.proxy',
        GIT_CONFIG_VALUE_0: 'http://proxy',
        GIT_CONFIG_KEY_1: 'lfs.pushurl',
        GIT_CONFIG_VALUE_1: 'file:///evil',
      };

      expect(
        sanitizeEnvForLfs(
          env,
          { GIT_CONFIG_KEY_1: 'lfs.pushurl' },
          { GIT_CONFIG_COUNT: '1' },
        ),
      ).toEqual({ PATH: '/usr/bin' });
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        'Ignoring GIT_CONFIG_* from repository env because gitLfs is enabled',
      );
    });

    it('replaces or removes config-locating variables from the repository env', () => {
      const env = {
        HOME: '/repo/home',
        GIT_CONFIG_GLOBAL: '/repo/evil.gitconfig',
        GIT_DIR: '/repo/.git',
        GIT_COMMON_DIR: 'evil',
        GIT_OBJECT_DIRECTORY: 'evil/objects',
        GIT_ALTERNATE_OBJECT_DIRECTORIES: 'evil/alternates',
      };

      expect(sanitizeEnvForLfs(env, env, { HOME: '/home/u' })).toEqual({
        HOME: '/home/u',
      });
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        {
          keys: [
            'GIT_CONFIG_GLOBAL',
            'HOME',
            'GIT_DIR',
            'GIT_COMMON_DIR',
            'GIT_OBJECT_DIRECTORY',
            'GIT_ALTERNATE_OBJECT_DIRECTORIES',
          ],
        },
        'Ignoring repository env variables that would change Git configuration because gitLfs is enabled',
      );
    });

    it('keeps an admin GIT_CONFIG_GLOBAL', () => {
      const env = { GIT_CONFIG_GLOBAL: '/admin/gitconfig' };

      expect(
        sanitizeEnvForLfs(env, {}, { GIT_CONFIG_GLOBAL: '/admin/gitconfig' }),
      ).toEqual(env);
    });

    it('does not modify the input', () => {
      const env = { GIT_TRACE: '1' };

      sanitizeEnvForLfs(env, {}, {});

      expect(env).toEqual({ GIT_TRACE: '1' });
    });
  });

  describe('applyLfsConfig()', () => {
    it('appends the LFS entries after existing ones', () => {
      const state = lfsState({ mode: 'upload' });
      const entries = getLfsGitConfig(state);

      const env = applyLfsConfig(
        {
          PATH: '/usr/bin',
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_0: 'a.b',
          GIT_CONFIG_VALUE_0: 'c',
          GIT_CONFIG_KEY_1: 'd.e',
          GIT_CONFIG_VALUE_1: 'f',
        },
        state,
      );

      expect(env).toMatchObject({
        PATH: '/usr/bin',
        GIT_CONFIG_KEY_0: 'a.b',
        GIT_CONFIG_KEY_1: 'd.e',
        GIT_CONFIG_KEY_2: 'filter.lfs.clean',
        GIT_CONFIG_VALUE_2: 'git-lfs clean -- %f',
        GIT_CONFIG_COUNT: `${2 + entries.length}`,
        GIT_LFS_SKIP_PUSH: '1',
        GIT_LFS_SET_LOCKABLE_READONLY: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
      });
      expect(env[`GIT_CONFIG_KEY_${1 + entries.length}`]).toBe(
        'lfs.fetchexclude',
      );
    });
  });

  describe('parseLfsPointer()', () => {
    it.each`
      name                       | content
      ${'canonical'}             | ${`${pointer}\n`}
      ${'CRLF'}                  | ${`${pointer.replaceAll('\n', '\r\n')}\r\n`}
      ${'missing final newline'} | ${pointer}
      ${'extension'}             | ${`version https://git-lfs.github.com/spec/v1\next-0-foo sha256:${oid2}\noid sha256:${oid1}\nsize 12345\n`}
      ${'Buffer'}                | ${Buffer.from(`${pointer}\n`)}
    `('parses a $name pointer', ({ content }) => {
      expect(parseLfsPointer(content)).toEqual({ oid: oid1, size: 12345 });
      expect(isLfsPointer(content)).toBeTrue();
    });

    it.each`
      name                     | content
      ${'uppercase oid'}       | ${pointer.replace(oid1, oid1.toUpperCase())}
      ${'short oid'}           | ${pointer.replace(oid1, 'a'.repeat(63))}
      ${'path oid'}            | ${pointer.replace(oid1, '../../etc/passwd')}
      ${'sha1 oid'}            | ${pointer.replace('sha256:', 'sha1:')}
      ${'leading zero size'}   | ${pointer.replace('12345', '01')}
      ${'17-digit size'}       | ${pointer.replace('12345', '1'.repeat(17))}
      ${'too large'}           | ${`${pointer}\n${'x'.repeat(1024)}`}
      ${'too large Buffer'}    | ${Buffer.alloc(1025)}
      ${'wrong version'}       | ${pointer.replace('spec/v1', 'spec/v2')}
      ${'version prefix only'} | ${pointer.replace('spec/v1', 'spec/v1x')}
      ${'JSON file'}           | ${`{"x": "oid sha256:${oid1}"}`}
      ${'missing size'}        | ${`version https://git-lfs.github.com/spec/v1\noid sha256:${oid1}\n`}
      ${'two oids'}            | ${`${pointer}\noid sha256:${oid2}\n`}
      ${'unknown line'}        | ${`${pointer}\nfoo bar\n`}
    `('rejects $name', ({ content }) => {
      expect(parseLfsPointer(content)).toBeNull();
      expect(isLfsPointer(content)).toBeFalse();
    });
  });

  describe('logWarningIfGitLfsPointer()', () => {
    it('does not warn for regular content', () => {
      logWarningIfGitLfsPointer('a.json', '{}', 'disabled', false);

      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it.each`
      mode          | active
      ${'disabled'} | ${false}
      ${'upload'}   | ${true}
      ${'enabled'}  | ${false}
    `('points to the docs in mode $mode active=$active', ({ mode, active }) => {
      logWarningIfGitLfsPointer('a.bin', pointer, mode, active);

      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { fileName: 'a.bin' },
        'File is stored in Git LFS and Renovate read its LFS pointer instead of the content. See the `gitLfs` documentation.',
      );
    });

    it('suggests gitLfsInclude when enabled', () => {
      logWarningIfGitLfsPointer(
        'package-lock.json',
        Buffer.from(pointer),
        'enabled',
        true,
      );

      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { fileName: 'package-lock.json' },
        'File is stored in Git LFS and Renovate read its LFS pointer instead of the content. Add it to `gitLfsInclude` so Renovate downloads it.',
      );
    });
  });

  describe('LfsLsFiles and selectUploadOids()', () => {
    it('selects downloaded objects', () => {
      const output = JSON.stringify({
        files: [
          {
            name: 'new.bin',
            size: 3000,
            checkout: true,
            downloaded: true,
            oid_type: 'sha256',
            oid: oid1,
            version: 'https://git-lfs.github.com/spec/v1',
          },
          { name: 'copy.bin', size: 3000, downloaded: true, oid: oid1 },
          { name: 'lock.json', size: 20, downloaded: true, oid: oid2 },
          { name: 'remote.bin', size: 99, downloaded: false, oid: oid3 },
          { name: 'bad.bin', size: 1, downloaded: true, oid: 'xyz' },
        ],
      });

      const files = LfsLsFiles.parse(output);

      expect(files).toHaveLength(5);
      expect(selectUploadOids(files)).toEqual({
        oids: [oid1, oid2],
        skipped: ['remote.bin', 'bad.bin'],
        bytes: 3020,
      });
    });

    it.each`
      output
      ${'{"files":null}'}
      ${'{}'}
      ${'not json'}
      ${'{"files":[{"name":"a.bin"}]}'}
    `('returns no files for $output', ({ output }) => {
      expect(LfsLsFiles.parse(output)).toEqual([]);
    });

    it('selects nothing from an empty list', () => {
      expect(selectUploadOids([])).toEqual({ oids: [], skipped: [], bytes: 0 });
    });
  });

  describe('chunk()', () => {
    it.each`
      count  | sizes
      ${0}   | ${[]}
      ${100} | ${[100]}
      ${101} | ${[100, 1]}
      ${250} | ${[100, 100, 50]}
    `('splits $count items', ({ count, sizes }) => {
      const items = Array.from({ length: count }, (_, i) => i);

      const result = chunk(items);

      expect(result.map((c) => c.length)).toEqual(sizes);
      expect(result.flat()).toEqual(items);
    });

    it('supports a custom size', () => {
      expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    });
  });

  describe('sanitizeLfsError()', () => {
    it('redacts credentials', () => {
      const err = new Error(codeBlock`
        batch request: https://x-access-token:SECRET@github.com/o/r.git/info/lfs
        warning: current Git remote contains credentials
        error: failed to push some refs
      `);

      const result = sanitizeLfsError(err);

      expect(result.message).toBe(codeBlock`
        batch request: https://***@github.com/o/r.git/info/lfs
        error: failed to push some refs
      `);
      expect(result.cause).toBe(err);
    });
  });

  describe('parseGitLfsVersion()', () => {
    it.each`
      output                                                 | expected
      ${'git-lfs/3.8.0 (GitHub; darwin arm64; go 1.24.4)\n'} | ${'3.8.0'}
      ${'git-lfs/3.4.1 (GitHub; linux amd64; go 1.21.1)'}    | ${'3.4.1'}
      ${'garbage'}                                           | ${null}
    `('$output', ({ output, expected }) => {
      expect(parseGitLfsVersion(output)).toBe(expected);
    });
  });

  describe('validateGitLfsVersion()', () => {
    it.each`
      version    | mode         | ok
      ${'3.8.0'} | ${'upload'}  | ${true}
      ${'3.8.0'} | ${'enabled'} | ${true}
      ${'3.4.1'} | ${'upload'}  | ${true}
      ${'3.4.1'} | ${'enabled'} | ${false}
      ${'3.7.1'} | ${'enabled'} | ${true}
      ${'3.1.0'} | ${'upload'}  | ${false}
      ${'3.1.0'} | ${'enabled'} | ${false}
    `('$version in $mode mode', async ({ version, mode, ok }) => {
      const rawFn = vi
        .fn()
        .mockResolvedValue(`git-lfs/${version} (GitHub; linux amd64; go 1.24)`);

      await expect(validateGitLfsVersion(mode, rawFn)).resolves.toEqual({
        ok,
        version,
      });
      expect(rawFn).toHaveBeenCalledWith(['lfs', 'version']);
    });

    it('fails when git-lfs is missing', async () => {
      const rawFn = vi
        .fn()
        .mockRejectedValue(new Error("git: 'lfs' is not a git command"));

      await expect(validateGitLfsVersion('upload', rawFn)).resolves.toEqual({
        ok: false,
        version: null,
      });
    });

    it('fails on garbage output', async () => {
      const rawFn = vi.fn().mockResolvedValue('garbage');

      await expect(validateGitLfsVersion('upload', rawFn)).resolves.toEqual({
        ok: false,
        version: null,
      });
    });
  });

  describe('mapGitLfsError()', () => {
    it('returns platform failures', () => {
      vi.stubEnv('NODE_ENV', 'production');

      const result = mapGitLfsError(
        new Error('fatal: Could not resolve host: github.com'),
        'upload',
      );

      expect(result).toBeInstanceOf(ExternalHostError);
      expect(isGitLfsError(result)).toBeTrue();
      vi.unstubAllEnvs();
    });

    it('maps download errors to a config validation error', () => {
      const result = mapGitLfsError(
        new Error(
          '\nError downloading object: `a.bin` from https://u:p@github.com/o/r\nmore',
        ),
        'download',
      );

      expect(result).toMatchObject({
        message: CONFIG_VALIDATION,
        validationSource: 'gitLfsInclude',
        validationError: 'Git LFS download failed',
        validationMessage:
          "Renovate could not download Git LFS content for paths matching `gitLfsInclude`: `Error downloading object: 'a.bin' from https://***@github.com/o/r`",
      });
      expect(isGitLfsError(result)).toBeTrue();
    });

    it('handles empty download errors', () => {
      expect(mapGitLfsError(new Error(''), 'download')).toMatchObject({
        validationMessage:
          'Renovate could not download Git LFS content for paths matching `gitLfsInclude`: ``',
      });
    });

    it('maps upload errors', () => {
      const result = mapGitLfsError(
        new Error('push to https://x:SECRET@github.com/o/r failed'),
        'upload',
      );

      expect(result.message).toBe(
        'git-lfs push failed: push to https://***@github.com/o/r failed',
      );
      expect(isGitLfsError(result)).toBeTrue();
    });

    it('does not mark other errors', () => {
      expect(isGitLfsError(new Error('git-lfs push failed: x'))).toBeFalse();
      expect(isGitLfsError('git-lfs push failed: x')).toBeFalse();
    });
  });
});
