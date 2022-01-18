import * as httpMock from '../../../test/http-mock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as dockerCommon from './common';
import { isECRMaxResultsError } from './common';

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
  describe('isECRMaxResultsError', () => {
    it('returns true when the error matches the maxResults error', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'foo',
          },
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
      };
      expect(isECRMaxResultsError(err)).toBeTrue();
    });

    it('returns false when the error does not contain a response object', () => {
      const err = {
        // no response object
      };
      expect(isECRMaxResultsError(err)).toBeFalse();
    });

    it('returns false when the response code is not 405', () => {
      const err = {
        response: {
          statusCode: 200,
          headers: {
            'docker-distribution-api-version': 'foo',
          },
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
      };
      expect(isECRMaxResultsError(err)).toBeFalse();
    });

    it('returns undefined when no response headers are present', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {},
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
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns undefined when the expected docker header is missing', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {},
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
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns undefined when the error response does not contain a body', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'registry/2.0',
          },
        },
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns undefined when the response body does not contain an errors object', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'registry/2.0',
          },
          body: {},
        },
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns undefined when the response body does not contain errors', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'registry/2.0',
          },
          body: {
            errors: [],
          },
        },
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns undefined when the the response errors does not have a `message` property', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'registry/2.0',
          },
          body: {
            errors: [
              {
                code: 'UNSUPPORTED',
              },
            ],
          },
        },
      };
      expect(isECRMaxResultsError(err)).toBeUndefined();
    });

    it('returns false when the the error message does not have the expected max results error', () => {
      const err = {
        response: {
          statusCode: 405,
          headers: {
            'docker-distribution-api-version': 'registry/2.0',
          },
          body: {
            errors: [
              {
                code: 'UNSUPPORTED',
                message: 'Some unrelated error message',
              },
            ],
          },
        },
      };
      expect(isECRMaxResultsError(err)).toBeFalse();
    });
  });
});
