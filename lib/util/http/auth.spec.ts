import { applyAuthorization } from './auth.ts';
import type { GotOptions } from './types.ts';

describe('util/http/auth', () => {
  describe('applyAuthorization', () => {
    it('does nothing', () => {
      const opts: GotOptions = {
        headers: { authorization: 'token' },
        url: 'https://amazon.com',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "authorization": "token",
          },
          "url": "https://amazon.com",
        }
      `);
    });

    it('gitea password', () => {
      const opts: GotOptions = {
        headers: {},
        hostType: 'gitea',
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
        hostType: 'gitea',
      };

      applyAuthorization(opts);

      expect(opts).toMatchInlineSnapshot(`
        {
          "headers": {
            "authorization": "Bearer XXXX",
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
        hostType: 'github',
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
        hostType: 'gitlab',
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
        hostType: 'gitlab',
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

    it(`honors authType`, () => {
      const opts: GotOptions = {
        headers: {},
        token: 'test',
        context: {
          authType: 'Bearer',
        },
        hostType: 'custom',
      };

      applyAuthorization(opts);

      expect(opts).toEqual({
        context: {
          authType: 'Bearer',
        },
        headers: {
          authorization: 'Bearer test',
        },
        hostType: 'custom',
        token: 'test',
      });
    });
  });
});
