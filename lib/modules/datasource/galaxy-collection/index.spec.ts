import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { GalaxyCollectionDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
