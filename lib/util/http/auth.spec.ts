import type { NormalizedOptions } from 'got';
import { partial } from '../../../test/util';
import { PlatformId } from '../../constants';
import { applyAuthorization, removeAuthorization } from './auth';
import type { GotOptions } from './types';

describe('util/http/auth', () => {
  describe('applyAuthorization', () => {
    it('does nothing', () => {
      const opts: GotOptions = {
        headers: { authorization: 'token' },
        hostname: 'amazon.com',
        href: 'https://amazon.com',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
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
        hostType: PlatformId.Gitea,
        password: 'XXXX',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
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
        hostType: PlatformId.Gitea,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "authorization": "token XXXX",
          },
          "hostType": "gitea",
          "token": "XXXX",
        }
      `);
    });

    it('github token', () => {
      const opts: GotOptions = {
        headers: {},
        token: 'XXX',
        hostType: PlatformId.Github,
      };

      applyAuthorization(opts);

      expect(opts).toEqual({
        headers: {
          authorization: 'token XXX',
        },
        hostType: 'github',
        token: 'XXX',
      });
    });

    it('github token for datasource using github api', () => {
      const opts: GotOptions = {
        headers: {},
        token: 'ZZZZ',
        hostType: 'github-releases',
      };
      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "authorization": "token ZZZZ",
          },
          "hostType": "github-releases",
          "token": "ZZZZ",
        }
      `);
    });

    it(`gitlab personal access token`, () => {
      const opts: GotOptions = {
        headers: {},
        // Personal Access Token is exactly 20 characters long
        token: '0123456789012345test',
        hostType: PlatformId.Gitlab,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "Private-token": "0123456789012345test",
          },
          "hostType": "gitlab",
          "token": "0123456789012345test",
        }
      `);
    });

    it(`gitlab oauth token`, () => {
      const opts: GotOptions = {
        headers: {},
        token:
          'a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01test',
        hostType: PlatformId.Gitlab,
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "authorization": "Bearer a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01test",
          },
          "hostType": "gitlab",
          "token": "a40bdd925a0c0b9c4cdd19d101c0df3b2bcd063ab7ad6706f03bcffcec01test",
        }
      `);
    });

    it(`npm basic token`, () => {
      const opts: GotOptions = {
        headers: {},
        token: 'test',
        hostType: 'npm',
        context: {
          authType: 'Basic',
        },
      };

      applyAuthorization(opts);

      expect(opts).toEqual({
        context: {
          authType: 'Basic',
        },
        headers: {
          authorization: 'Basic test',
        },
        hostType: 'npm',
        token: 'test',
      });
    });

    it(`bare token`, () => {
      const opts: GotOptions = {
        headers: {},
        token: 'test',
        context: {
          authType: 'Token-Only',
        },
      };

      applyAuthorization(opts);

      expect(opts).toEqual({
        context: {
          authType: 'Token-Only',
        },
        headers: {
          authorization: 'test',
        },
        token: 'test',
      });
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
        href: 'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
      });

      removeAuthorization(opts);

      expect(opts).toEqual({
        headers: {},
        hostname: 'store123.blob.core.windows.net',
        href: 'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
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
