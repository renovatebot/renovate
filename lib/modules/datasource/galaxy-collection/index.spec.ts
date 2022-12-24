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

const v3CommunityGeneralBase = Fixtures.get(
  'galaxy_v3_community_general_base.json'
);
const v3CommunityGeneralVersions = Fixtures.get(
  'galaxy_v3_community_general_versions.json'
);
const v3CommunityGeneralDetails610 = Fixtures.get(
  'galaxy_v3_community_general_version_details_6.1.0.json'
);
const v3CommunityGeneralDetails601 = Fixtures.get(
  'galaxy_v3_community_general_version_details_6.0.1.json'
);

// standard ansible galaxy
const defaultBaseUrl = 'https://galaxy.ansible.com';
// mirrored ansible-galaxy, same paths
const customBaseUrl = 'https://my-mirror.example.com';
//the automation hub case
const customHostAndPath =
  'https://automationhub.example.com/api/galaxy/content/community/v3/collections';

const galaxyUrls = [
  { datasourceUrl: defaultBaseUrl, path: '/api/v2/collections' },
  { datasourceUrl: customBaseUrl, path: '/api/v2/collections' },
  { datasourceUrl: customHostAndPath, path: '' },
];

const datasource = GalaxyCollectionDatasource.id;

describe('modules/datasource/galaxy-collection/index', () => {
  for (const galaxyUrl of galaxyUrls) {
    describe('getReleases ' + galaxyUrl.datasourceUrl, () => {
      it('returns null for 404 result', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/foo/bar')
          .reply(404);
        expect(
          await getPkgReleases({
            datasource,
            depName: 'foo.bar',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });

      it('throws for remote host error', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/foo/bar')
          .reply(500);
        await expect(
          getPkgReleases({
            datasource,
            depName: 'foo.bar',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('returns null for unexpected data at base', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/community/kubernetes')
          .reply(200, '');
        expect(
          await getPkgReleases({
            datasource,
            depName: 'community.kubernetes',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });

      it('returns null for unexpected data at versions', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/community/kubernetes')
          .reply(200, communityKubernetesBase)
          .get(galaxyUrl.path + '/community/kubernetes/versions/')
          .reply(200, '');
        expect(
          await getPkgReleases({
            datasource,
            depName: 'community.kubernetes',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });

      it('throws error for remote host versions error', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/community/kubernetes')
          .reply(200, communityKubernetesBase)
          .get(galaxyUrl.path + '/community/kubernetes/versions/')
          .reply(500);
        await expect(
          getPkgReleases({
            datasource,
            depName: 'community.kubernetes',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('returns null for empty lookup', async () => {
        expect(
          await getPkgReleases({
            datasource,
            depName: '',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });

      it('returns null for null packageName ', async () => {
        expect(
          await getPkgReleases({
            datasource,
            depName: '',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });

      it('returns null for unknown error', async () => {
        httpMock
          .scope(galaxyUrl.datasourceUrl)
          .get(galaxyUrl.path + '/foo/bar')
          .replyWithError('some unknown error');
        expect(
          await getPkgReleases({
            datasource,
            depName: 'foo.bar',
            registryUrls: [galaxyUrl.datasourceUrl],
          })
        ).toBeNull();
      });
    });
  }

  describe('getReleases - test real data from ansible-galaxy', () => {
    it('returns only valid versions if a version detail fails', async () => {
      httpMock
        .scope(defaultBaseUrl)
        .get('/api/v2/collections/community/kubernetes')
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
        registryUrls: [defaultBaseUrl],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(2);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultBaseUrl)
        .get('/api/v2/collections/community/kubernetes')
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
        registryUrls: [defaultBaseUrl],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(3);
    });
  });

  describe('getReleases - test real data from automationhub / galaxy_ng', () => {
    it('returns only valid versions if a version detail fails', async () => {
      httpMock
        .scope(customHostAndPath)
        .get('/community/general')
        .reply(200, v3CommunityGeneralBase)
        .get('/community/general/versions/')
        .reply(200, v3CommunityGeneralVersions)
        .get('/community/general/versions/6.1.0/')
        .reply(200, '')
        .get('/community/general/versions/6.0.1/')
        .reply(200, v3CommunityGeneralDetails601);

      const res = await getPkgReleases({
        datasource,
        depName: 'community.general',
        registryUrls: [customHostAndPath],
      });
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(1);
    });

    it('processes real data', async () => {
      httpMock
        .scope(customHostAndPath)
        .get('/community/general')
        .reply(200, v3CommunityGeneralBase)
        .get('/community/general/versions/')
        .reply(200, v3CommunityGeneralVersions)
        .get('/community/general/versions/6.1.0/')
        .reply(200, v3CommunityGeneralDetails610)
        .get('/community/general/versions/6.0.1/')
        .reply(200, v3CommunityGeneralDetails601);

      const res = await getPkgReleases({
        datasource,
        depName: 'community.general',
        registryUrls: [customHostAndPath],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(res?.releases).toHaveLength(2);
    });
  });
});
