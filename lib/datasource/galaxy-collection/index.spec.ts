import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';

import { id as datasource } from '.';

const communityKubernetesBase = loadFixture(
  __filename,
  'community_kubernetes_base.json'
);
const communityKubernetesVersions = loadFixture(
  __filename,
  'community_kubernetes_versions.json'
);
const communityKubernetesDetails121 = loadFixture(
  __filename,
  'community_kubernetes_version_details_1.2.1.json'
);
const communityKubernetesDetails120 = loadFixture(
  __filename,
  'community_kubernetes_version_details_1.2.0.json'
);
const communityKubernetesDetails0111 = loadFixture(
  __filename,
  'community_kubernetes_version_details_0.11.1.json'
);

const baseUrl = 'https://galaxy.ansible.com';

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null for 404 result', async () => {
      httpMock.scope(baseUrl).get('/api/v2/collections/foo/bar/').reply(404);
      expect(
        await getPkgReleases({ datasource, depName: 'foo.bar' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for remote host error', async () => {
      httpMock.scope(baseUrl).get('/api/v2/collections/foo/bar/').reply(500);
      let e;
      try {
        await getPkgReleases({ datasource, depName: 'foo.bar' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for unexpected data at base', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, '');
      expect(
        await getPkgReleases({ datasource, depName: 'community.kubernetes' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for unexpected data at versions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/community/kubernetes/')
        .reply(200, communityKubernetesBase)
        .get('/api/v2/collections/community/kubernetes/versions/')
        .reply(200, '');
      expect(
        await getPkgReleases({ datasource, depName: 'community.kubernetes' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(res.releases).toHaveLength(2);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for empty lookup', async () => {
      expect(await getPkgReleases({ datasource, depName: '' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for null lookupName ', async () => {
      expect(await getPkgReleases({ datasource, depName: null })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/api/v2/collections/foo/bar/')
        .replyWithError('some unknown error');
      expect(
        await getPkgReleases({ datasource, depName: 'foo.bar' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(res.releases).toHaveLength(3);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
