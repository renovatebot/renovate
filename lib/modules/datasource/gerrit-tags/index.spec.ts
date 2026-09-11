import * as httpMock from '~test/http-mock.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { GerritTagsDatasource } from './index.ts';

const datasource = GerritTagsDatasource.id;
const registryUrl = 'https://gerrit.example.com';

describe('modules/datasource/gerrit-tags/index', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('getReleases', () => {
    it('returns tags from a public gerrit instance (no /a/ prefix)', async () => {
      const body = [
        {
          ref: 'refs/tags/v1.0.0',
          revision: 'abc123abc123abc123abc123abc123abc123abc1',
          created: '2020-01-01 12:00:00.000000000',
        },
        {
          ref: 'refs/tags/v2.0.0',
          revision: 'aaa111aaa111aaa111aaa111aaa111aaa111aaa1',
          object: 'bbb222bbb222bbb222bbb222bbb222bbb222bbb2',
          message: 'Annotated tag',
          created: '2021-06-15 08:30:00.000000000',
        },
      ];
      httpMock
        .scope(registryUrl)
        .get('/projects/my%2Fproject/tags/')
        .reply(200, gerritBody(body));
      const res = await getPkgReleases({
        datasource,
        registryUrls: [registryUrl],
        packageName: 'my/project',
      });
      expect(res).toEqual({
        registryUrl,
        sourceUrl: `${registryUrl}/my/project`,
        releases: [
          {
            gitRef: 'v1.0.0',
            newDigest: 'abc123abc123abc123abc123abc123abc123abc1',
            version: 'v1.0.0',
            releaseTimestamp: '2020-01-01T12:00:00.000Z',
          },
          {
            gitRef: 'v2.0.0',
            newDigest: 'bbb222bbb222bbb222bbb222bbb222bbb222bbb2',
            version: 'v2.0.0',
            releaseTimestamp: '2021-06-15T08:30:00.000Z',
          },
        ],
      });
    });

    it('uses the /a/ prefix when hostRules provide credentials', async () => {
      hostRules.add({
        hostType: 'gerrit',
        matchHost: 'gerrit.example.com',
        username: 'user',
        password: 'pass',
      });
      httpMock
        .scope(registryUrl, {
          reqheaders: { authorization: 'Basic dXNlcjpwYXNz' },
        })
        .get('/a/projects/my%2Fproject/tags/')
        .reply(
          200,
          gerritBody([
            {
              ref: 'refs/tags/v1.0.0',
              revision: 'abc123abc123abc123abc123abc123abc123abc1',
            },
          ]),
        );
      const res = await getPkgReleases({
        datasource,
        registryUrls: [registryUrl],
        packageName: 'my/project',
      });
      expect(res?.releases).toEqual([
        {
          gitRef: 'v1.0.0',
          newDigest: 'abc123abc123abc123abc123abc123abc123abc1',
          version: 'v1.0.0',
        },
      ]);
    });

    it('returns null when registryUrl is missing', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: 'my/project',
      });
      expect(res).toBeNull();
    });
  });

  describe('getDigest', () => {
    it('returns the HEAD revision', async () => {
      httpMock
        .scope(registryUrl)
        .get('/projects/my%2Fproject/branches/HEAD')
        .reply(
          200,
          gerritBody({
            ref: 'refs/heads/main',
            revision: 'head123head123head123head123head123head12',
          }),
        );
      const res = await getDigest({
        datasource,
        registryUrls: [registryUrl],
        packageName: 'my/project',
      });
      expect(res).toBe('head123head123head123head123head123head12');
    });

    it('returns the commit hash for a lightweight tag', async () => {
      httpMock
        .scope(registryUrl)
        .get('/projects/my%2Fproject/tags/v1.0.0')
        .reply(
          200,
          gerritBody({
            ref: 'refs/tags/v1.0.0',
            revision: 'abc123abc123abc123abc123abc123abc123abc1',
          }),
        );
      const res = await getDigest(
        {
          datasource,
          registryUrls: [registryUrl],
          packageName: 'my/project',
        },
        'v1.0.0',
      );
      expect(res).toBe('abc123abc123abc123abc123abc123abc123abc1');
    });

    it('returns the object hash for an annotated tag', async () => {
      httpMock
        .scope(registryUrl)
        .get('/projects/my%2Fproject/tags/v2.0.0')
        .reply(
          200,
          gerritBody({
            ref: 'refs/tags/v2.0.0',
            revision: 'aaa111aaa111aaa111aaa111aaa111aaa111aaa1',
            object: 'bbb222bbb222bbb222bbb222bbb222bbb222bbb2',
          }),
        );
      const res = await getDigest(
        {
          datasource,
          registryUrls: [registryUrl],
          packageName: 'my/project',
        },
        'v2.0.0',
      );
      expect(res).toBe('bbb222bbb222bbb222bbb222bbb222bbb222bbb2');
    });

    it('uses the /a/ prefix when credentials are configured', async () => {
      hostRules.add({
        hostType: 'gerrit-tags',
        matchHost: 'gerrit.example.com',
        username: 'user',
        password: 'pass',
      });
      httpMock
        .scope(registryUrl)
        .get('/a/projects/my%2Fproject/branches/HEAD')
        .reply(
          200,
          gerritBody({
            ref: 'refs/heads/main',
            revision: 'head123head123head123head123head123head12',
          }),
        );
      const res = await getDigest({
        datasource,
        registryUrls: [registryUrl],
        packageName: 'my/project',
      });
      expect(res).toBe('head123head123head123head123head123head12');
    });

    it('returns null when registryUrl is missing', async () => {
      const res = await getDigest({
        datasource,
        packageName: 'my/project',
      });
      expect(res).toBeNull();
    });
  });
});

function gerritBody(body: unknown): string {
  return `)]}'\n${JSON.stringify(body)}`;
}
