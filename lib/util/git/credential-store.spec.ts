import os from 'node:os';
import { codeBlock } from 'common-tags';
import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import { mock } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import { logger } from '~test/util.ts';
import {
  getCredentialStoreConfig,
  setCredentialStoreConfig,
} from './config.ts';
import {
  enableGitCredentialStore,
  getGitCredentialStorePath,
  setupGitCredentialStore,
  updateGitCredentialStore,
} from './credential-store.ts';
import * as git from './index.ts';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures.ts')>(
      '~test/fixtures.ts',
    )
  ).fsExtra(),
);

const createSimpleGit = vi.mocked(git.createSimpleGit);

const homeDir = '/home/renovate';
const storePath = `${homeDir}/.git-credentials`;

describe('util/git/credential-store', () => {
  beforeEach(async () => {
    Fixtures.reset();
    await fs.ensureDir(homeDir);
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
  });

  function readStore(): unknown {
    return Fixtures.toJSON()[storePath];
  }

  describe('getGitCredentialStorePath()', () => {
    it('returns the store file in the home directory', () => {
      expect(getGitCredentialStorePath()).toBe(storePath);
    });
  });

  describe('enableGitCredentialStore()', () => {
    const key = 'credential.https://gitlab.example.com.helper';
    let gitMock: ReturnType<typeof mock<SimpleGit>>;

    beforeEach(() => {
      gitMock = mock<SimpleGit>();
      createSimpleGit.mockReturnValue(gitMock);
    });

    function mockHelpers(values: string[]): void {
      gitMock.getConfig.mockResolvedValue({
        key,
        value: values.at(-1) ?? null,
        values,
        paths: [],
        scopes: new Map(),
      });
    }

    function expectStoreOnlyHelpersAdded(): void {
      expect(gitMock.addConfig.mock.calls).toEqual([
        [key, '', true, 'global'],
        [key, 'store', true, 'global'],
      ]);
    }

    it('adds a helper reset and the store helper if nothing is configured', async () => {
      mockHelpers([]);

      await enableGitCredentialStore('https://gitlab.example.com');

      expect(createSimpleGit).toHaveBeenCalledExactlyOnceWith({
        config: {
          unsafe: expect.objectContaining({
            allowUnsafeCredentialHelper: true,
            allowUnsafeUrlRewrite: true,
          }),
        },
      });
      expect(gitMock.getConfig).toHaveBeenCalledWith(key, 'global');
      expect(gitMock.raw).not.toHaveBeenCalled();
      expectStoreOnlyHelpersAdded();
    });

    it.each`
      values
      ${['cache']}
      ${['store']}
      ${['cache', 'store']}
      ${['', 'store', 'cache']}
      ${['store', '']}
    `(
      'replaces the configured helpers $values',
      async ({ values }: { values: string[] }) => {
        mockHelpers(values);

        await enableGitCredentialStore('https://gitlab.example.com');

        expect(gitMock.raw).toHaveBeenCalledExactlyOnceWith([
          'config',
          '--global',
          '--unset-all',
          key,
        ]);
        expectStoreOnlyHelpersAdded();
      },
    );

    it('uses the origin of the URL', async () => {
      mockHelpers([]);

      await enableGitCredentialStore('https://gitlab.example.com/api/v4/');

      expect(gitMock.getConfig).toHaveBeenCalledWith(key, 'global');
      expectStoreOnlyHelpersAdded();
    });

    it('throws on invalid URLs', async () => {
      await expect(enableGitCredentialStore('not-a-url')).rejects.toThrow(
        'Invalid URL for the Git credential store: not-a-url',
      );
      expect(gitMock.getConfig).not.toHaveBeenCalled();
    });

    it('does nothing if only the store helper is already configured', async () => {
      mockHelpers(['', 'store']);

      await enableGitCredentialStore('https://gitlab.example.com');

      expect(gitMock.raw).not.toHaveBeenCalled();
      expect(gitMock.addConfig).not.toHaveBeenCalled();
    });
  });

  describe('updateGitCredentialStore()', () => {
    it('creates the store file if it does not exist', async () => {
      await updateGitCredentialStore(
        'https://gitlab.example.com',
        'oauth2',
        'some-token',
      );

      expect(readStore()).toBe(
        'https://oauth2:some-token@gitlab.example.com\n',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(storePath, expect.any(String), {
        encoding: 'utf8',
        mode: 0o600,
      });
    });

    it('appends the entry and keeps entries for other hosts', async () => {
      Fixtures.mock({
        [storePath]: codeBlock`
          https://user:pass@github.com

          http://oauth2:other-token@gitlab.example.com
          https://oauth2:other-token@gitlab.example.com:8443
          not a url
        `,
      });

      await updateGitCredentialStore(
        'https://gitlab.example.com',
        'oauth2',
        'some-token',
      );

      expect(readStore()).toBe(
        codeBlock`
          https://user:pass@github.com
          http://oauth2:other-token@gitlab.example.com
          https://oauth2:other-token@gitlab.example.com:8443
          not a url
          https://oauth2:some-token@gitlab.example.com
        `.concat('\n'),
      );
    });

    it('replaces outdated entries for the same host', async () => {
      Fixtures.mock({
        [storePath]: codeBlock`
          https://oauth2:old-token@gitlab.example.com
          https://user:pass@github.com
          https://someone:else@gitlab.example.com/
        `,
      });

      await updateGitCredentialStore(
        'https://gitlab.example.com',
        'oauth2',
        'new-token',
      );

      expect(readStore()).toBe(
        codeBlock`
          https://user:pass@github.com
          https://oauth2:new-token@gitlab.example.com
        `.concat('\n'),
      );
    });

    it('does not write the file if the entry is up to date', async () => {
      Fixtures.mock({
        [storePath]: codeBlock`
          https://user:pass@github.com
          https://oauth2:some-token@gitlab.example.com:8443
        `,
      });

      await updateGitCredentialStore(
        'https://gitlab.example.com:8443',
        'oauth2',
        'some-token',
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Git credential store at ${storePath} is up to date for https://gitlab.example.com:8443`,
      );
    });

    it('only stores the origin of the URL', async () => {
      await updateGitCredentialStore(
        'https://gitlab.example.com:8443/gitlab/api/v4/?foo=bar#baz',
        'oauth2',
        'some-token',
      );

      expect(readStore()).toBe(
        'https://oauth2:some-token@gitlab.example.com:8443\n',
      );
    });

    it('throws on invalid URLs', async () => {
      await expect(
        updateGitCredentialStore('not-a-url', 'oauth2', 'some-token'),
      ).rejects.toThrow('Invalid URL for the Git credential store: not-a-url');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('encodes special characters in the credentials', async () => {
      await updateGitCredentialStore(
        'https://gitlab.example.com',
        'oauth2',
        'to:ken@/#',
      );

      expect(readStore()).toBe(
        'https://oauth2:to%3Aken%40%2F%23@gitlab.example.com\n',
      );
    });

    it('throws if the store file cannot be written', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(
        new Error('EROFS: read-only file system'),
      );

      await expect(
        updateGitCredentialStore(
          'https://gitlab.example.com',
          'oauth2',
          'some-token',
        ),
      ).rejects.toThrow(
        `Cannot write the Git credential store file ${storePath}`,
      );
    });

    it('does not log the credentials', async () => {
      await updateGitCredentialStore(
        'https://gitlab.example.com',
        'oauth2',
        'some-token',
      );

      expect(JSON.stringify(logger.logger.debug.mock.calls)).not.toContain(
        'some-token',
      );
    });
  });

  describe('setupGitCredentialStore()', () => {
    let gitMock: ReturnType<typeof mock<SimpleGit>>;

    beforeEach(() => {
      setCredentialStoreConfig([]);
      gitMock = mock<SimpleGit>();
      gitMock.getConfig.mockResolvedValue({
        key: 'credential.https://gitlab.example.com:8443.helper',
        value: null,
        values: [],
        paths: [],
        scopes: new Map(),
      });
      createSimpleGit.mockReturnValue(gitMock);
    });

    it('enables the store, writes the credentials and makes the store the only credential source', async () => {
      await setupGitCredentialStore(
        'https://gitlab.example.com:8443/api/v4/',
        'oauth2',
        'some-token',
      );

      expect(gitMock.addConfig).toHaveBeenCalledTimes(2);
      expect(readStore()).toBe(
        'https://oauth2:some-token@gitlab.example.com:8443\n',
      );
      expect(getCredentialStoreConfig()).toEqual([
        { key: 'credential.https://gitlab.example.com:8443.helper', value: '' },
        {
          key: 'credential.https://gitlab.example.com:8443.helper',
          value: 'store',
        },
        {
          key: 'credential.https://gitlab.example.com:8443.username',
          value: 'oauth2',
        },
      ]);
    });

    it('does not change the Git config entries if the store cannot be written', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('EROFS'));

      await expect(
        setupGitCredentialStore(
          'https://gitlab.example.com:8443',
          'oauth2',
          'some-token',
        ),
      ).rejects.toThrow('Cannot write the Git credential store file');
      expect(getCredentialStoreConfig()).toEqual([]);
    });
  });
});
