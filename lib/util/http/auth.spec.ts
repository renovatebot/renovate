import { NormalizedOptions } from 'got';
import { getName, partial } from '../../../test/util';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { applyAuthorization, removeAuthorization } from './auth';
import { GotOptions } from './types';

describe(getName(__filename), () => {
  describe('applyAuthorization', () => {
    it('does nothing', () => {
      const opts: GotOptions = {
        headers: { authorization: 'token' },
        hostname: 'amazon.com',
        href: 'https://amazon.com',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "headers": Object {
            "authorization": "token",
          },
          "hostname": "amazon.com",
          "href": "https://amazon.com",
        }
      `);
    });

    it('gitea password', () => {
      const opts: GotOptions = {
        headers: {},
        hostType: PLATFORM_TYPE_GITEA,
        password: 'XXXX',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "headers": Object {
            "authorization": "Basic OlhYWFg=",
          },
          "hostType": "gitea",
          "password": "XXXX",
        }
      `);
    });

    it('gittea token', () => {
      const opts: GotOptions = {
        headers: {},
        token: 'XXXX',
        hostType: PLATFORM_TYPE_GITEA,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "headers": Object {
            "authorization": "token XXXX",
          },
          "hostType": "gitea",
          "token": "XXXX",
        }
      `);
    });

    it(`gitlab personal access token`, () => {
      const opts: GotOptions = {
        headers: {},
        // Personal Access Token is exactly 20 characters long
        token: '01234567890123456789',
        hostType: PLATFORM_TYPE_GITLAB,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "headers": Object {
            "Private-token": "01234567890123456789",
          },
          "hostType": "gitlab",
          "token": "01234567890123456789",
        }
      `);
    });

    it(`gitlab oauth token`, () => {
      const opts: GotOptions = {
        headers: {},
        token:
          'a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863',
        hostType: PLATFORM_TYPE_GITLAB,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "headers": Object {
            "authorization": "Bearer a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863",
          },
          "hostType": "gitlab",
          "token": "a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863",
        }
      `);
    });
  });

  it(`npm basic token`, () => {
    const opts: GotOptions = {
      headers: {},
      token: 'a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863',
      hostType: 'npm',
      context: {
        authType: 'Basic',
      },
    };

    applyAuthorization(opts);

    expect(opts).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "authType": "Basic",
        },
        "headers": Object {
          "authorization": "Basic a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863",
        },
        "hostType": "npm",
        "token": "a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01e863",
      }
    `);
  });

  describe('removeAuthorization', () => {
    it('no authorization', () => {
      const opts = partial<NormalizedOptions>({
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        search: 'something X-Amz-Algorithm something',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        search: 'something X-Amz-Algorithm something',
      });
    });

    it('Amazon', () => {
      const opts = partial<NormalizedOptions>({
        password: 'auth',
        headers: {
          authorization: 'auth',
        },
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        search: 'something X-Amz-Algorithm something',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        headers: {},
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        search: 'something X-Amz-Algorithm something',
      });
    });

    it('Amazon ports', () => {
      const opts = partial<NormalizedOptions>({
        password: 'auth',
        headers: {
          authorization: 'auth',
        },
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        port: 3000,
        search: 'something X-Amz-Algorithm something',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        headers: {},
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        search: 'something X-Amz-Algorithm something',
      });
    });

    it('Azure blob', () => {
      const opts = partial<NormalizedOptions>({
        password: 'auth',
        headers: {
          authorization: 'auth',
        },
        hostname: 'store123.blob.core.windows.net',
        href:
          'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        headers: {},
        hostname: 'store123.blob.core.windows.net',
        href:
          'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
      });
    });

    it('keep auth', () => {
      const opts = partial<NormalizedOptions>({
        password: 'auth',
        headers: {
          authorization: 'auth',
        },
        hostname: 'renovate.com',
        href: 'https://renovate.com',
        search: 'something',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        password: 'auth',
        headers: {
          authorization: 'auth',
        },
        hostname: 'renovate.com',
        href: 'https://renovate.com',
        search: 'something',
      });
    });
  });
});
