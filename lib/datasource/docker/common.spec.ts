import * as httpMock from '../../../test/http-mock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as dockerCommon from './common';

const hostRules = mocked(_hostRules);

jest.mock('@aws-sdk/client-ecr');
jest.mock('../../util/host-rules');

describe('datasource/docker/common', () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getRegistryRepository', () => {
    it('handles local registries', () => {
      const res = dockerCommon.getRegistryRepository(
        'registry:5000/org/package',
        'https://index.docker.io'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "org/package",
          "registryHost": "https://registry:5000",
        }
      `);
    });
    it('supports registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'https://my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "https://my.local.registry",
        }
      `);
    });
    it('supports http registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'http://my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "http://my.local.registry",
        }
      `);
    });
    it('supports schemeless registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "https://my.local.registry",
        }
      `);
    });
  });
  describe('getAuthHeaders', () => {
    beforeEach(() => {
      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', { 'www-authenticate': 'Authenticate you must' });
      hostRules.hosts.mockReturnValue([]);
    });

    it('returns "authType token" if both provided', async () => {
      hostRules.find.mockReturnValue({
        authType: 'some-authType',
        token: 'some-token',
      });

      const headers = await dockerCommon.getAuthHeaders(
        'https://my.local.registry',
        'https://my.local.registry/prefix'
      );

      expect(headers).toMatchInlineSnapshot(`
Object {
  "authorization": "some-authType some-token",
}
`);
    });

    it('returns "Bearer token" if only token provided', async () => {
      hostRules.find.mockReturnValue({
        token: 'some-token',
      });

      const headers = await dockerCommon.getAuthHeaders(
        'https://my.local.registry',
        'https://my.local.registry/prefix'
      );

      expect(headers).toMatchInlineSnapshot(`
Object {
  "authorization": "Bearer some-token",
}
`);
    });

    it('fails', async () => {
      httpMock.clear(false);

      httpMock
        .scope('https://my.local.registry')
        .get('/v2/', undefined, { badheaders: ['authorization'] })
        .reply(401, '', {});

      const headers = await dockerCommon.getAuthHeaders(
        'https://my.local.registry',
        'https://my.local.registry/prefix'
      );

      expect(headers).toBeNull();
    });
  });
});
