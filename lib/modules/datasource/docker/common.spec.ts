import { mockDeep } from 'jest-mock-extended';
import * as httpMock from '../../../../test/http-mock';
import { mocked, partial } from '../../../../test/util';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import * as _hostRules from '../../../util/host-rules';
import { Http } from '../../../util/http';
import {
  dockerDatasourceId,
  findHelmSourceUrl,
  findLatestStable,
  getAuthHeaders,
  getRegistryRepository,
} from './common';
import type { OciHelmConfig } from './schema';

const hostRules = mocked(_hostRules);

const http = new Http(dockerDatasourceId);

jest.mock('../../../util/host-rules', () => mockDeep());

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
      hostRules.find.mockReturnValueOnce({ insecureRegistry: true });
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
    ])('($name, $url)', ({ name, url, res }) => {
      expect(getRegistryRepository(name, url)).toStrictEqual(res);
    });
  });

  describe('getAuthHeaders', () => {
    beforeEach(() => {
      hostRules.find.mockReturnValue({
        username: 'some-username',
        password: 'some-password',
      });
      hostRules.hosts.mockReturnValue([]);
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

    it('returns "authType token" if both provided', async () => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', { 'www-authenticate': 'Authenticate you must' });
      hostRules.hosts.mockReturnValue([]);
      hostRules.find.mockReturnValue({
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
      hostRules.hosts.mockReturnValue([]);
      hostRules.find.mockReturnValue({
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
      hostRules.hosts.mockReturnValue([]);
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
