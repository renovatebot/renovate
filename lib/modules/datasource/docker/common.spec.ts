import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages.ts';
import { Http } from '../../../util/http/index.ts';
import {
  dockerDatasourceId,
  findHelmSourceUrl,
  findLatestStable,
  getAuthHeaders,
  getRegistryRepository,
} from './common.ts';
import type { OciHelmConfig } from './schema.ts';

const http = new Http(dockerDatasourceId);

describe('modules/datasource/docker/common', () => {
  describe('getRegistryRepository', () => {
    it('handles local registries', () => {
      const res = getRegistryRepository(
        'registry:5000/org/package',
        'https://index.docker.io',
      );
      expect(res).toStrictEqual({
        dockerRepository: 'org/package',
        registryHost: 'https://registry:5000',
      });
    });

    it('supports registryUrls', () => {
      const res = getRegistryRepository(
        'my.local.registry/prefix/image',
        'https://my.local.registry/prefix',
      );
      expect(res).toStrictEqual({
        dockerRepository: 'prefix/image',
        registryHost: 'https://my.local.registry',
      });
    });

    it('supports http registryUrls', () => {
      const res = getRegistryRepository(
        'my.local.registry/prefix/image',
        'http://my.local.registry/prefix',
      );
      expect(res).toStrictEqual({
        dockerRepository: 'prefix/image',
        registryHost: 'http://my.local.registry',
      });
    });

    it('supports schemeless registryUrls', () => {
      const res = getRegistryRepository(
        'my.local.registry/prefix/image',
        'my.local.registry/prefix',
      );
      expect(res).toStrictEqual({
        dockerRepository: 'prefix/image',
        registryHost: 'https://my.local.registry',
      });
    });

    it('supports insecure registryUrls', () => {
      hostRules.add({ insecureRegistry: true });
      const res = getRegistryRepository(
        'prefix/image',
        'my.local.registry/prefix',
      );
      expect(res).toStrictEqual({
        dockerRepository: 'prefix/prefix/image',
        registryHost: 'http://my.local.registry',
      });
    });

    it.each([
      {
        name: 'strimzi-kafka-operator',
        url: 'https://quay.io/strimzi-helm/',
        res: {
          dockerRepository: 'strimzi-helm/strimzi-kafka-operator',
          registryHost: 'https://quay.io',
        },
      },
      {
        name: 'strimzi-kafka-operator',
        url: 'https://docker.io/strimzi-helm/',
        res: {
          dockerRepository: 'strimzi-helm/strimzi-kafka-operator',
          registryHost: 'https://index.docker.io',
        },
      },
      {
        name: 'nginx',
        url: 'https://docker.io',
        res: {
          dockerRepository: 'library/nginx',
          registryHost: 'https://index.docker.io',
        },
      },
      {
        name: 'registry-1.docker.io/bitnamicharts/cert-manager',
        url: 'https://index.docker.io',
        res: {
          dockerRepository: 'bitnamicharts/cert-manager',
          registryHost: 'https://index.docker.io',
        },
      },
    ])('($name, $url)', ({ name, url, res }) => {
      expect(getRegistryRepository(name, url)).toStrictEqual(res);
    });

    it('returns raw registryHost and dockerRepository when fullUrl is invalid', () => {
      // 'https://[/prefix' is a syntactically invalid URL (unclosed bracket)
      const res = getRegistryRepository('[/prefix/image', 'https://[/prefix');
      expect(res).toStrictEqual({
        registryHost: 'https://[/prefix',
        dockerRepository: 'image',
      });
    });
  });

  describe('getAuthHeaders', () => {
    beforeEach(() => {
      hostRules.add({
        username: 'some-username',
        password: 'some-password',
      });
    });

    it('throw page not found exception', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/repo/tags/list?n=1000')
        .reply(404, {});

      await expect(
        getAuthHeaders(
          http,
          'https://my.local.registry',
          'repo',
          'https://my.local.registry/v2/repo/tags/list?n=1000',
        ),
      ).rejects.toThrow(PAGE_NOT_FOUND_ERROR);
    });

    it('falls back to base /v2/ auth probe when tags URL returns 405 ECR maxResults error', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/repo/tags/list?n=10000')
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
          { 'docker-distribution-api-version': 'registry/2.0' },
        )
        .get('/v2/')
        .reply(200, '');

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'repo',
        'https://my.local.registry/v2/repo/tags/list?n=10000',
      );

      expect(headers).toEqual({});
    });

    it('falls back to base /v2/ auth probe and negotiates token when 405 ECR maxResults error is received', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/repo/tags/list?n=10000')
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
          { 'docker-distribution-api-version': 'registry/2.0' },
        )
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://my.local.registry/oauth2/token",service="my.local.registry"',
        })
        .get(
          '/oauth2/token?service=my.local.registry&scope=repository:repo:pull',
        )
        .reply(200, { token: 'abc' });

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'repo',
        'https://my.local.registry/v2/repo/tags/list?n=10000',
      );

      expect(headers).toEqual({ authorization: 'Bearer abc' });
    });

    it('returns "authType token" if both provided', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', { 'www-authenticate': 'Authenticate you must' });
      hostRules.clear();
      hostRules.add({
        authType: 'some-authType',
        token: 'some-token',
      });

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'https://my.local.registry/prefix',
      );

      // do not inline, otherwise we get false positive from codeql
      expect(headers).toMatchInlineSnapshot(`
        {
          "authorization": "some-authType some-token",
        }
      `);
    });

    it('returns "Bearer token" if only token provided', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', { 'www-authenticate': 'Authenticate you must' });
      hostRules.clear();
      hostRules.add({
        token: 'some-token',
      });

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'https://my.local.registry/prefix',
      );

      // do not inline, otherwise we get false positive from codeql
      expect(headers).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer some-token",
        }
      `);
    });

    it('fails', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', { 'www-authenticate': 'Authenticate you must' });
      httpMock.clear(false);

      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', {});

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'https://my.local.registry/prefix',
      );

      expect(headers).toBeNull();
    });

    it('use resources URL and resolve scope in www-authenticate header', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/my/node/resource')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://my.local.registry/oauth2/token",service="my.local.registry",scope="repository:my/node:whatever"',
        })
        .get(
          '/oauth2/token?service=my.local.registry&scope=repository:my/node:whatever',
        )
        .reply(200, { token: 'some-token' });

      const headers = await getAuthHeaders(
        http,
        'https://my.local.registry',
        'my/node/prefix',
        'https://my.local.registry/v2/my/node/resource',
      );

      // do not inline, otherwise we get false positive from codeql
      expect(headers).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer some-token",
        }
      `);
    });

    it('supports multiple challenges in www-authenticate header', async () => {
      httpMock
        .scope('https://codeberg.org')
        .get('/v2/')
        .reply(401, '', {
          'www-authenticate':
            'Bearer realm="https://codeberg.org/v2/token",service="container_registry",scope="*",Basic realm="https://codeberg.org/v2",service="container_registry",scope="*"',
        })
        .get(
          '/v2/token?service=container_registry&scope=repository:my/node/prefix:pull',
        )
        .reply(200, { token: 'abc' });

      const headers = await getAuthHeaders(
        http,
        'https://codeberg.org',
        'my/node/prefix',
      );

      // do not inline, otherwise we get false positive from codeql
      expect(headers).toMatchInlineSnapshot(`
        {
          "authorization": "Bearer abc",
        }
      `);
    });
  });

  it('findLatestStable works', () => {
    expect(findLatestStable([])).toBeNull();
  });

  it('findHelmSourceUrl works', () => {
    expect(
      findHelmSourceUrl(
        partial<OciHelmConfig>({
          home: 'https://github.com/bitnami/charts/tree/main/bitnami/harbor',
        }),
      ),
    ).toBe('https://github.com/bitnami/charts/tree/main/bitnami/harbor');

    expect(findHelmSourceUrl(partial<OciHelmConfig>({}))).toBeNull();

    expect(
      findHelmSourceUrl(
        partial<OciHelmConfig>({
          sources: [
            'https://github.com/bitnami/charts/tree/main/bitnami/harbor',
          ],
        }),
      ),
    ).toBe('https://github.com/bitnami/charts/tree/main/bitnami/harbor');

    expect(
      findHelmSourceUrl(
        partial<OciHelmConfig>({
          sources: ['https://some.test'],
        }),
      ),
    ).toBe('https://some.test');
  });
});
