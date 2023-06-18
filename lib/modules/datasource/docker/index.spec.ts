import {
  ECRClient,
  GetAuthorizationTokenCommand,
  GetAuthorizationTokenCommandOutput,
} from '@aws-sdk/client-ecr';
import { mockClient } from 'aws-sdk-client-mock';
import { getDigest, getPkgReleases } from '..';
import { range } from '../../../../lib/util/range';
import * as httpMock from '../../../../test/http-mock';
import { logger, mocked } from '../../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as _hostRules from '../../../util/host-rules';
import { DockerDatasource } from '.';

const hostRules = mocked(_hostRules);

jest.mock('../../../util/host-rules');

const ecrMock = mockClient(ECRClient);

const baseUrl = 'https://index.docker.io/v2';
const authUrl = 'https://auth.docker.io';
const amazonUrl = 'https://123456789.dkr.ecr.us-east-1.amazonaws.com/v2';

function mockEcrAuthResolve(
  res: Partial<GetAuthorizationTokenCommandOutput> = {}
) {
  ecrMock.on(GetAuthorizationTokenCommand).resolvesOnce(res);
}

function mockEcrAuthReject(msg: string) {
  ecrMock.on(GetAuthorizationTokenCommand).rejectsOnce(new Error(msg));
}

describe('modules/datasource/docker/index', () => {
  beforeEach(() => {
    ecrMock.reset();
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.hosts.mockReturnValue([]);
  });

  describe('getDigest', () => {
    it('returns null if no token', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, '', {})
        .head('/library/some-dep/manifests/some-new-value', undefined, {
          badheaders: ['authorization'],
        })
        .reply(401);
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
    });

    it('returns null if errored', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, { token: 'abc' })
        .head('/library/some-dep/manifests/some-new-value', undefined, {
          reqheaders: { authorization: 'Bearer abc' },
        })
        .replyWithError('error');
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
    });

    it('returns null if empty header', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, { token: 'some-token' })
        .head('/library/some-dep/manifests/some-new-value')
        .reply(200, undefined, { 'docker-content-digest': '' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBeNull();
    });

    it('returns digest', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/latest')
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
        packageName: 'some-dep',
      });
      expect(res).toBe('some-digest');
    });

    it('falls back to body for digest', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .twice()
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/some-new-value')
        .reply(200, undefined, {})
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
        .twice()
        .reply(200, { token: 'some-token' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(
        'sha256:b3d6068234f3a18ebeedd2dab81e67b6a192e81192a099df4112ecfc7c3be84f'
      );
    });

    it('supports docker insecure registry', async () => {
      httpMock
        .scope(baseUrl.replace('https', 'http'))
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200)
        .head('/library/some-dep/manifests/latest')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });
      hostRules.find.mockReturnValue({ insecureRegistry: true });
      const res = await getDigest({
        datasource: 'docker',
        packageName: 'some-dep',
      });
      expect(res).toBe('some-digest');
    });

    it('supports basic authentication', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })

        .head('/library/some-dep/manifests/some-tag')
        .matchHeader(
          'authorization',
          'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk'
        )
        .reply(200, '', { 'docker-content-digest': 'some-digest' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-tag'
      );
      expect(res).toBe('some-digest');
    });

    it('returns null for 403 with basic authentication', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .head('/library/some-dep/manifests/some-tag')
        .reply(403);
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-tag'
      );
      expect(res).toBeNull();
    });

    it('passes credentials to ECR client', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .head('/node/manifests/some-tag')
        .matchHeader('authorization', 'Basic test_token')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });

      mockEcrAuthResolve({
        authorizationData: [{ authorizationToken: 'test_token' }],
      });

      expect(
        await getDigest(
          {
            datasource: 'docker',
            packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
          },
          'some-tag'
        )
      ).toBe('some-digest');

      const ecr = ecrMock.call(0).thisValue as ECRClient;
      expect(await ecr.config.region()).toBe('us-east-1');
      expect(await ecr.config.credentials()).toEqual({
        accessKeyId: 'some-username',
        secretAccessKey: 'some-password',
      });
    });

    it('passes session token to ECR client', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .head('/node/manifests/some-tag')
        .matchHeader('authorization', 'Basic test_token')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });

      hostRules.find.mockReturnValue({
        username: 'some-username',
        password: 'some-password',
        token: 'some-session-token',
      });

      mockEcrAuthResolve({
        authorizationData: [{ authorizationToken: 'test_token' }],
      });

      expect(
        await getDigest(
          {
            datasource: 'docker',
            packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
          },
          'some-tag'
        )
      ).toBe('some-digest');

      const ecr = ecrMock.call(0).thisValue as ECRClient;
      expect(await ecr.config.region()).toBe('us-east-1');
      expect(await ecr.config.credentials()).toEqual({
        accessKeyId: 'some-username',
        secretAccessKey: 'some-password',
        sessionToken: 'some-session-token',
      });
    });

    it('supports ECR authentication', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .head('/node/manifests/some-tag')
        .matchHeader('authorization', 'Basic test')
        .reply(200, '', { 'docker-content-digest': 'some-digest' });

      mockEcrAuthResolve({
        authorizationData: [{ authorizationToken: 'test' }],
      });

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );

      expect(res).toBe('some-digest');
    });

    it('continues without token if ECR authentication could not be extracted', async () => {
      httpMock.scope(amazonUrl).get('/').reply(401, '', {
        'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
      });
      mockEcrAuthResolve();

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );
      expect(res).toBeNull();
    });

    it('continues without token if ECR authentication fails', async () => {
      hostRules.find.mockReturnValue({});
      httpMock.scope(amazonUrl).get('/').reply(401, '', {
        'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
      });
      mockEcrAuthReject('some error');
      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        },
        'some-tag'
      );
      expect(res).toBeNull();
    });

    it('continues without token, when no header is present', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(200, '', {
          'content-type': 'text/plain',
        })
        .head('/library/some-dep/manifests/some-new-value')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe('some-digest');
    });

    it('supports token with no service', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",scope=""',
        })
        .head('/library/some-other-dep/manifests/8.0.0-alpine')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      httpMock
        .scope(authUrl)
        .get('/token?scope=repository:library/some-other-dep:pull')
        .reply(200, { access_token: 'test' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-other-dep' },
        '8.0.0-alpine'
      );
      expect(res).toBe('some-digest');
    });

    it('supports scoped names', async () => {
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-other-dep:pull"',
        })
        .head('/library/some-other-dep/manifests/8.0.0-alpine')
        .reply(200, {}, { 'docker-content-digest': 'some-digest' });
      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-other-dep:pull'
        )
        .reply(200, { access_token: 'test' });
      const res = await getDigest(
        { datasource: 'docker', packageName: 'some-other-dep' },
        '8.0.0-alpine'
      );
      expect(res).toBe('some-digest');
    });

    it('should throw error for 429', async () => {
      httpMock.scope(baseUrl).get('/').replyWithError({ statusCode: 429 });
      await expect(
        getDigest({ datasource: 'docker', packageName: 'some-dep' }, 'latest')
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('should throw error for 5xx', async () => {
      httpMock.scope(baseUrl).get('/').replyWithError({ statusCode: 504 });
      await expect(
        getDigest({ datasource: 'docker', packageName: 'some-dep' }, 'latest')
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('supports architecture-specific digest', async () => {
      const currentDigest =
        'sha256:81c09f6d42c2db8121bcd759565ea244cedc759f36a0f090ec7da9de4f7f8fe4';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(4)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .times(3)
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.v2+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/library/some-dep/blobs/some-config-digest')
        .reply(200, {
          architecture: 'amd64',
        });
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, {
          schemaVersion: 2,
          mediaType:
            'application/vnd.docker.distribution.manifest.list.v2+json',
          manifests: [
            {
              digest:
                'sha256:c3fe2aac7e4f47270eeff0fdd35cb9bad674105eaa1663942645ca58399a2dbc',
              platform: {
                architecture: 'arm',
                os: 'linux',
                variant: 'v6',
              },
            },
            {
              digest:
                'sha256:78fa4d63fec4e647f00908f24cda05af101aa9702700f613c7f82a96a267d801',
              platform: {
                architecture: '386',
                os: 'linux',
              },
            },
            {
              digest:
                'sha256:81093b981e72a54d488d5a60780006d82f7cc02d248d88ff71ff4137b0f51176',
              platform: {
                architecture: 'amd64',
                os: 'linux',
              },
            },
          ],
        });

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Current digest ${currentDigest} relates to architecture amd64`
      );
      expect(res).toBe(
        'sha256:81093b981e72a54d488d5a60780006d82f7cc02d248d88ff71ff4137b0f51176'
      );
    });

    it('handles missing architecture-specific digest', async () => {
      const currentDigest =
        'sha256:81c09f6d42c2db8121bcd759565ea244cedc759f36a0f090ec7da9de4f7f8fe4';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(5)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .times(3)
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.v2+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/library/some-dep/blobs/some-config-digest')
        .reply(200, {});
      httpMock
        .scope(baseUrl)
        .get('/')
        .twice()
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/some-new-value')
        .reply(200, undefined, {})
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, {
          schemaVersion: 2,
          mediaType:
            'application/vnd.docker.distribution.manifest.list.v2+json',
          manifests: [
            {
              digest:
                'sha256:c3fe2aac7e4f47270eeff0fdd35cb9bad674105eaa1663942645ca58399a2dbc',
              platform: {
                architecture: 'arm',
                os: 'linux',
                variant: 'v6',
              },
            },
            {
              digest:
                'sha256:78fa4d63fec4e647f00908f24cda05af101aa9702700f613c7f82a96a267d801',
              platform: {
                architecture: '386',
                os: 'linux',
              },
            },
            {
              digest:
                'sha256:81093b981e72a54d488d5a60780006d82f7cc02d248d88ff71ff4137b0f51176',
              platform: {
                architecture: 'amd64',
                os: 'linux',
              },
            },
          ],
        });

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Current digest ${currentDigest} relates to architecture null`
      );
      expect(res).toBe(
        'sha256:ee75deb1a41bb998e52a116707a6e22a91904cba0c1d6e6c76cf04923efff2d8'
      );
    });

    it('supports architecture-specific digest in OCI manifests with media type', async () => {
      const currentDigest =
        'sha256:0101010101010101010101010101010101010101010101010101010101010101';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(4)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .times(3)
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/library/some-dep/blobs/some-config-digest')
        .reply(200, {
          architecture: 'amd64',
        });
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(
          200,
          {
            schemaVersion: 2,
            mediaType: 'application/vnd.oci.image.index.v1+json',
            manifests: [
              {
                digest: 'some-new-image-digest',
                platform: {
                  architecture: 'amd64',
                },
              },
            ],
          },
          {
            'content-type': 'text/plain',
          }
        );

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Current digest ${currentDigest} relates to architecture amd64`
      );
      expect(res).toBe('some-new-image-digest');
    });

    it('supports architecture-specific digest in OCI manifests without media type', async () => {
      const currentDigest =
        'sha256:0101010101010101010101010101010101010101010101010101010101010101';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(4)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .times(3)
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(200, {
          schemaVersion: 2,
          config: { digest: 'some-config-digest' },
        })
        .get('/library/some-dep/blobs/some-config-digest')
        .reply(200, {
          architecture: 'amd64',
        });
      httpMock
        .scope(baseUrl)
        .get('/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, {
          schemaVersion: 2,
          manifests: [
            {
              digest: 'some-new-image-digest',
              platform: {
                architecture: 'amd64',
              },
            },
          ],
        });

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Current digest ${currentDigest} relates to architecture amd64`
      );
      expect(res).toBe('some-new-image-digest');
    });

    it('handles error while retrieving manifest list for architecture-specific digest', async () => {
      const currentDigest =
        'sha256:81c09f6d42c2db8121bcd759565ea244cedc759f36a0f090ec7da9de4f7f8fe4';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(4)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .twice()
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.v2+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(404, {});
      httpMock
        .scope(baseUrl)
        .get('/')
        .twice()
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/some-new-value')
        .reply(200, undefined, {})
        .get('/library/some-dep/manifests/some-new-value')
        .reply(200, {
          schemaVersion: 2,
          mediaType:
            'application/vnd.docker.distribution.manifest.list.v2+json',
          manifests: [
            {
              digest:
                'sha256:c3fe2aac7e4f47270eeff0fdd35cb9bad674105eaa1663942645ca58399a2dbc',
              platform: {
                architecture: 'arm',
                os: 'linux',
                variant: 'v6',
              },
            },
            {
              digest:
                'sha256:78fa4d63fec4e647f00908f24cda05af101aa9702700f613c7f82a96a267d801',
              platform: {
                architecture: '386',
                os: 'linux',
              },
            },
            {
              digest:
                'sha256:81093b981e72a54d488d5a60780006d82f7cc02d248d88ff71ff4137b0f51176',
              platform: {
                architecture: 'amd64',
                os: 'linux',
              },
            },
          ],
        });

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );

      expect(res).toBe(
        'sha256:ee75deb1a41bb998e52a116707a6e22a91904cba0c1d6e6c76cf04923efff2d8'
      );
    });

    it('handles error while retrieving image config blob', async () => {
      const currentDigest =
        'sha256:0101010101010101010101010101010101010101010101010101010101010101';

      httpMock
        .scope(authUrl)
        .get(
          '/token?service=registry.docker.io&scope=repository:library/some-dep:pull'
        )
        .times(3)
        .reply(200, { token: 'some-token' });
      httpMock
        .scope(baseUrl)
        .get('/')
        .times(3)
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/some-dep:pull"',
        })
        .head('/library/some-dep/manifests/' + currentDigest)
        .reply(200, '', {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
        })
        .get('/library/some-dep/manifests/' + currentDigest)
        .reply(200, {
          schemaVersion: 2,
          config: { digest: 'some-config-digest' },
        })
        .get('/library/some-dep/blobs/some-config-digest')
        .reply(404, {});
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, '', {})
        .head('/library/some-dep/manifests/some-new-value', undefined, {
          badheaders: ['authorization'],
        })
        .reply(401);

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
        },
        'some-new-value'
      );
      expect(res).toBeNull();
    });

    it('returns null if digest refers to manifest list and new value invalid', async () => {
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, { token: 'some-token' })
        .head(
          '/library/some-dep/manifests/sha256:0101010101010101010101010101010101010101010101010101010101010101'
        )
        .reply(404, {});
      httpMock
        .scope(baseUrl)
        .get('/', undefined, { badheaders: ['authorization'] })
        .reply(200, '', {})
        .head(
          '/library/some-dep/manifests/sha256:fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa',
          undefined,
          {
            badheaders: ['authorization'],
          }
        )
        .reply(401);

      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest:
            'sha256:0101010101010101010101010101010101010101010101010101010101010101',
        },
        'sha256:fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa'
      );
      expect(res).toBeNull();
    });

    it('falls back to library/ prefix on non-namespaced images with existing digest', async () => {
      const currentDigest =
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        newDigest =
          'sha256:1111111111111111111111111111111111111111111111111111111111111111';

      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(4)
        .reply(200)
        .head(`/some-dep/manifests/${currentDigest}`)
        .reply(500)
        .head(`/some-dep/manifests/3.17`)
        .reply(404)
        .head(`/library/some-dep/manifests/${currentDigest}`)
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': currentDigest,
        })
        .head('/library/some-dep/manifests/3.17')
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': newDigest,
        });

      hostRules.find.mockReturnValue({});
      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          currentDigest,
          registryUrls: ['https://registry.company.com'],
        },
        '3.17'
      );

      expect(res).toBe(newDigest);
    });

    it('falls back to library/ prefix on non-namespaced images without existing digest', async () => {
      const newDigest =
        'sha256:1111111111111111111111111111111111111111111111111111111111111111';

      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(2)
        .reply(200)
        .head(`/some-dep/manifests/3.17`)
        .reply(404)
        .head('/library/some-dep/manifests/3.17')
        .reply(200, '', {
          'content-type':
            'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': newDigest,
        });

      hostRules.find.mockReturnValue({});
      const res = await getDigest(
        {
          datasource: 'docker',
          packageName: 'some-dep',
          registryUrls: ['https://registry.company.com'],
        },
        '3.17'
      );

      expect(res).toBe(newDigest);
    });
  });

  describe('getReleases', () => {
    it('returns null if no token', async () => {
      httpMock
        .scope(baseUrl)
        .get('/library/node/tags/list?n=10000')
        .reply(200, '', {})
        .get('/library/node/tags/list?n=10000')
        .reply(403);
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'node',
        registryUrls: ['https://docker.io'],
      });
      expect(res).toBeNull();
    });

    it('uses custom registry with registryUrls', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/node/tags/list?n=10000')
        .reply(200, '', {})
        .get('/node/tags/list?n=10000')
        .reply(
          200,
          { tags },
          {
            link: '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next", ',
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
        datasource: DockerDatasource.id,
        packageName: 'node',
        registryUrls: ['https://registry.company.com'],
      };
      const res = await getPkgReleases(config);
      expect(res?.releases).toHaveLength(1);
    });

    it('uses custom registry in packageName', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/node/tags/list?n=10000')
        .reply(200, '', {})
        .get('/node/tags/list?n=10000')
        .reply(200, { tags }, {})
        .get('/')
        .reply(200, '', {})
        .get('/node/manifests/1.0.0')
        .reply(200, '', {});
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res?.releases).toHaveLength(1);
    });

    it('uses quay api', async () => {
      const tags = [{ name: '5.0.12' }];
      httpMock
        .scope('https://quay.io')
        .get(
          '/api/v1/repository/bitnami/redis/tag/?limit=100&page=1&onlyActiveTags=true'
        )
        .reply(200, { tags, has_additional: true })
        .get(
          '/api/v1/repository/bitnami/redis/tag/?limit=100&page=2&onlyActiveTags=true'
        )
        .reply(200, { tags: [], has_additional: false })
        .get('/v2/')
        .reply(200, '', {})
        .get('/v2/bitnami/redis/manifests/5.0.12')
        .reply(200, '', {});
      const config = {
        datasource: DockerDatasource.id,
        packageName: 'bitnami/redis',
        registryUrls: ['https://quay.io'],
      };
      const res = await getPkgReleases(config);
      expect(res?.releases).toHaveLength(1);
    });

    it('uses quay api and test error', async () => {
      httpMock
        .scope('https://quay.io')
        .get(
          '/api/v1/repository/bitnami/redis/tag/?limit=100&page=1&onlyActiveTags=true'
        )
        .reply(500);
      const config = {
        datasource: DockerDatasource.id,
        packageName: 'bitnami/redis',
        registryUrls: ['https://quay.io'],
      };
      await expect(getPkgReleases(config)).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('jfrog artifactory - retry tags for official images by injecting `/library` after repository and before image', async () => {
      const tags1 = [...range(1, 10000)].map((i) => `${i}.0.0`);
      const tags2 = [...range(10000, 10050)].map((i) => `${i}.0.0`);
      httpMock
        .scope('https://org.jfrog.io/v2')
        .get('/virtual-mirror/node/tags/list?n=10000')
        .reply(200, '', { 'x-jfrog-version': 'Artifactory/7.42.2 74202900' })
        .get('/virtual-mirror/node/tags/list?n=10000')
        .reply(404, '', { 'x-jfrog-version': 'Artifactory/7.42.2 74202900' })
        .get('/virtual-mirror/library/node/tags/list?n=10000')
        .reply(200, '', {})
        .get('/virtual-mirror/library/node/tags/list?n=10000')
        // Note the Link is incorrect and should be `</virtual-mirror/library/node/tags/list?n=10000&last=10000>; rel="next", `
        // Artifactory incorrectly returns a next link without the virtual repository name
        // this is due to a bug in Artifactory https://jfrog.atlassian.net/browse/RTFACT-18971
        .reply(
          200,
          { tags: tags1 },
          {
            'x-jfrog-version': 'Artifactory/7.42.2 74202900',
            link: '</library/node/tags/list?n=10000&last=10000>; rel="next", ',
          }
        )
        .get('/virtual-mirror/library/node/tags/list?n=10000&last=10000')
        .reply(
          200,
          { tags: tags2 },
          { 'x-jfrog-version': 'Artifactory/7.42.2 74202900' }
        )
        .get('/')
        .reply(200, '', {})
        .get('/virtual-mirror/node/manifests/10050.0.0')
        .reply(200, '', {});
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'org.jfrog.io/virtual-mirror/node',
      });
      expect(res?.releases).toHaveLength(10050);
    });

    it('uses lower tag limit for ECR deps', async () => {
      httpMock
        .scope(amazonUrl)
        .get('/node/tags/list?n=1000')
        .reply(200, '', {})
        // The  tag limit parameter `n` needs to be limited to 1000 for ECR
        // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
        .get('/node/tags/list?n=1000')
        .reply(200, { tags: ['some'] }, {})
        .get('/')
        .reply(200, '', {})
        .get('/node/manifests/some')
        .reply(200);
      expect(
        await getPkgReleases({
          datasource: DockerDatasource.id,
          packageName: '123456789.dkr.ecr.us-east-1.amazonaws.com/node',
        })
      ).toEqual({
        registryUrl: 'https://123456789.dkr.ecr.us-east-1.amazonaws.com',
        releases: [],
      });
    });

    it('uses lower tag limit for ECR Public deps', async () => {
      httpMock
        .scope('https://public.ecr.aws')
        .get('/v2/amazonlinux/amazonlinux/tags/list?n=1000')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://public.ecr.aws/token",service="public.ecr.aws",scope="aws"',
        })
        .get('/token?service=public.ecr.aws&scope=aws')
        .reply(200, { token: 'test' });
      httpMock
        .scope('https://public.ecr.aws', {
          reqheaders: {
            authorization: 'Bearer test',
          },
        })
        // The  tag limit parameter `n` needs to be limited to 1000 for ECR Public
        // See https://docs.aws.amazon.com/AmazonECRPublic/latest/APIReference/API_DescribeRepositories.html#ecrpublic-DescribeRepositories-request-maxResults
        .get('/v2/amazonlinux/amazonlinux/tags/list?n=1000')
        .reply(200, { tags: ['some'] }, {});

      httpMock
        .scope('https://public.ecr.aws')
        .get('/v2/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://public.ecr.aws/token",service="public.ecr.aws",scope="aws"',
        })
        .get(
          '/token?service=public.ecr.aws&scope=repository:amazonlinux/amazonlinux:pull'
        )
        .reply(200, { token: 'test' });
      httpMock
        .scope('https://public.ecr.aws', {
          reqheaders: {
            authorization: 'Bearer test',
          },
        })
        .get('/v2/amazonlinux/amazonlinux/manifests/some')
        .reply(200);

      expect(
        await getPkgReleases({
          datasource: DockerDatasource.id,
          packageName: 'public.ecr.aws/amazonlinux/amazonlinux',
        })
      ).toEqual({
        registryUrl: 'https://public.ecr.aws',
        releases: [],
      });
    });

    describe('when making requests that interact with an ECR proxy', () => {
      it('resolves requests to ECR proxy', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {
              errors: [
                {
                  code: 'UNSUPPORTED',
                  message:
                    "Invalid parameter at 'maxResults' failed to satisfy constraint: 'Member must have value less than or equal to 1000'",
                },
              ],
            },
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          )
          .get('/')
          .reply(200)
          .get('/node/tags/list?n=1000')
          .reply(200, { tags: ['some'] }, {})
          .get('/node/manifests/some')
          .reply(200, {
            schemaVersion: 2,
            mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
            config: { digest: 'some-config-digest' },
          })
          .get('/')
          .reply(200)
          .get('/node/blobs/some-config-digest')
          .reply(200, {
            config: {
              Labels: {
                'org.opencontainers.image.source':
                  'https://github.com/renovatebot/renovate',
              },
            },
          });
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toEqual({
          registryUrl: 'https://ecr-proxy.company.com',
          releases: [],
          sourceUrl: 'https://github.com/renovatebot/renovate',
        });
      });

      it('returns null when it receives ECR max results error more than once', async () => {
        const maxResultsErrorBody = {
          errors: [
            {
              code: 'UNSUPPORTED',
              message:
                "Invalid parameter at 'maxResults' failed to satisfy constraint: 'Member must have value less than or equal to 1000'",
            },
          ],
        };

        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(405, maxResultsErrorBody, {
            'Docker-Distribution-Api-Version': 'registry/2.0',
          })
          .get('/node/tags/list?n=1000')
          .reply(405, maxResultsErrorBody, {
            'Docker-Distribution-Api-Version': 'registry/2.0',
          });
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the response code is not 405', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            401,
            {
              body: {
                errors: [
                  {
                    code: 'UNSUPPORTED',
                    message:
                      "Invalid parameter at 'maxResults' failed to satisfy constraint: 'Member must have value less than or equal to 1000'",
                  },
                ],
              },
            },
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when no response headers are present', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(405, {
            errors: [
              {
                code: 'UNSUPPORTED',
                message:
                  "Invalid parameter at 'maxResults' failed to satisfy constraint: 'Member must have value less than or equal to 1000'",
              },
            ],
          });
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the expected docker header is missing', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {
              errors: [
                {
                  code: 'UNSUPPORTED',
                  message:
                    "Invalid parameter at 'maxResults' failed to satisfy constraint: 'Member must have value less than or equal to 1000'",
                },
              ],
            },
            {
              'Irrelevant-Header': 'irrelevant-value',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the response body does not contain an errors object', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {},
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the response body does not contain errors', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {
              errors: [],
            },
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the the response errors does not have a message property', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {
              errors: [
                {
                  code: 'UNSUPPORTED',
                },
              ],
            },
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });

      it('returns null when the the error message does not have the expected max results error', async () => {
        httpMock
          .scope('https://ecr-proxy.company.com/v2')
          .get('/node/tags/list?n=10000')
          .reply(200, '', {})
          .get('/node/tags/list?n=10000')
          .reply(
            405,
            {
              errors: [
                {
                  code: 'UNSUPPORTED',
                  message: 'Some unrelated error message',
                },
              ],
            },
            {
              'Docker-Distribution-Api-Version': 'registry/2.0',
            }
          );
        expect(
          await getPkgReleases({
            datasource: DockerDatasource.id,
            packageName: 'ecr-proxy.company.com/node',
          })
        ).toBeNull();
      });
    });

    it('adds library/ prefix for Docker Hub (implicit)', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope(baseUrl)
        .get('/library/node/tags/list?n=10000')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"',
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
        .reply(200, { token: 'test' });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'node',
      });
      expect(res?.releases).toHaveLength(1);
    });

    it('adds library/ prefix for Docker Hub (explicit)', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope(baseUrl)
        .get('/library/node/tags/list?n=10000')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"',
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
        .reply(200, { token: 'test' });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'docker.io/node',
      });
      expect(res?.releases).toHaveLength(1);
    });

    it('adds no library/ prefix for other registries', async () => {
      const tags = ['1.0.0'];
      httpMock
        .scope('https://k8s.gcr.io/v2/')
        .get('/kubernetes-dashboard-amd64/tags/list?n=10000')
        .reply(401, '', {
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
        datasource: DockerDatasource.id,
        packageName: 'k8s.gcr.io/kubernetes-dashboard-amd64',
      });
      expect(res?.releases).toHaveLength(1);
    });

    it('returns null on error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/my/node/tags/list?n=10000')
        .reply(200)
        .get('/my/node/tags/list?n=10000')
        .replyWithError('error');
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'my/node',
      });
      expect(res).toBeNull();
    });

    it('strips trailing slash from registry', async () => {
      httpMock
        .scope(baseUrl)
        .get('/my/node/tags/list?n=10000')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:my/node:pull"',
        })
        .get('/my/node/tags/list?n=10000')
        .reply(200, { tags: ['1.0.0'] }, {})
        .get('/')
        .reply(200)
        .get('/my/node/manifests/1.0.0')
        .reply(200);
      httpMock
        .scope(authUrl)
        .get('/token?service=registry.docker.io&scope=repository:my/node:pull')
        .reply(200, { token: 'some-token ' });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'my/node',
        registryUrls: ['https://index.docker.io/'],
      });
      expect(res?.releases).toHaveLength(1);
    });

    it('returns null if no auth', async () => {
      hostRules.find.mockReturnValue({});
      httpMock
        .scope(baseUrl)
        .get('/library/node/tags/list?n=10000')
        .reply(401, undefined, {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'node',
      });
      expect(res).toBeNull();
    });

    it('supports labels', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(2)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, {
          tags: [
            '2.0.0',
            '2-alpine',
            '1-alpine',
            '1.0.0',
            '1.2.3',
            '1.2.3-alpine',
            'abc',
          ],
        })
        .get('/node/manifests/2-alpine')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(200, {
          config: {
            Labels: {
              'org.opencontainers.image.source':
                'https://github.com/renovatebot/renovate',
              'org.opencontainers.image.revision':
                'ab7ddb5e3c5c3b402acd7c3679d4e415f8092dde',
            },
          },
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.2.3-alpine',
          },
          {
            version: '1.2.3',
          },
          {
            version: '1-alpine',
          },
          {
            version: '2.0.0',
          },
          {
            version: '2-alpine',
          },
        ],
        sourceUrl: 'https://github.com/renovatebot/renovate',
        gitRef: 'ab7ddb5e3c5c3b402acd7c3679d4e415f8092dde',
      });
    });

    it('supports labels - handle missing config prop on blob response', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(2)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, {
          tags: ['2-alpine'],
        })
        .get('/node/manifests/2-alpine')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(200, {}); // DockerDatasource.getLabels() inner response
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [
          {
            version: '2-alpine',
          },
        ],
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.anything(),
        `manifest blob response body missing the "config" property`
      );
      expect(logger.logger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        'Unknown error getting Docker labels'
      );
    });

    it('supports manifest lists', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(3)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['abc'] })
        .get('/node/manifests/abc')
        .reply(200, {
          schemaVersion: 2,
          mediaType:
            'application/vnd.docker.distribution.manifest.list.v2+json',
          manifests: [{ digest: 'some-image-digest' }],
        })
        .get('/node/manifests/some-image-digest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
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
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
        sourceUrl: 'https://github.com/renovatebot/renovate',
      });
    });

    it('ignores empty manifest lists', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType:
            'application/vnd.docker.distribution.manifest.list.v2+json',
          manifests: [],
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
      });
    });

    it('ignores unsupported manifest', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v1+json',
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
      });
    });

    it('ignores unsupported schema version', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {});
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
      });
    });

    it('supports OCI manifests with media type', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(3)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['1'] })
        .get('/node/manifests/1')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.index.v1+json',
          manifests: [{ digest: 'some-image-digest' }],
        })
        .get('/node/manifests/some-image-digest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
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
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [
          {
            version: '1',
          },
        ],
        sourceUrl: 'https://github.com/renovatebot/renovate',
      });
    });

    it('supports OCI manifests without media type', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .times(3)
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['1'] })
        .get('/node/manifests/1')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.index.v1+json',
          manifests: [{ digest: 'some-image-digest' }],
        })
        .get('/node/manifests/some-image-digest')
        .reply(200, {
          schemaVersion: 2,
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
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [
          {
            version: '1',
          },
        ],
        sourceUrl: 'https://github.com/renovatebot/renovate',
      });
    });

    it('ignores empty OCI manifest indexes', async () => {
      httpMock
        .scope('https://registry.company.com/v2')
        .get('/')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200)
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.index.v1+json',
          manifests: [],
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
      });
    });

    it('supports redirect', async () => {
      httpMock
        .scope('https://registry.company.com/v2', {
          badheaders: ['authorization'],
        })
        .get('/')
        .times(2)
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        })
        .get('/node/tags/list?n=10000')
        .reply(401, '', {
          'www-authenticate': 'Basic realm="My Private Docker Registry Server"',
        });
      httpMock
        .scope('https://registry.company.com/v2', {
          reqheaders: {
            authorization: 'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk',
          },
        })
        .get('/node/tags/list?n=10000')
        .reply(200, { tags: ['latest'] })
        .get('/node/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/node/blobs/some-config-digest')
        .reply(302, undefined, {
          location:
            'https://abc.s3.amazon.com/some-config-digest?X-Amz-Algorithm=xxxx',
        });
      httpMock
        .scope('https://abc.s3.amazon.com', { badheaders: ['authorization'] })
        .get('/some-config-digest')
        .query({ 'X-Amz-Algorithm': 'xxxx' })
        .reply(200, {
          config: {},
        });
      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'registry.company.com/node',
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [],
      });
    });

    it('supports ghcr', async () => {
      httpMock
        .scope('https://ghcr.io/v2', {
          badheaders: ['authorization'],
        })
        .get('/')
        .twice()
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:user/image:pull',
        })
        .get('/visualon/drone-git/tags/list?n=10000')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:visualon/drone-git:pull"',
        });
      httpMock
        .scope('https://ghcr.io')
        .get('/token?service=ghcr.io&scope=repository:visualon/drone-git:pull')
        .times(3)
        .reply(200, { token: 'abc' });
      httpMock
        .scope('https://ghcr.io/v2', {
          reqheaders: {
            authorization: 'Bearer abc',
          },
        })
        .get('/visualon/drone-git/tags/list?n=10000')
        .reply(200, { tags: ['latest', '1.0.0'] })
        .get('/visualon/drone-git/manifests/latest')
        .reply(200, {
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: { digest: 'some-config-digest' },
        })
        .get('/visualon/drone-git/blobs/some-config-digest')
        .reply(200, {
          config: {
            Labels: {
              'org.opencontainers.image.source':
                'https://github.com/visualon/drone-git',
            },
          },
        });

      const res = await getPkgReleases({
        datasource: DockerDatasource.id,
        packageName: 'ghcr.io/visualon/drone-git',
      });
      expect(res).toEqual({
        registryUrl: 'https://ghcr.io',
        sourceUrl: 'https://github.com/visualon/drone-git',
        releases: [{ version: '1.0.0' }],
      });
    });
  });
});
