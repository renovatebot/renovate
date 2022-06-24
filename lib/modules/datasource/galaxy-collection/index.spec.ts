import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { GalaxyCollectionDatasource } from '.';

const communityKubernetesBase = Fixtures.get('community_kubernetes_base.json');
const communityKubernetesVersions = Fixtures.get(
  'community_kubernetes_versions.json'
);
const communityKubernetesDetails121 = Fixtures.get(
  'community_kubernetes_version_details_1.2.1.json'
);
const communityKubernetesDetails120 = Fixtures.get(
  'community_kubernetes_version_details_1.2.0.json'
);
const communityKubernetesDetails0111 = Fixtures.get(
  'community_kubernetes_version_details_0.11.1.json'
);

const baseUrl = 'https://galaxy.ansible.com';

const datasource = GalaxyCollectionDatasource.id;

describe('modules/datasource/galaxy-collection/index', () => {
  describe('getReleases', () => {
    it('returns null for 404 result', async () => {
      httpMock.scope(baseUrl).get('/api/v2/collections/foo/bar/').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'foo.bar',
        })
      ).toBeNull();
    });

    it('throws for remote host error', async () => {
      httpMock.scope(baseUrl).get('/api/v2/collections/foo/bar/').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          depName: 'foo.bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unexpected data at base', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'community.kubernetes',
        })
      ).toBeNull();
    });

    it('returns null for unexpected data at versions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, communityKubernetesBase)
        .get('/api/v2/collections/community/kubernetes/versions/')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'community.kubernetes',
        })
      ).toBeNull();
    });

    it('throws error for remote host versions error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, communityKubernetesBase)
        .get('/api/v2/collections/community/kubernetes/versions/')
        .reply(500);
      await expect(
        getPkgReleases({
          datasource,
          depName: 'community.kubernetes',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns only valid versions if a version detail fails', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, communityKubernetesBase)
        .get('/api/v2/collections/community/kubernetes/versions/')
        .reply(200, communityKubernetesVersions)
        .get('/api/v2/collections/community/kubernetes/versions/1.2.1/')
        .reply(200, '')
        .get('/api/v2/collections/community/kubernetes/versions/1.2.0/')
        .reply(200, communityKubernetesDetails120)
        .get('/api/v2/collections/community/kubernetes/versions/0.11.1/')
        .reply(200, communityKubernetesDetails0111);

      const res = await getPkgReleases({
        datasource,
        depName: 'community.kubernetes',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(2);
    });

    it('returns null for empty lookup', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: '',
        })
      ).toBeNull();
    });

    it('returns null for null packageName ', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: '',
        })
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/foo/bar/')
        .replyWithError('some unknown error');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'foo.bar',
        })
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, communityKubernetesBase)
        .get('/api/v2/collections/community/kubernetes/versions/')
        .reply(200, communityKubernetesVersions)
        .get('/api/v2/collections/community/kubernetes/versions/1.2.1/')
        .reply(200, communityKubernetesDetails121)
        .get('/api/v2/collections/community/kubernetes/versions/1.2.0/')
        .reply(200, communityKubernetesDetails120)
        .get('/api/v2/collections/community/kubernetes/versions/0.11.1/')
        .reply(200, communityKubernetesDetails0111);
      const res = await getPkgReleases({
        datasource,
        depName: 'community.kubernetes',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(3);
    });
  });
});
