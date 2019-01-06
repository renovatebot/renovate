const got = require('got');
const docker = require('../../lib/datasource/docker');
const { getPkgReleases } = require('../../lib/datasource');
const hostRules = require('../../lib/util/host-rules');

jest.mock('got');
jest.mock('../../lib/util/host-rules');

describe('api/docker', () => {
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      global.repoCache = {};
      hostRules.find.mockReturnValue({
        username: 'some-username',
        password: 'some-password',
      });
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(null);
    });
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(null);
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        },
      });
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe('some-digest');
    });
    it('falls back to body for digest', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        },
      });
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: {
          'content-type': 'text/plain',
        },
        body: `{
          "signatures": [
             {
                "header": {
                   "jwk": {
                      "crv": "P-256",
                      "kid": "DB2X:GSG2:72H3:AE3R:KCMI:Y77E:W7TF:ERHK:V5HR:JJ2Y:YMS6:HFGJ",
                      "kty": "EC",
                      "x": "jyr9-xZBorSC9fhqNsmfU_Ud31wbaZ-bVGz0HmySvbQ",
                      "y": "vkE6qZCCvYRWjSUwgAOvibQx_s8FipYkAiHS0VnAFNs"
                   },
                   "alg": "ES256"
                },
                "signature": "yUXzEiPzg_SlQlqGW43H6oMgYuz30zSkj2qauQc_kbyI9RQHucYAKs_lBSFaQdDrtgW-1iDZSP9eExKP8ANSyA",
                "protected": "eyJmb3JtYXRMZW5ndGgiOjgzMDAsImZvcm1hdFRhaWwiOiJDbjAiLCJ0aW1lIjoiMjAxOC0wMi0wNVQxNDoyMDoxOVoifQ"
             }
          ]
       }`,
      });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(
        'sha256:b3d6068234f3a18ebeedd2dab81e67b6a192e81192a099df4112ecfc7c3be84f'
      );
    });
    it('continues without token, when no header is present', async () => {
      got.mockReturnValueOnce({
        headers: {
          'content-type': 'text/plain',
        },
      });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe('some-digest');
    });
    it('supports scoped names', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        },
      });
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        '8.0.0-alpine'
      );
      expect(res).toBe('some-digest');
    });
    it('should throw error for 429', async () => {
      got.mockRejectedValueOnce({ statusCode: 429 });
      let e;
      try {
        await docker.getDigest({ depName: 'some-dep' }, 'latest');
      } catch (err) {
        e = err;
      }
      expect(e.message).toBe('registry-failure');
    });
    it('should throw error for 5xx', async () => {
      got.mockRejectedValueOnce({ statusCode: 503 });
      let e;
      try {
        await docker.getDigest({ depName: 'some-dep' }, 'latest');
      } catch (err) {
        e = err;
      }
      expect(e.message).toBe('registry-failure');
    });
  });
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await getPkgReleases('pkg:docker/node');
      expect(res).toBe(null);
    });
    it('uses custom registry', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const config = {
        registryUrls: ['https://registry.company.com'],
      };
      const res = await getPkgReleases('pkg:docker/node', config);
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('adds library/ prefix for Docker Hub (implicit)', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull  "',
        },
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await getPkgReleases('pkg:docker/node');
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('adds library/ prefix for Docker Hub (explicit)', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull  "',
        },
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await getPkgReleases('pkg:docker/node?registry=docker.io');
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('adds no library/ prefix for other registries', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://k8s.gcr.io/v2/token",service="k8s.gcr.io"',
        },
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await getPkgReleases(
        'pkg:docker/kubernetes-dashboard-amd64?registry=k8s.gcr.io'
      );
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('returns null on error', async () => {
      got.mockReturnValueOnce({});
      const res = await docker.getPkgReleases({
        fullname: 'my/node',
        qualifiers: {},
      });
      expect(res).toBe(null);
    });
  });
});
