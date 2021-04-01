import { defaultConfig, getName } from '../../test/util';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
} from '../constants/error-messages';
import { applySecretsToConfig, validateConfigSecrets } from './secrets';

describe(getName(__filename), () => {
  describe('validateConfigSecrets(config)', () => {
    it('works with default config', () => {
      expect(() => validateConfigSecrets(defaultConfig)).not.toThrow();
    });
    it('returns if no secrets', () => {
      expect(validateConfigSecrets({})).toBeUndefined();
    });
    it('throws if secrets is not an object', () => {
      expect(() => validateConfigSecrets({ secrets: 'hello' } as any)).toThrow(
        CONFIG_SECRETS_INVALID
      );
    });
    it('throws for invalid secret names', () => {
      expect(() =>
        validateConfigSecrets({ secrets: { '123': 'abc' } })
      ).toThrow(CONFIG_SECRETS_INVALID);
    });
    it('throws for non-string secret', () => {
      expect(() =>
        validateConfigSecrets({ secrets: { abc: 123 } } as any)
      ).toThrow(CONFIG_SECRETS_INVALID);
    });
    it('throws for secrets inside repositories', () => {
      expect(() =>
        validateConfigSecrets({
          repositories: [
            { repository: 'abc/def', secrets: { abc: 123 } },
          ] as any,
        })
      ).toThrow(CONFIG_SECRETS_INVALID);
    });
  });

  describe('applySecretsToConfig(config)', () => {
    it('works with default config', () => {
      expect(() => applySecretsToConfig(defaultConfig)).not.toThrow();
    });

    it('throws if disallowed field is used', () => {
      const config = {
        prTitle: '{{ secrets.ARTIFACTORY_TOKEN }}',
        secrets: {
          ARTIFACTORY_TOKEN: 'abc123==',
        },
      };
      expect(() => applySecretsToConfig(config)).toThrow(CONFIG_VALIDATION);
    });
    it('throws if an unknown secret is used', () => {
      const config = {
        npmToken: '{{ secrets.ARTIFACTORY_TOKEN }}',
      };
      expect(() => applySecretsToConfig(config)).toThrow(CONFIG_VALIDATION);
    });
    it('replaces secrets in the top level', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: 'abc123==' },
        npmToken: '{{ secrets.ARTIFACTORY_TOKEN }}',
      };
      const res = applySecretsToConfig(config);
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).not.toContain('secrets');
    });
    it('replaces secrets in a subobject', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: 'abc123==' },
        npm: { npmToken: '{{ secrets.ARTIFACTORY_TOKEN }}' },
      };
      const res = applySecretsToConfig(config);
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).not.toContain('secrets');
    });
    it('replaces secrets in a array of objects', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: 'abc123==' },
        hostRules: [
          { hostType: 'npm', token: '{{ secrets.ARTIFACTORY_TOKEN }}' },
        ],
      };
      const res = applySecretsToConfig(config);
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).not.toContain('secrets');
    });
    it('replaces secrets in a array of strings', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      const res = applySecretsToConfig(config);
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).not.toContain('secrets');
    });
  });
});
