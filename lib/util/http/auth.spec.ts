import { NormalizedOptions } from 'got';
import { getName, partial } from '../../../test/util';
import { PLATFORM_TYPE_GITEA } from '../../constants/platforms';
import { applyAuthorization, removeAuthorization } from './auth';

describe(getName(__filename), () => {
  describe('applyAuthorization', () => {
    it('does nothing', () => {
      const opts = {
        hostname: 'amazon.com',
        href: 'https://amazon.com',
        auth: 'XXXX',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        Object {
          "auth": "XXXX",
          "hostname": "amazon.com",
          "href": "https://amazon.com",
        }
      `);
    });

    it('gittea token', () => {
      const opts = {
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
        auth: 'auth',
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
