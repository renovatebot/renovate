import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { GalaxyCollectionDatasource } from './index.ts';

const communityKubernetesBase = Fixtures.get('community_kubernetes_base.json');
const communityKubernetesVersions = Fixtures.get(
  'community_kubernetes_versions.json',
);
const communityKubernetesDetails121 = Fixtures.get(
  'community_kubernetes_version_details_1.2.1.json',
);
const communityKubernetesDetails120 = Fixtures.get(
  'community_kubernetes_version_details_1.2.0.json',
);
const communityKubernetesDetails0111 = Fixtures.get(
  'community_kubernetes_version_details_0.11.1.json',
);

const baseUrl = 'https://galaxy.ansible.com/api/';
const collectionAPIPath =
  'v3/plugin/ansible/content/published/collections/index';

const datasource = GalaxyCollectionDatasource.id;

describe('modules/datasource/galaxy-collection/index', () => {
  describe('getReleases', () => {
    it('returns null for 404 result', async () => {
      httpMock.scope(baseUrl).get(`/${collectionAPIPath}/foo/bar/`).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'foo.bar',
        }),
      ).toBeNull();
    });

    it('throws for remote host error', async () => {
      httpMock.scope(baseUrl).get(`/${collectionAPIPath}/foo/bar/`).reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'foo.bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unexpected data at base', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'community.kubernetes',
        }),
      ).toBeNull();
    });

    it('returns null for unexpected data at versions', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, communityKubernetesBase)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/`)
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'community.kubernetes',
        }),
      ).toBeNull();
    });

    it('throws error for remote host versions error', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, communityKubernetesBase)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/`)
        .reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'community.kubernetes',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws error for remote host detailed versions error', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, communityKubernetesBase)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/`)
        .reply(200, communityKubernetesVersions)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.0/`)
        .reply(200, communityKubernetesDetails120)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/0.11.1/`)
        .reply(200, communityKubernetesDetails0111)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.1/`)
        .reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'community.kubernetes',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for empty lookup', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: '',
        }),
      ).toBeNull();
    });

    it('returns null for null packageName', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: '',
        }),
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/foo/bar/`)
        .replyWithError('some unknown error');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'foo.bar',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, communityKubernetesBase)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/`)
        .reply(200, communityKubernetesVersions)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.1/`)
        .reply(200, communityKubernetesDetails121)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.0/`)
        .reply(200, communityKubernetesDetails120)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/0.11.1/`)
        .reply(200, communityKubernetesDetails0111);
      const res = await getPkgReleases({
        datasource,
        packageName: 'community.kubernetes',
      });
      expect(res).toEqual({
        registryUrl: 'https://galaxy.ansible.com/api',
        releases: [
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-0.11.1.tar.gz',
            isDeprecated: false,
            newDigest:
              'cd197084b32f8976394f269eb005bf475eff2122fddbb48380c76154ab4d4530',
            releaseTimestamp: '2023-05-08T20:27:29.606Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '0.11.1',
          },
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-1.2.0.tar.gz',
            isDeprecated: false,
            newDigest:
              'a53eaf6a51987d30cc48ebcd20f0102dae0f17a7a02071928381e5a62951a0ed',
            releaseTimestamp: '2023-05-08T20:27:29.625Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '1.2.0',
          },
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-1.2.1.tar.gz',
            isDeprecated: false,
            newDigest:
              '38e064bb32ee86781f0c6e56bd29fcfbaf48180f993e129185eb8420caabf223',
            releaseTimestamp: '2023-05-08T20:27:29.629Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '1.2.1',
          },
        ],
        sourceUrl:
          'https://github.com/ansible-collections/community.kubernetes',
      });
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(3);
    });

    it('returns null but matches automation hub URL', async () => {
      httpMock
        .scope('https://my.automationhub.local/api/galaxy/content/community/')
        .get(`/v3/plugin/ansible/content/community/collections/index/foo/bar/`)
        .reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'foo.bar',
          registryUrls: [
            'https://my.automationhub.local/api/galaxy/content/community/',
          ],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data with automation hub URL', async () => {
      httpMock
        .scope('https://my.automationhub.local/api/galaxy/content/published/')
        .get(`/${collectionAPIPath}/community/kubernetes/`)
        .reply(200, communityKubernetesBase)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/`)
        .reply(200, communityKubernetesVersions)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.1/`)
        .reply(200, communityKubernetesDetails121)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/1.2.0/`)
        .reply(200, communityKubernetesDetails120)
        .get(`/${collectionAPIPath}/community/kubernetes/versions/0.11.1/`)
        .reply(200, communityKubernetesDetails0111);
      const res = await getPkgReleases({
        datasource,
        packageName: 'community.kubernetes',
        registryUrls: [
          'https://my.automationhub.local/api/galaxy/content/published/',
        ],
      });
      expect(res).toEqual({
        registryUrl:
          'https://my.automationhub.local/api/galaxy/content/published',
        releases: [
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-0.11.1.tar.gz',
            isDeprecated: false,
            newDigest:
              'cd197084b32f8976394f269eb005bf475eff2122fddbb48380c76154ab4d4530',
            releaseTimestamp: '2023-05-08T20:27:29.606Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '0.11.1',
          },
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-1.2.0.tar.gz',
            isDeprecated: false,
            newDigest:
              'a53eaf6a51987d30cc48ebcd20f0102dae0f17a7a02071928381e5a62951a0ed',
            releaseTimestamp: '2023-05-08T20:27:29.625Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '1.2.0',
          },
          {
            dependencies: {},
            downloadUrl:
              'https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/community-kubernetes-1.2.1.tar.gz',
            isDeprecated: false,
            newDigest:
              '38e064bb32ee86781f0c6e56bd29fcfbaf48180f993e129185eb8420caabf223',
            releaseTimestamp: '2023-05-08T20:27:29.629Z',
            sourceUrl:
              'https://github.com/ansible-collections/community.kubernetes',
            version: '1.2.1',
          },
        ],
        sourceUrl:
          'https://github.com/ansible-collections/community.kubernetes',
      });
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(3);
    });
  });

  describe('constructBaseUrl', () => {
    const galaxy_collection_datasource = new GalaxyCollectionDatasource();
    it('returns ansible url with artifactory URL', () => {
      expect(
        galaxy_collection_datasource.constructBaseUrl(
          'https://my.artifactory.local/artifactory/api/ansible/ansible-repo/',
          'foo.bar',
        ),
      ).toBe(
        'https://my.artifactory.local/artifactory/api/ansible/ansible-repo/api/v3/collections/foo/bar/',
      );
    });

    it('returns galaxy url with automation hub URL', () => {
      expect(
        galaxy_collection_datasource.constructBaseUrl(
          'https://my.automationhub.local/api/galaxy/content/community/',
          'foo.bar',
        ),
      ).toBe(
        'https://my.automationhub.local/api/galaxy/content/community/v3/plugin/ansible/content/community/collections/index/foo/bar/',
      );
    });

    it('returns galaxy url with other url', () => {
      expect(
        galaxy_collection_datasource.constructBaseUrl(
          'https://my.collectiondatasource.local/api/collection/content/community/',
          'foo.bar',
        ),
      ).toBe(
        'https://my.collectiondatasource.local/api/collection/content/community/v3/plugin/ansible/content/published/collections/index/foo/bar/',
      );
    });
  });
});
