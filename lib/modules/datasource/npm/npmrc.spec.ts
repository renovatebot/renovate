import ini from 'ini';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _sanitize from '../../../util/sanitize';
import {
  convertNpmrcToRules,
  getMatchHostFromNpmrcHost,
  setNpmrc,
} from './npmrc';

jest.mock('../../../util/sanitize');

const sanitize = mocked(_sanitize);

describe('modules/datasource/npm/npmrc', () => {
  beforeEach(() => {
    setNpmrc('');
    GlobalConfig.reset();
  });

  describe('getMatchHostFromNpmrcHost()', () => {
    it('parses //host', () => {
      expect(getMatchHostFromNpmrcHost('//registry.npmjs.org')).toBe(
        'registry.npmjs.org',
      );
    });

    it('parses //host/path', () => {
      expect(
        getMatchHostFromNpmrcHost('//registry.company.com/some/path'),
      ).toBe('https://registry.company.com/some/path');
    });

    it('parses https://host', () => {
      expect(getMatchHostFromNpmrcHost('https://registry.npmjs.org')).toBe(
        'https://registry.npmjs.org',
      );
    });
  });

  describe('convertNpmrcToRules()', () => {
    it('rejects invalid registries', () => {
      const res = convertNpmrcToRules(
        ini.parse('registry=1\n@scope:registry=2\n'),
      );
      expect(res.hostRules).toHaveLength(0);
      expect(res.packageRules).toHaveLength(0);
    });

    it('handles naked auth', () => {
      expect(convertNpmrcToRules(ini.parse('_auth=abc123\n')))
        .toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "authType": "Basic",
              "hostType": "npm",
              "token": "abc123",
            },
          ],
          "packageRules": [],
        }
      `);
    });

    it('handles host, path and auth', () => {
      expect(
        convertNpmrcToRules(ini.parse('//some.test/with/path:_auth=abc123')),
      ).toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "authType": "Basic",
              "hostType": "npm",
              "matchHost": "https://some.test/with/path",
              "token": "abc123",
            },
          ],
          "packageRules": [],
        }
      `);
    });

    it('handles host, path, port and auth', () => {
      expect(
        convertNpmrcToRules(
          ini.parse('//some.test:8080/with/path:_authToken=abc123'),
        ),
      ).toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "hostType": "npm",
              "matchHost": "https://some.test:8080/with/path",
              "token": "abc123",
            },
          ],
          "packageRules": [],
        }
      `);
    });

    it('handles naked authToken', () => {
      expect(convertNpmrcToRules(ini.parse('_authToken=abc123\n')))
        .toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "hostType": "npm",
              "token": "abc123",
            },
          ],
          "packageRules": [],
        }
      `);
    });

    it('handles host authToken', () => {
      expect(
        convertNpmrcToRules(
          ini.parse(
            '@fontawesome:registry=https://npm.fontawesome.com/\n//npm.fontawesome.com/:_authToken=abc123',
          ),
        ),
      ).toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "hostType": "npm",
              "matchHost": "https://npm.fontawesome.com/",
              "token": "abc123",
            },
          ],
          "packageRules": [
            {
              "matchDatasources": [
                "npm",
              ],
              "matchPackagePrefixes": [
                "@fontawesome/",
              ],
              "registryUrls": [
                "https://npm.fontawesome.com/",
              ],
            },
          ],
        }
      `);
    });

    it('handles username and _password', () => {
      expect(
        convertNpmrcToRules(
          ini.parse(
            `//my-registry.example.com/npm-private/:_password=dGVzdA==\n//my-registry.example.com/npm-private/:username=bot\n//my-registry.example.com/npm-private/:always-auth=true`,
          ),
        ),
      ).toMatchInlineSnapshot(`
        {
          "hostRules": [
            {
              "hostType": "npm",
              "matchHost": "https://my-registry.example.com/npm-private/",
              "password": "test",
              "username": "bot",
            },
          ],
          "packageRules": [],
        }
      `);
    });
  });

  it('sanitize _auth', () => {
    setNpmrc('_auth=test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(1);
  });

  it('sanitize _authtoken', () => {
    setNpmrc('//registry.test.com:_authToken=test\n_authToken=${NPM_TOKEN}');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(2);
  });

  it('sanitize _password', () => {
    setNpmrc(
      `registry=https://test.org\n//test.org/:username=test\n//test.org/:_password=dGVzdA==`,
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenNthCalledWith(1, 'test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenNthCalledWith(
      2,
      'dGVzdDp0ZXN0',
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(2);
  });

  it('sanitize _authtoken with high trust', () => {
    GlobalConfig.set({ exposeAllEnv: true });
    process.env.TEST_TOKEN = 'test';
    setNpmrc(
      '//registry.test.com:_authToken=${TEST_TOKEN}\n_authToken=\nregistry=http://localhost',
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(1);
  });

  it('ignores localhost', () => {
    setNpmrc(`registry=http://localhost`);
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(0);
  });
});
