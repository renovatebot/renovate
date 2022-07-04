import { convertYarnrcYmlToNpmrc } from './yarnrc';

describe('modules/datasource/npm/yarnrc', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('convertYarnrcYmlToNpmrc()', () => {
    it('handles registry url', () => {
      const res = convertYarnrcYmlToNpmrc(
        'npmRegistryServer: https://private.example.com/npm'
      );

      expect(res).toBe('registry=https://private.example.com/npm');
    });

    it('handles registry url and auth token', () => {
      const res = convertYarnrcYmlToNpmrc(
        `npmAuthToken: foobar
npmRegistryServer: https://private.example.com/npm`
      );

      expect(res).toBe(
        `registry=https://private.example.com/npm
https://private.example.com/npm:_authToken=foobar`
      );
    });

    it('handles registry url and auth token and always auth', () => {
      const res = convertYarnrcYmlToNpmrc(
        `npmAlwaysAuth: true
npmAuthToken: foobar
npmRegistryServer: https://private.example.com/npm`
      );

      expect(res).toBe(
        `registry=https://private.example.com/npm
https://private.example.com/npm:_authToken=foobar
https://private.example.com/npm:_always-auth=true`
      );
    });

    it('handles scoped registry url', () => {
      const res = convertYarnrcYmlToNpmrc(
        `npmRegistryServer: https://private.example.com/npm-default
npmScopes:
  foo:
    npmRegistryServer: https://private.example.com/npm-foo`
      );

      expect(res).toBe(
        `registry=https://private.example.com/npm-default
@foo:registry=https://private.example.com/npm-foo`
      );
    });

    it('handles all options', () => {
      const res = convertYarnrcYmlToNpmrc(
        `npmAlwaysAuth: true
npmAuthToken: default-token
npmRegistryServer: https://private.example.com/npm-default
npmScopes:
  foo:
    npmAlwaysAuth: true
    npmAuthToken: foo-token
    npmRegistryServer: https://private.example.com/npm-foo
  bar:
    npmAlwaysAuth: true
    npmAuthToken: bar-token
    npmRegistryServer: https://private.example.com/npm-bar`
      );

      expect(res).toBe(
        `registry=https://private.example.com/npm-default
https://private.example.com/npm-default:_authToken=default-token
https://private.example.com/npm-default:_always-auth=true
@foo:registry=https://private.example.com/npm-foo
https://private.example.com/npm-foo:_authToken=foo-token
https://private.example.com/npm-foo:_always-auth=true
@bar:registry=https://private.example.com/npm-bar
https://private.example.com/npm-bar:_authToken=bar-token
https://private.example.com/npm-bar:_always-auth=true`
      );
    });
  });
});
