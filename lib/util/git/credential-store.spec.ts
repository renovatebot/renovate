import os from 'node:os';
import { codeBlock } from 'common-tags';
import fs from 'fs-extra';
import type { SimpleGit } from 'simple-git';
import { mock } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import { logger } from '~test/util.ts';
import {
  enableGitCredentialStore,
  getGitCredentialStorePath,
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

    it('adds the store helper if it is not configured', async () => {
      gitMock.getConfig.mockResolvedValue({
        key,
        value: null,
        values: [],
        paths: [],
        scopes: new Map(),
      });

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
      expect(gitMock.addConfig).toHaveBeenCalledExactlyOnceWith(
        key,
        'store',
        true,
        'global',
      );
    });

    it('keeps other helpers and adds the store helper', async () => {
      gitMock.getConfig.mockResolvedValue({
        key,
        value: 'cache',
        values: ['cache'],
        paths: [],
        scopes: new Map(),
      });

      await enableGitCredentialStore('https://gitlab.example.com');

      expect(gitMock.addConfig).toHaveBeenCalledExactlyOnceWith(
        key,
        'store',
        true,
        'global',
      );
    });

    it('uses the origin of the URL', async () => {
      gitMock.getConfig.mockResolvedValue({
        key,
        value: null,
        values: [],
        paths: [],
        scopes: new Map(),
      });

      await enableGitCredentialStore('https://gitlab.example.com/api/v4/');

      expect(gitMock.addConfig).toHaveBeenCalledExactlyOnceWith(
        key,
        'store',
        true,
        'global',
      );
    });

    it('throws on invalid URLs', async () => {
      await expect(enableGitCredentialStore('not-a-url')).rejects.toThrow(
        'Invalid URL for the Git credential store: not-a-url',
      );
      expect(gitMock.getConfig).not.toHaveBeenCalled();
    });

    it('does nothing if the store helper is already configured', async () => {
      gitMock.getConfig.mockResolvedValue({
        key,
        value: 'store',
        values: ['cache', 'store'],
        paths: [],
        scopes: new Map(),
      });

      await enableGitCredentialStore('https://gitlab.example.com');

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
});
