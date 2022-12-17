import * as hostRules from '../../../../util/host-rules';
import { processHostRules } from './rules';

describe('modules/manager/npm/post-update/rules', () => {
  describe('processHostRules()', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it('returns empty if no rules', () => {
      const res = processHostRules();
      expect(res.additionalNpmrcContent).toHaveLength(0);
      expect(res.additionalYarnRcYml).toBeUndefined();
    });

    it('returns empty if no resolvedHost', () => {
      hostRules.add({ hostType: 'npm', token: '123test' });
      const res = processHostRules();
      expect(res.additionalNpmrcContent).toHaveLength(0);
      expect(res.additionalYarnRcYml).toBeUndefined();
    });

    it('returns rules content', () => {
      hostRules.add({
        hostType: 'npm',
        matchHost: 'registry.company.com',
        username: 'user123',
        password: 'pass123',
      });
      const res = processHostRules();
      expect(res).toMatchInlineSnapshot(
        {
          additionalNpmrcContent: [
            '//registry.company.com/:username=user123',
            '//registry.company.com/:_password=cGFzczEyMw==',
          ],

          additionalYarnRcYml: {
            npmRegistries: {
              '//registry.company.com/': {
                npmAuthIdent: 'user123:pass123',
              },
            },
          },
        },
        `
        {
          "additionalNpmrcContent": [
            "//registry.company.com/:username=user123",
            "//registry.company.com/:_password=cGFzczEyMw==",
          ],
          "additionalYarnRcYml": {
            "npmRegistries": {
              "//registry.company.com/": {
                "npmAuthIdent": "user123:pass123",
              },
            },
          },
        }
      `
      );
    });

    it('returns mixed rules content', () => {
      hostRules.add({
        hostType: 'npm',
        matchHost: 'https://registry.npmjs.org',
        token: 'token123',
      });
      hostRules.add({
        hostType: 'npm',
        matchHost: 'https://registry.other.org',
        authType: 'Basic',
        token: 'basictoken123',
      });
      hostRules.add({
        hostType: 'npm',
        matchHost: 'registry.company.com',
        username: 'user123',
        password: 'pass123',
      });
      const res = processHostRules();
      expect(res).toMatchInlineSnapshot(
        {
          additionalNpmrcContent: [
            '//registry.npmjs.org:_authToken=token123',
            '//registry.other.org:_auth=basictoken123',
            '//registry.company.com/:username=user123',
            '//registry.company.com/:_password=cGFzczEyMw==',
          ],

          additionalYarnRcYml: {
            npmRegistries: {
              '//registry.company.com/': {
                npmAuthIdent: 'user123:pass123',
              },

              '//registry.npmjs.org': {
                npmAuthToken: 'token123',
              },

              '//registry.other.org': {
                npmAuthIdent: 'basictoken123',
              },
            },
          },
        },
        `
        {
          "additionalNpmrcContent": [
            "//registry.npmjs.org:_authToken=token123",
            "//registry.other.org:_auth=basictoken123",
            "//registry.company.com/:username=user123",
            "//registry.company.com/:_password=cGFzczEyMw==",
          ],
          "additionalYarnRcYml": {
            "npmRegistries": {
              "//registry.company.com/": {
                "npmAuthIdent": "user123:pass123",
              },
              "//registry.npmjs.org": {
                "npmAuthToken": "token123",
              },
              "//registry.other.org": {
                "npmAuthIdent": "basictoken123",
              },
            },
          },
        }
      `
      );
    });
  });
});
