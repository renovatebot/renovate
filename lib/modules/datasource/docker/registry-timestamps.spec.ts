import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { getPkgReleases } from '../index.ts';
import { DockerDatasource } from './index.ts';
import {
  addRegistryTimestamps,
  getRegistryType,
} from './registry-timestamps.ts';

const registryHost = 'https://registry.example.com';
const gitlabApiUrl = 'https://gitlab.example.com/api/v4';
const repositoriesPath =
  '/api/v4/projects/group%2Fapp/registry/repositories?per_page=100';

function tagsPage(nodes: { name: string; publishedAt: string }[]) {
  return {
    data: {
      containerRepository: {
        tags: { pageInfo: { hasNextPage: false, endCursor: null }, nodes },
      },
    },
  };
}

describe('modules/datasource/docker/registry-timestamps', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('getRegistryType', () => {
    it('reads registryType and registryApiUrl from a matching host rule', () => {
      hostRules.add({
        matchHost: 'registry.example.com',
        registryType: 'gitlab',
        registryApiUrl: gitlabApiUrl,
      });

      expect(getRegistryType(registryHost)).toEqual({
        registryType: 'gitlab',
        registryApiUrl: gitlabApiUrl,
      });
    });

    it('detects registry.gitlab.com without a host rule', () => {
      expect(getRegistryType('https://registry.gitlab.com')).toEqual({
        registryType: 'gitlab',
      });
    });

    it('returns null for unknown registries', () => {
      expect(getRegistryType(registryHost)).toBeNull();
    });
  });

  describe('addRegistryTimestamps', () => {
    it('returns releases unchanged for unknown registries', async () => {
      const releases = [{ version: '1.0.0' }];

      const res = await addRegistryTimestamps(registryHost, 'app', releases);

      expect(res).toBe(releases);
    });

    it('adds timestamps to releases the registry reports', async () => {
      hostRules.add({
        matchHost: 'registry.example.com',
        registryType: 'gitlab',
        registryApiUrl: gitlabApiUrl,
      });
      httpMock
        .scope('https://gitlab.example.com')
        .get(repositoriesPath)
        .reply(200, [{ id: 1, path: 'group/app' }])
        .post('/api/graphql')
        .reply(
          200,
          tagsPage([{ name: '1.0.0', publishedAt: '2026-01-01T00:00:00Z' }]),
        );

      const res = await addRegistryTimestamps(registryHost, 'group/app', [
        { version: '1.0.0' },
        { version: '2.0.0' },
      ]);

      expect(res).toEqual([
        { version: '1.0.0', releaseTimestamp: '2026-01-01T00:00:00.000Z' },
        { version: '2.0.0' },
      ]);
    });

    it.each`
      status | body
      ${500} | ${''}
      ${429} | ${'Rate limit exceeded'}
    `(
      'returns releases unchanged when the registry API replies $status',
      async ({ status, body }: { status: number; body: string }) => {
        hostRules.add({
          matchHost: 'registry.example.com',
          registryType: 'gitlab',
          registryApiUrl: gitlabApiUrl,
        });
        httpMock
          .scope('https://gitlab.example.com')
          .get(repositoriesPath)
          .reply(200, [{ id: 1, path: 'group/app' }])
          .post('/api/graphql')
          .reply(status, body);
        const releases = [{ version: '1.0.0' }];

        const res = await addRegistryTimestamps(
          registryHost,
          'group/app',
          releases,
        );

        expect(res).toBe(releases);
      },
    );
  });

  it('sets release timestamps in getReleases for a registryType host', async () => {
    vi.stubEnv('RENOVATE_X_DOCKER_HUB_DISABLE_LABEL_LOOKUP', 'true');
    hostRules.add({
      matchHost: 'registry.example.com',
      registryType: 'gitlab',
      registryApiUrl: gitlabApiUrl,
    });
    hostRules.add({
      matchHost: 'gitlab.example.com',
      hostType: 'gitlab',
      token: 'gitlab-token',
    });
    httpMock
      .scope(registryHost)
      .get('/v2/group/app/tags/list?n=10000')
      .reply(200)
      .get('/v2/group/app/tags/list?n=10000')
      .reply(200, { tags: ['1.0.0', '2.0.0'] })
      .get('/v2/')
      .reply(200)
      .get('/v2/group/app/manifests/2.0.0')
      .reply(404);
    httpMock
      .scope('https://gitlab.example.com', {
        reqheaders: { authorization: 'Bearer gitlab-token' },
      })
      .get(repositoriesPath)
      .reply(200, [{ id: 1, path: 'group/app' }])
      .post('/api/graphql')
      .reply(
        200,
        tagsPage([{ name: '2.0.0', publishedAt: '2026-02-01T00:00:00Z' }]),
      );

    const res = await getPkgReleases({
      datasource: DockerDatasource.id,
      packageName: 'registry.example.com/group/app',
    });

    expect(res?.releases).toEqual([
      { version: '1.0.0' },
      { version: '2.0.0', releaseTimestamp: '2026-02-01T00:00:00.000Z' },
    ]);
  });
});
