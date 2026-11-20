import { dir as tmpDir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../config/global.ts';
import * as packageCache from '../cache/package/index.ts';
import * as hostRules from '../host-rules.ts';
import { isRepositoryArchived } from './repository.ts';

describe('util/github/repository', () => {
  describe('isRepositoryArchived', () => {
    const githubApi = 'https://api.github.com';
    const sourceUrl = 'https://github.com/owner/repo';

    let cacheDir: Awaited<ReturnType<typeof tmpDir>>;

    beforeEach(async () => {
      cacheDir = await tmpDir({ unsafeCleanup: true });
      await packageCache.init({ cacheDir: cacheDir.path });
      hostRules.add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'some-token',
      });
    });

    afterEach(async () => {
      GlobalConfig.reset();
      await packageCache.cleanup({});
      await cacheDir.cleanup();
    });

    it.each`
      description                          | url
      ${'a URL that names no repository'}  | ${'https://github.com/owner'}
      ${'a host merely named like GitHub'} | ${'https://github.attacker.example/owner/repo'}
    `(
      'returns null without calling GitHub for $description',
      async ({ url }) => {
        hostRules.add({ hostType: 'github', token: 'catch-all-token' });

        await expect(isRepositoryArchived(url)).resolves.toBeNull();
      },
    );

    it('asks the GitHub Enterprise host Renovate runs on', async () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://github.example.com/api/v3/',
      });
      hostRules.add({
        hostType: 'github',
        matchHost: 'github.example.com',
        token: 'ghes-token',
      });
      httpMock
        .scope('https://github.example.com/api/v3')
        .get('/repos/owner/repo')
        .reply(200, { archived: true, private: false });

      await expect(
        isRepositoryArchived('https://github.example.com/owner/repo'),
      ).resolves.toBeTrue();
    });

    it('does not call GitHub without a token', async () => {
      hostRules.clear();

      await expect(isRepositoryArchived(sourceUrl)).resolves.toBeNull();
    });

    it.each`
      visibility                              | isPrivate | cachePrivatePackages | requests | expected
      ${'public'}                             | ${false}  | ${false}             | ${1}     | ${true}
      ${'private'}                            | ${true}   | ${false}             | ${2}     | ${null}
      ${'private, with cachePrivatePackages'} | ${true}   | ${true}              | ${2}     | ${null}
    `(
      'returns $expected and asks GitHub $requests time(s) for two checks of a $visibility repository',
      async ({ isPrivate, cachePrivatePackages, requests, expected }) => {
        GlobalConfig.set({ cachePrivatePackages });
        httpMock
          .scope(githubApi)
          .get('/repos/owner/repo')
          .times(requests)
          .reply(200, { archived: true, private: isPrivate });

        await expect(isRepositoryArchived(sourceUrl)).resolves.toBe(expected);
        await expect(isRepositoryArchived(sourceUrl)).resolves.toBe(expected);
      },
    );

    it.each`
      description                     | status | body                                   | expected
      ${'an active repository'}       | ${200} | ${{ archived: false, private: false }} | ${false}
      ${'a missing repository'}       | ${404} | ${{}}                                  | ${null}
      ${'a response without private'} | ${200} | ${{ archived: true }}                  | ${null}
    `(
      'returns $expected for $description',
      async ({ status, body, expected }) => {
        httpMock.scope(githubApi).get('/repos/owner/repo').reply(status, body);

        await expect(isRepositoryArchived(sourceUrl)).resolves.toBe(expected);
      },
    );
  });
});
