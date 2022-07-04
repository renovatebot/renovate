import { convertYarnrcYmlToRules } from './yarnrc';

describe('modules/datasource/npm/yarnrc', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('convertYarnrcYmlToRules()', () => {
    it('handles registry url', () => {
      const res = convertYarnrcYmlToRules(
        'npmRegistryServer: https://private.example.com/npm'
      );

      expect(res).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "hostType": "npm",
              "matchHost": "https://private.example.com/npm",
            },
          ],
          "packageRules": Array [],
        }
      `);
    });

    it('handles registry url and auth token', () => {
      const res = convertYarnrcYmlToRules(
        `npmAuthToken: foobar
npmRegistryServer: https://private.example.com/npm`
      );

      expect(res).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "hostType": "npm",
              "matchHost": "https://private.example.com/npm",
              "token": "foobar",
            },
          ],
          "packageRules": Array [],
        }
      `);
    });

    it('handles scoped options', () => {
      const res = convertYarnrcYmlToRules(
        `npmAuthToken: default-token
npmRegistryServer: https://private.example.com/npm-default
npmScopes:
  foo:
    npmAuthToken: foo-token
    npmRegistryServer: https://private.example.com/npm-foo
  bar:
    npmAuthToken: bar-token
    npmRegistryServer: https://private.example.com/npm-bar`
      );

      expect(res).toMatchInlineSnapshot(`
        Object {
          "hostRules": Array [
            Object {
              "hostType": "npm",
              "matchHost": "https://private.example.com/npm-default",
              "token": "default-token",
            },
            Object {
              "hostType": "npm",
              "matchHost": "https://private.example.com/npm-foo",
              "token": "foo-token",
            },
            Object {
              "hostType": "npm",
              "matchHost": "https://private.example.com/npm-bar",
              "token": "bar-token",
            },
          ],
          "packageRules": Array [
            Object {
              "matchDatasources": Array [
                "npm",
              ],
              "matchPackagePrefixes": Array [
                "foo/",
              ],
              "registryUrls": Array [
                "https://private.example.com/npm-foo",
              ],
            },
            Object {
              "matchDatasources": Array [
                "npm",
              ],
              "matchPackagePrefixes": Array [
                "bar/",
              ],
              "registryUrls": Array [
                "https://private.example.com/npm-bar",
              ],
            },
          ],
        }
      `);
    });
  });
});
