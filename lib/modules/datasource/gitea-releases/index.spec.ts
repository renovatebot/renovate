import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { GiteaReleasesDatasource } from '.';

const datasource = GiteaReleasesDatasource.id;

describe('modules/datasource/gitea-releases/index', () => {
  describe('getReleases', () => {
    it('returns tags from gitea.com', async () => {
      const body = [
        {
          id: 266974,
          tag_name: 'v9.2.1',
          target_commitish: 'main',
          name: 'v9.2.1',
          body: 'Fix a helm template check preventing from scaling up to more than one replica (#488)',
          url: 'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/266974',
          html_url: 'https://gitea.com/gitea/helm-chart/releases/tag/v9.2.1',
          tarball_url:
            'https://gitea.com/gitea/helm-chart/archive/v9.2.1.tar.gz',
          zipball_url: 'https://gitea.com/gitea/helm-chart/archive/v9.2.1.zip',
          upload_url:
            'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/266974/assets',
          draft: false,
          prerelease: false,
          created_at: '2023-08-27T12:56:50Z',
          published_at: '2023-08-27T12:56:50Z',
        },
        {
          id: 265923,
          tag_name: 'v9.2.0',
          target_commitish: 'main',
          name: 'v9.2.0',
          body: 'Bump to Gitea 1.20.3\r\n\r\nFull changes found here: https://gitea.com/gitea/helm-chart/compare/v9.1.0...v9.2.0',
          url: 'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/265923',
          html_url: 'https://gitea.com/gitea/helm-chart/releases/tag/v9.2.0',
          tarball_url:
            'https://gitea.com/gitea/helm-chart/archive/v9.2.0.tar.gz',
          zipball_url: 'https://gitea.com/gitea/helm-chart/archive/v9.2.0.zip',
          upload_url:
            'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/265923/assets',
          draft: false,
          prerelease: false,
          created_at: '2023-08-21T16:27:30Z',
          published_at: '2023-08-21T16:27:30Z',
        },
        {
          id: 263748,
          tag_name: 'v9.1.0',
          target_commitish: 'main',
          name: 'v9.1.0',
          body: 'Bump to Gitea 1.20.2',
          url: 'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/263748',
          html_url: 'https://gitea.com/gitea/helm-chart/releases/tag/v9.1.0',
          tarball_url:
            'https://gitea.com/gitea/helm-chart/archive/v9.1.0.tar.gz',
          zipball_url: 'https://gitea.com/gitea/helm-chart/archive/v9.1.0.zip',
          upload_url:
            'https://gitea.com/api/v1/repos/gitea/helm-chart/releases/263748/assets',
          draft: false,
          prerelease: false,
          created_at: '2023-07-31T07:04:49Z',
          published_at: '2023-07-31T07:04:49Z',
        },
      ];
      httpMock
        .scope('https://gitea.com')
        .get('/api/v1/repos/gitea/helm-chart/releases?draft=false')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'gitea/helm-chart',
      });
      expect(res).toEqual({
        registryUrl: 'https://gitea.com',
        releases: [
          {
            gitRef: 'v9.1.0',
            isStable: true,
            releaseTimestamp: '2023-07-31T07:04:49.000Z',
            version: 'v9.1.0',
          },
          {
            gitRef: 'v9.2.0',
            isStable: true,
            releaseTimestamp: '2023-08-21T16:27:30.000Z',
            version: 'v9.2.0',
          },
          {
            gitRef: 'v9.2.1',
            isStable: true,
            releaseTimestamp: '2023-08-27T12:56:50.000Z',
            version: 'v9.2.1',
          },
        ],
        sourceUrl: 'https://gitea.com/gitea/helm-chart',
      });
    });

    it('returns tags from codeberg.org', async () => {
      const body = [
        {
          id: 1585652,
          tag_name: '0.11.0',
          target_commitish: 'main',
          name: '0.11.0',
          body: '### ⚠ BREAKING CHANGES\r\n\r\n* **deps:** Forgejo breaking changes in [`v1.20.3-0`](https://codeberg.org/forgejo/forgejo/src/branch/forgejo/RELEASE-NOTES.md#1-20-3-0)\r\n\r\n### Bug Fixes\r\n\r\n* **deps:** update forgejo docker tag to v1.20.3-0 ([#178](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/178)) ([523395a](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/523395a08688f13e301af60c4cba2b22a2baee10))\r\n* **deps:** update helm release memcached to v6.5.7 ([f1ce20e](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/f1ce20e593655fcd6c72393eaf8d47b2c199e996))\r\n* **deps:** update helm release memcached to v6.5.8 ([c2e51de](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/c2e51defc01122aa2d6684d8707b159015257f50))\r\n* **deps:** update helm release memcached to v6.5.9 ([0fbb232](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/0fbb2329f872e77e89d711ff1a95a250d87e5707))\r\n* **deps:** update helm release memcached to v6.6.0 ([#180](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/180)) ([f19d22c](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/f19d22c6643b4643c4b2e96482b07527c84d2106))\r\n* **deps:** update helm release postgresql to v12.9.0 ([#174](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/174)) ([7eb7edc](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/7eb7edcfd00ffab9dddbae9e9b2deace305c9a84))\r\n\r\n\r\n### Continuous Integration\r\n\r\n* **deps:** update alpine docker tag to v3.18.3 ([4a3717e](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/4a3717e12b65289a6d957e3a9c8921111c4f9013))\r\n\r\n',
          url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/releases/1585652',
          html_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/tag/0.11.0',
          tarball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/0.11.0.tar.gz',
          zipball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/0.11.0.zip',
          draft: false,
          prerelease: false,
          created_at: '2023-08-25T08:27:19Z',
          published_at: '2023-08-25T08:27:19Z',
          assets: [
            {
              id: 55122,
              name: 'forgejo-0.11.0.tgz',
              size: 644676,
              download_count: 0,
              created_at: '2023-08-25T08:27:56Z',
              uuid: '49cc9743-6647-49a8-b27f-d292bd2956a4',
              browser_download_url:
                'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/download/0.11.0/forgejo-0.11.0.tgz',
            },
          ],
        },
        {
          id: 1549992,
          tag_name: 'v0.10.1',
          target_commitish: 'main',
          name: '0.10.1',
          body: '\n\n### Bug Fixes\n\n* **deps:** update forgejo docker tag to v1.20.2-0 ([#171](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/171)) ([ecd9b53](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/ecd9b535a128d4e6d643fde37bb05cd751b8d9f4))\n\n\n### Miscellaneous Chores\n\n* **deps:** update dependency @bitnami/readme-generator-for-helm to v2.5.1 ([b6a58fd](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/b6a58fd997ef8da358cbff3394cb755c548405fb))\n\n\n### Continuous Integration\n\n* **deps:** update dependency helm-unittest to v0.3.4 ([#173](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/173)) ([dedab02](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/dedab02cab1be0f9c5ad8218a4e89622e0c603bf))\n\n',
          url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/releases/1549992',
          html_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/tag/v0.10.1',
          tarball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/v0.10.1.tar.gz',
          zipball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/v0.10.1.zip',
          draft: false,
          prerelease: false,
          created_at: '2023-08-02T20:31:19Z',
          published_at: '2023-08-02T20:31:19Z',
          assets: [
            {
              id: 49902,
              name: 'forgejo-0.10.1.tgz',
              size: 637452,
              download_count: 3,
              created_at: '2023-08-02T20:33:45Z',
              uuid: '625ce014-0186-442a-94a6-6897ecbc8146',
              browser_download_url:
                'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/download/v0.10.1/forgejo-0.10.1.tgz',
            },
          ],
        },
        {
          id: 1533110,
          tag_name: 'v0.10.0',
          target_commitish: 'main',
          name: '0.10.0',
          body: '\r\n### ⚠ BREAKING CHANGES\r\n\r\n* **deps:** Forgejo minor update\r\n\r\n### Features\r\n\r\n* **deps:** update forgejo docker tag to v1.20.1-0 ([#167](https://codeberg.org/forgejo-contrib/forgejo-helm/issues/167)) ([5677cf3](https://codeberg.org/forgejo-contrib/forgejo-helm/commit/5677cf39d4818da26931783a3438a660ae5f427d))\r\n\r\n',
          url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/releases/1533110',
          html_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/tag/v0.10.0',
          tarball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/v0.10.0.tar.gz',
          zipball_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/archive/v0.10.0.zip',
          draft: false,
          prerelease: false,
          created_at: '2023-07-27T06:19:02Z',
          published_at: '2023-07-27T06:19:02Z',
          assets: [
            {
              id: 49376,
              name: 'forgejo-0.10.0.tgz',
              size: 635784,
              download_count: 1,
              created_at: '2023-07-27T06:19:51Z',
              uuid: '6aa68976-8510-4657-b144-74023e74f06c',
              browser_download_url:
                'https://codeberg.org/forgejo-contrib/forgejo-helm/releases/download/v0.10.0/forgejo-0.10.0.tgz',
            },
          ],
        },
      ];
      httpMock
        .scope('https://codeberg.org')
        .get('/api/v1/repos/forgejo-contrib/forgejo-helm/releases?draft=false')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://codeberg.org'],
        packageName: 'forgejo-contrib/forgejo-helm',
      });
      expect(res).toEqual({
        registryUrl: 'https://codeberg.org',
        releases: [
          {
            gitRef: 'v0.10.0',
            isStable: true,
            releaseTimestamp: '2023-07-27T06:19:02.000Z',
            version: 'v0.10.0',
          },
          {
            gitRef: 'v0.10.1',
            isStable: true,
            releaseTimestamp: '2023-08-02T20:31:19.000Z',
            version: 'v0.10.1',
          },
          {
            gitRef: '0.11.0',
            isStable: true,
            releaseTimestamp: '2023-08-25T08:27:19.000Z',
            version: '0.11.0',
          },
        ],
        sourceUrl: 'https://codeberg.org/forgejo-contrib/forgejo-helm',
      });
    });
  });

  describe('getDigest', () => {
    it('returns commits from codeberg.org', async () => {
      const body = [
        {
          url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/git/commits/7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
          sha: '7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
          created: '2023-08-25T08:26:28Z',
          html_url:
            'https://codeberg.org/forgejo-contrib/forgejo-helm/commit/7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
          commit: {
            url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/git/commits/7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
            message:
              'fix(deps): update helm release postgresql to v12.9.0 (#174)\n\nReviewed-on: https://codeberg.org/forgejo-contrib/forgejo-helm/pulls/174\nCo-authored-by: Michael Kriese <viceice@noreply.codeberg.org>\nCo-committed-by: Michael Kriese <viceice@noreply.codeberg.org>\n',
            tree: {
              url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/git/trees/7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
              sha: '7eb7edcfd00ffab9dddbae9e9b2deace305c9a84',
              created: '2023-08-25T08:26:28Z',
            },
            verification: null,
          },
          parents: [
            {
              url: 'https://codeberg.org/api/v1/repos/forgejo-contrib/forgejo-helm/git/commits/f19d22c6643b4643c4b2e96482b07527c84d2106',
              sha: 'f19d22c6643b4643c4b2e96482b07527c84d2106',
              created: '0001-01-01T00:00:00Z',
            },
          ],
          files: null,
          stats: null,
        },
      ];
      httpMock
        .scope('https://codeberg.org')
        .get(
          '/api/v1/repos/forgejo-contrib/forgejo-helm/commits?stat=false&verification=false&files=false&page=1&limit=1',
        )
        .reply(200, body);

      const res = await getDigest({
        datasource,
        registryUrls: ['https://codeberg.org'],
        packageName: 'forgejo-contrib/forgejo-helm',
      });
      expect(res).toBe('7eb7edcfd00ffab9dddbae9e9b2deace305c9a84');
    });
  });

  describe('getDigest with no commits', () => {
    it('returns commits from gitea.com', async () => {
      httpMock
        .scope('https://gitea.com')
        .get(
          '/api/v1/repos/some/dep2/commits?stat=false&verification=false&files=false&page=1&limit=1',
        )
        .reply(200, []);
      const res = await getDigest({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toBeNull();
    });
  });

  describe('getTagCommit', () => {
    it('returns tags commit hash from gitea.com', async () => {
      const body = {
        name: 'v9.0.1',
        message: 'v9.0.1',
        id: 'fb4d493a588380ac7a4037d81664363415f31650',
        commit: {
          url: 'https://gitea.com/api/v1/repos/gitea/helm-chart/git/commits/fb4d493a588380ac7a4037d81664363415f31650',
          sha: '29c9bbb4bfec04ab22761cc2d999eb0fcb8acbed',
          created: '2023-07-19T08:42:55+02:00',
        },
        zipball_url: 'https://gitea.com/gitea/helm-chart/archive/v9.0.1.zip',
        tarball_url: 'https://gitea.com/gitea/helm-chart/archive/v9.0.1.tar.gz',
      };
      httpMock
        .scope('https://gitea.com')
        .get('/api/v1/repos/gitea/helm-chart/tags/v9.0.1')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          packageName: 'gitea/helm-chart',
        },
        'v9.0.1',
      );
      expect(res).toBe('29c9bbb4bfec04ab22761cc2d999eb0fcb8acbed');
    });
  });
});
