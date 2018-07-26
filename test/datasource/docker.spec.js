const got = require('got');
const docker = require('../../lib/datasource/docker');

jest.mock('got');

describe('api/docker', () => {
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
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
        { depName: 'some-dep', tagSuffix: 'alpine' },
        '8.0.0'
      );
      expect(res).toBe('some-digest');
    });
  });
  describe('getDependency', () => {
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDependency({
        fullname: 'node',
        qualifiers: {},
      });
      expect(res).toBe(null);
    });
    it('returns tags with no suffix', async () => {
      const tags = ['a', 'b', '1.0.0', '1.1.0', '1.1.0-alpine'];
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        },
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: {},
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
    });
    it('returns tags with suffix', async () => {
      const tags = ['a', 'b', '1.0.0', '1.1.0-alpine'];
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        },
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: { suffix: 'alpine' },
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
    });
    it('returns null on error', async () => {
      got.mockReturnValueOnce({});
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: {},
      });
      expect(res).toBe(null);
    });
  });
});
