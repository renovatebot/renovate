import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { GalaxyCollectionDatasource } from '.';

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

const baseUrl = 'https://galaxy.ansible.com';
const collectionAPIPath =
  'api/v3/plugin/ansible/content/published/collections/index';

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

    it('returns null for null packageName ', async () => {
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
  });
});
