import * as _AWS from '@aws-sdk/client-ecr';
import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, mocked, partial } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as _hostRules from '../../util/host-rules';
import { MediaType } from './types';
import * as docker from '.';

const hostRules = mocked(_hostRules);

jest.mock('@aws-sdk/client-ecr');
jest.mock('../../util/host-rules');

type ECR = _AWS.ECR;
type GetAuthorizationTokenCommandOutput = _AWS.GetAuthorizationTokenCommandOutput;
const AWS = mocked(_AWS);

const baseUrl = 'https://index.docker.io/v2';
const authUrl = 'https://auth.docker.io';
const amazonUrl = 'https://123456789.dkr.ecr.us-east-1.amazonaws.com/v2';

function mockEcrAuthResolve(
  res: Partial<GetAuthorizationTokenCommandOutput> = {}
) {
  AWS.ECR.mockImplementationOnce(() =>
    partial<ECR>({
      getAuthorizationToken: () =>
        Promise.resolve<GetAuthorizationTokenCommandOutput>(
          partial<GetAuthorizationTokenCommandOutput>(res)
        ),
    })
  );
}

function mockEcrAuthReject(msg: string) {
  AWS.ECR.mockImplementationOnce(() =>
    partial<ECR>({
      getAuthorizationToken: jest.fn().mockRejectedValue(new Error(msg)),
    })
  );
}

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
    httpMock.reset();
  });

  describe('getRegistryRepository', () => {
    it('handles local registries', () => {
      const res = docker.getRegistryRepository(
        'registry:5000/org/package',
        'https://index.docker.io'
      );
      expect(res).toMatchSnapshot();
    });
    it('supports registryUrls', () => {
      const res = docker.getRegistryRepository(
        'my.local.registry/prefix/image',
        'https://my.local.registry/prefix'
      );
      expect(res).toMatchSnapshot();
    });
    it('supports http registryUrls', () => {
      const res = docker.getRegistryRepository(
        'my.local.registry/prefix/image',
        'http://my.local.registry/prefix'
      );
      expect(res).toMatchSnapshot();
    });
    it('supports schemeless registryUrls', () => {
      const res = docker.getRegistryRepository(
        'my.local.registry/prefix/image',
        'my.local.registry/prefix'
      );
      expect(res).toMatchSnapshot();
    });
  });
  describe('getDigest', () => {
    it('returns null if no token', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {})
        .get('/library/some-dep/manifests/some-new-value')
        .reply(401);
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if errored', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, { token: 'some-token' })
        .get('/library/some-dep/manifests/some-new-value')
        .replyWithError('error');
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if empty header', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, { token: 'some-token' })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, undefined, { 'docker-content-digest': '' });
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        })
        .get('/library/some-dep/manifests/latest')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .reply(200, { token: 'some-token' });

      hostRules.find.mockReturnValue({});
      const res = await getDigest({
        datasource: 'docker',
        depName: 'some-dep',
      });
      expect(res).toBe('some-digest');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('falls back to body for digest', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(
          200,
          `{
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
          {
            'content-type': 'text/plain',
          }
        );
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .reply(200, { token: 'some-token' });
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(
        'sha256:b3d6068234f3a18ebeedd2dab81e67b6a192e81192a099df4112ecfc7c3be84f'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports docker insecure registry', async () => {
      httpMock
        .scope(baseUrl.replace('https', 'http'))
        .get('/')
        .reply(200, '', {})
        .get('/library/some-dep/manifests/latest')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });
      hostRules.find.mockReturnValueOnce({ insecureRegistry: true });
      const res = await getDigest({
        datasource: 'docker',
        depName: 'some-dep',
      });
      expect(res).toBe('some-digest');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports basic authentication', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(200)
        .get('/library/some-dep/manifests/some-tag')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-tag'
      );
      const trace = httpMock.getTrace();
      expect(res).toBe('some-digest');
      expect(trace[1].headers.authorization).toBe(
        'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk'
      );
      expect(trace).toMatchSnapshot();
    });
    it('returns null for 403 with basic authentication', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(403);
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-tag'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports ECR authentication', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(200)
        .get('/node/manifests/some-tag')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });

      mockEcrAuthResolve({
        authorizationData: [{ authorizationToken: 'abcdef' }],
      });

      const res = await getDigest(
        {
          datasource: 'docker',
          depName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );
      const trace = httpMock.getTrace();
      expect(res).toBe('some-digest');
      expect(trace[1].headers.authorization).toBe('Basic abcdef');
      expect(trace).toMatchSnapshot();
    });
    it('continues without token if ECR authentication could not be extracted', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(403);
      mockEcrAuthResolve();

      const res = await getDigest(
        {
          datasource: 'docker',
          depName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('continues without token if ECR authentication fails', async () => {
      hostRules.find.mockReturnValue({});
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(403);
      mockEcrAuthReject('some error');
      const res = await getDigest(
        {
          datasource: 'docker',
          depName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('continues without token, when no header is present', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'content-type': 'text/plain',
        })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe('some-digest');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports scoped names', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "',
        })
        .get('/library/some-other-dep/manifests/8.0.0-alpine')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-other-dep:pull'
        )
        .reply(200, { access_token: 'some-token' });
      const res = await getDigest(
        { datasource: 'docker', depName: 'some-other-dep' },
        '8.0.0-alpine'
      );
      expect(res).toBe('some-digest');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should throw error for 429', async () => {
      httpMock.scope(baseUrl).get('/').replyWithError({ statusCode: 429 });
      await expect(
        getDigest({ datasource: 'docker', depName: 'some-dep' }, 'latest')
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
    it('should throw error for 5xx', async () => {
      httpMock.scope(baseUrl).get('/').replyWithError({ statusCode: 504 });
      await expect(
        getDigest({ datasource: 'docker', depName: 'some-dep' }, 'latest')
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
  describe('getReleases', () => {
    it('returns null if no token', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {})
        .get('/library/node/tags/list?n=10000')
        .reply(403);
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'node',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('uses custom registry with registryUrls', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200, '', {})
        .get('/node/tags/list?n=10000')
        .reply(
          200,
          { tags },
          {
            link:
              '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next", ',
          }
        )
        .get('/')
        .reply(200)
        .get('/node/manifests/latest')
        .reply(200);
      httpMock
        .scope('https://api.github.com')
        .get('/user/9287/repos?page=3&per_page=100')
        .reply(200, { tags: ['latest'] }, {});
      const config = {
        datasource: docker.id,
        depName: 'node',
        registryUrls: ['https://registry.company.com'],
      };
      const res = await getPkgReleases(config);
      expect(res.releases).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('uses custom registry in depName', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200, '', {})
        .get('/node/tags/list?n=10000')
        .reply(200, { tags }, {})
        .get('/')
        .reply(200, '', {})
        .get('/node/manifests/1.0.0')
        .reply(200, '', {});
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      expect(res.releases).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('uses lower tag limit for ECR deps', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(200, '', {})
        // The  tag limit parameter `n` needs to be limited to 1000 for ECR
        // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
        .get('/node/tags/list?n=1000')
        .reply(200, {}, {})
        .get('/')
        .reply(200, '', {})
        .get('/node/manifests/undefined')
        .reply(200);
      await getPkgReleases({
        datasource: docker.id,
        depName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds library/ prefix for Docker Hub (implicit)', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull  "',
        })
        .get('/library/node/tags/list?n=10000')
        .reply(200, { tags }, {})
        .get('/')
        .reply(200)
        .get('/library/node/manifests/1.0.0')
        .reply(200);
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/node:pull'
        )
        .reply(200, { token: 'some-token ' });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'node',
      });
      expect(res.releases).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds library/ prefix for Docker Hub (explicit)', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull  "',
        })
        .get('/library/node/tags/list?n=10000')
        .reply(200, { tags }, {})
        .get('/')
        .reply(200)
        .get('/library/node/manifests/1.0.0')
        .reply(200);
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/node:pull'
        )
        .reply(200, { token: 'some-token ' });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'docker.io/node',
      });
      expect(res.releases).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds no library/ prefix for other registries', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://k8s.gcr.io/v2/')
        .get('/')
        .reply(200, '', {
          'www-authenticate':
            'Bearer realm="https://k8s.gcr.io/v2/token",service="k8s.gcr.io"',
        })
        .get(
          '/token?service=k8s.gcr.io&scope=repository:kubernetes-dashboard-amd64:pull'
        )
        .reply(200, { token: 'some-token ' })
        .get('/kubernetes-dashboard-amd64/tags/list?n=10000')
        .reply(200, { tags }, {})
        .get('/')
        .reply(200)
        .get('/kubernetes-dashboard-amd64/manifests/1.0.0')
        .reply(200);
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'k8s.gcr.io/kubernetes-dashboard-amd64',
      });
      expect(res.releases).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null on error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, null)
        .get('/my/node/tags/list?n=10000')
        .replyWithError('error');
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'my/node',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null if no auth', async () => {
      hostRules.find.mockReturnValue({});
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, undefined, {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/')
        .reply(403);
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'node',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('supports labels', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(3)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: MediaType.manifestV2,
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(200, {
          config: {
            Labels: {
              'org.opencontainers.image.source':
                'https://github.com/renovatebot/renovate',
            },
          },
        });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      const trace = httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(trace).toMatchSnapshot();
    });

    it('supports manifest lists', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(4)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: MediaType.manifestListV2,
          manifests: [{ digest: 'some-image-digest' }],
        })
        .get('/node/manifests/some-image-digest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: MediaType.manifestV2,
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(200, {
          config: {
            Labels: {
              'org.opencontainers.image.source':
                'https://github.com/renovatebot/renovate',
            },
          },
        });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      const trace = httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(trace).toMatchSnapshot();
    });

    it('ignores unsupported manifest', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(2)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: MediaType.manifestV1,
        });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      const trace = httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(trace).toMatchSnapshot();
    });

    it('ignores unsupported schema version', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(2)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {});
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      const trace = httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(trace).toMatchSnapshot();
    });

    it('supports redirect', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(3)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: MediaType.manifestV2,
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(302, undefined, {
          location:
            'https://abc.s3.amazon.com/some-config-digest?X-Amz-Algorithm=xxxx',
        });
      httpMock
        .scope('https://abc.s3.amazon.com')
        .get('/some-config-digest')
        .query({ 'X-Amz-Algorithm': 'xxxx' })
        .reply(200, {
          config: {},
        });
      const res = await getPkgReleases({
        datasource: docker.id,
        depName: 'registry.company.com/node',
      });
      const trace = httpMock.getTrace();
      expect(res).toMatchSnapshot();
      expect(trace).toMatchSnapshot();
      expect(trace[1].headers.authorization).toBe(
        'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk'
      );
      expect(trace[trace.length - 1].headers.authorization).toBeUndefined();
    });
  });
});
