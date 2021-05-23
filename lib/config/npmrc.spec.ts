import { getName } from '../../test/util';
import { getConfigFromNpmrc } from './npmrc';

describe(getName(), () => {
  describe('getConfigFromNpmrc()', () => {
    it('works with empty string', () => {
      expect(getConfigFromNpmrc()).toEqual({});
    });
    it('supports naked _auth', () => {
      expect(getConfigFromNpmrc('_auth=some-token')).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "authType": "Basic",
              "hostType": "npm",
              "token": "some-token",
            },
          ],
        }
      `);
    });
    it('supports naked registry and _authToken', () => {
      expect(
        getConfigFromNpmrc(
          'registry=https://corp.registry\n_authToken=some-token'
        )
      ).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "hostType": "npm",
              "token": "some-token",
            },
          ],
          "packageRules": Array [
            Object {
              "matchDatasources": Array [
                "npm",
              ],
              "registryUrls": Array [
                "https://corp.registry",
              ],
            },
          ],
        }
      `);
    });
    it('supports scoped registries', () => {
      expect(
        getConfigFromNpmrc(
          '@org:registry=https://corp.registry\n//corp.registry:_authToken=some-token\nhttps://other.registry:_auth=other-token\n'
        )
      ).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "hostType": "npm",
              "matchHost": "corp.registry",
              "token": "some-token",
            },
            Object {
              "authType": "Basic",
              "hostType": "npm",
              "matchHost": "other.registry",
              "token": "other-token",
            },
          ],
          "packageRules": Array [
            Object {
              "matchDatasources": Array [
                "npm",
              ],
              "matchPackagePrefixes": Array [
                "@org",
              ],
              "registryUrls": Array [
                "https://corp.registry",
              ],
            },
          ],
        }
      `);
    });
  });
});
