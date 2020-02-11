import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import _got from '../../util/got';
import * as docker from '.';
import { getPkgReleases } from '..';
import * as _hostRules from '../../util/host-rules';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';
import { DATASOURCE_DOCKER } from '../../constants/data-binary-source';

const got: any = _got;
const hostRules: any = _hostRules;

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

describe('api/docker', () => {
  describe('getRegistryRepository', () => {
    it('handles local registries', () => {
      const res = docker.getRegistryRepository('registry:5000/org/package', []);
      expect(res).toMatchSnapshot();
    });
  });
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      global.repoCache = {};
      hostRules.find.mockReturnValue({
        username: 'some-username',
        password: 'some-password',
      });
      hostRules.hosts = jest.fn(() => []);
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDigest(
        { lookupName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
    });
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      const res = await docker.getDigest(
        { lookupName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
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
      const res = await docker.getDigest({ lookupName: 'some-dep' });
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
        { lookupName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(
        'sha256:b3d6068234f3a18ebeedd2dab81e67b6a192e81192a099df4112ecfc7c3be84f'
      );
    });
    it('supports docker insecure registry', async () => {
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      hostRules.find.mockReturnValueOnce({ insecureRegistry: true });
      const res = await docker.getDigest({ lookupName: 'some-dep' });
      expect(res).toBe('some-digest');
    });
    it('supports basic authentication', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        },
      });
      got.mockReturnValueOnce({
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { lookupName: 'some-dep' },
        'some-tag'
      );
      expect(got.mock.calls[1][1].headers.authorization).toBe(
        'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk'
      );
      expect(res).toBe('some-digest');
    });
    it('returns null for 403 with basic authentication', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        },
      });
      got.mockReturnValueOnce({
        statusCode: 403,
      });
      const res = await docker.getDigest(
        { lookupName: 'some-dep' },
        'some-tag'
      );
      expect(res).toBeNull();
    });
    it('supports ECR authentication', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        },
      });
      AWSMock.setSDKInstance(AWS);
      AWSMock.mock(
        'ECR',
        'getAuthorizationToken',
        (params: {}, callback: Function) => {
          callback(null, {
            authorizationData: [{ authorizationToken: 'abcdef' }],
          });
        }
      );
      got.mockReturnValueOnce({
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { lookupName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node' },
        'some-tag'
      );
      expect(got.mock.calls[1][1].headers.authorization).toBe('Basic abcdef');
      expect(res).toBe('some-digest');
      AWSMock.restore('ECR');
    });
    it('continues without token if ECR authentication could not be extracted', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        },
      });
      AWSMock.setSDKInstance(AWS);
      AWSMock.mock(
        'ECR',
        'getAuthorizationToken',
        (params: {}, callback: Function) => {
          callback(null, {});
        }
      );
      got.mockReturnValueOnce({
        statusCode: 403,
      });
      const res = await docker.getDigest(
        { lookupName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node' },
        'some-tag'
      );
      expect(res).toBe(null);
      AWSMock.restore('ECR');
    });
    it('continues without token if ECR authentication fails', async () => {
      got.mockReturnValueOnce({
        headers: {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        },
      });
      AWSMock.setSDKInstance(AWS);
      AWSMock.mock(
        'ECR',
        'getAuthorizationToken',
        (params: {}, callback: Function) => {
          callback(Error('some error'), null);
        }
      );
      got.mockReturnValueOnce({
        statusCode: 403,
      });
      const res = await docker.getDigest(
        { lookupName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node' },
        'some-tag'
      );
      expect(res).toBe(null);
      AWSMock.restore('ECR');
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
        { lookupName: 'some-dep' },
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
        { lookupName: 'some-other-dep' },
        '8.0.0-alpine'
      );
      expect(res).toBe('some-digest');
    });
    it('should throw error for 429', async () => {
      got.mockRejectedValueOnce({ statusCode: 429 });
      await expect(
        docker.getDigest({ lookupName: 'some-dep' }, 'latest')
      ).rejects.toThrow(Error(DATASOURCE_FAILURE));
    });
    it('should throw error for 5xx', async () => {
      got.mockRejectedValueOnce({ statusCode: 503 });
      await expect(
        docker.getDigest({ lookupName: 'some-dep' }, 'latest')
      ).rejects.toThrow(Error(DATASOURCE_FAILURE));
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
      const res = await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: 'node',
      });
      expect(res).toBeNull();
    });
    it('uses custom registry with registryUrls', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({
        headers: {
          link:
            '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next", ',
        },
        body: { tags },
      });
      got.mockReturnValueOnce({ headers: {}, body: { tags: ['latest'] } });
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: {} });
      const config = {
        datasource: DATASOURCE_DOCKER,
        depName: 'node',
        registryUrls: ['https://registry.company.com'],
      };
      const res = await getPkgReleases(config);
      expect(res.releases).toHaveLength(1);
      expect(got.mock.calls).toMatchSnapshot();
      expect(got.mock.calls[0][0].startsWith(config.registryUrls[0])).toBe(
        true
      );
    });
    it('uses custom registry in depName', async () => {
      const tags = ['1.0.0'];
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: 'registry.company.com/node',
      });
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('uses lower tag limit for ECR deps', async () => {
      got.mockReturnValueOnce({ headers: {} });
      got.mockReturnValueOnce({ headers: {}, body: {} });
      await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
      });
      // The  tag limit parameter `n` needs to be limited to 1000 for ECR
      // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
      expect(got.mock.calls[1][0]).toEqual(
        'https://123456789.dkr.ecr.us-east-1.amazonaws.com/v2/node/tags/list?n=1000'
      );
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
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: {} });
      const res = await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: 'node',
      });
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
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: {} });
      const res = await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: 'docker.io/node',
      });
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
      got.mockReturnValueOnce({
        headers: {},
      });
      got.mockReturnValueOnce({ headers: {}, body: {} });
      const res = await getPkgReleases({
        datasource: DATASOURCE_DOCKER,
        depName: 'k8s.gcr.io/kubernetes-dashboard-amd64',
      });
      expect(res.releases).toHaveLength(1);
      expect(got).toMatchSnapshot();
    });
    it('returns null on error', async () => {
      got.mockReturnValueOnce({});
      const res = await docker.getPkgReleases({
        lookupName: 'my/node',
      });
      expect(res).toBeNull();
    });
  });
  describe('getConfigResponseBeforeRedirectHook', () => {
    it('leaves a non-Amazon or Microsoft request unmodified', () => {
      const emptyOpts = {};
      docker.getConfigResponseBeforeRedirectHook(emptyOpts);
      expect(emptyOpts).toEqual({});

      const nonAmzOpts = {
        search: 'my-search-string',
      };
      docker.getConfigResponseBeforeRedirectHook(nonAmzOpts);
      expect(nonAmzOpts).toEqual({
        search: 'my-search-string',
      });

      const nonMsOpts = {
        href: 'https://myurl.com',
      };
      docker.getConfigResponseBeforeRedirectHook(nonMsOpts);
      expect(nonMsOpts).toEqual({
        href: 'https://myurl.com',
      });
    });

    it('removes the authorization header for Azure requests', () => {
      const href = 'https://myaccount.blob.core.windows.net/xyz';
      const opts = {
        href,
      };
      docker.getConfigResponseBeforeRedirectHook(opts);
      expect(opts).toEqual({ href });

      const optsWithHeadersNoAuth = {
        href,
        headers: {},
      };
      docker.getConfigResponseBeforeRedirectHook(opts);
      expect(optsWithHeadersNoAuth).toEqual({
        href,
        headers: {},
      });

      const optsWithAuth = {
        href,
        headers: {
          authorization: 'Bearer xyz',
        },
      };
      docker.getConfigResponseBeforeRedirectHook(optsWithAuth);
      expect(optsWithAuth.headers).toBeDefined();
      expect(optsWithAuth.headers.authorization).not.toBeDefined();
    });

    it('removes the authorization header for Amazon requests', () => {
      const href = 'https://amazon.com';
      const search = 'X-Amz-Algorithm';
      const authorization = 'Bearer xyz';
      const opts = {
        href,
        search,
        headers: {
          authorization,
        },
      };
      docker.getConfigResponseBeforeRedirectHook(opts);
      expect(opts).toEqual({ search, href, headers: {} });
    });

    it('removes the port when not specified in URL', () => {
      const href = 'https://amazon.com/xyz';
      const search = 'X-Amz-Algorithm';
      const authorization = 'Bearer xyz';
      const port = 8080;
      const opts = {
        href,
        search,
        port,
        headers: {
          authorization,
        },
      };
      docker.getConfigResponseBeforeRedirectHook(opts);
      expect(opts).toEqual({ search, href, headers: {} });
    });
  });
});
