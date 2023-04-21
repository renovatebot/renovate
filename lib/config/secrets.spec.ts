import { getConfig } from '../../test/util';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
} from '../constants/error-messages';
import { applySecretsToConfig, validateConfigSecrets } from './secrets';

describe('config/secrets', () => {
  describe('validateConfigSecrets(config)', () => {
    it('works with default config', () => {
      expect(() => validateConfigSecrets(getConfig())).not.toThrow();
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
      expect(() => applySecretsToConfig(getConfig())).not.toThrow();
    });

    it('throws if disallowed field is used', () => {
      const config = {
        prTitle: '{{ secrets.ARTIFACTORY_TOKEN }}',
        secrets: {
          ARTIFACTORY_TOKEN: '123test==',
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
        secrets: { ARTIFACTORY_TOKEN: '123test==' },
        npmToken: '{{ secrets.ARTIFACTORY_TOKEN }}',
      };
      const res = applySecretsToConfig(config);
      expect(res).toStrictEqual({
        npmToken: '123test==',
      });
      expect(Object.keys(res)).not.toContain('secrets');
    });

    it('replaces secrets in a subobject', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: '123test==' },
        npm: { npmToken: '{{ secrets.ARTIFACTORY_TOKEN }}' },
      };
      const res = applySecretsToConfig(config);
      expect(res).toStrictEqual({
        npm: {
          npmToken: '123test==',
        },
      });
      expect(Object.keys(res)).not.toContain('secrets');
    });

    it('replaces secrets in a array of objects', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [
          { hostType: 'npm', token: '{{ secrets.ARTIFACTORY_TOKEN }}' },
        ],
      };
      const res = applySecretsToConfig(config);
      expect(res).toStrictEqual({
        hostRules: [{ hostType: 'npm', token: '123test==' }],
      });
      expect(Object.keys(res)).not.toContain('secrets');
    });

    it('replaces secrets in a array of strings', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      const res = applySecretsToConfig(config);
      expect(res).toStrictEqual({
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).not.toContain('secrets');
    });

    it('replaces secrets in a array of objects without deleting them', () => {
      const config = {
        secrets: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [
          { hostType: 'npm', token: '{{ secrets.ARTIFACTORY_TOKEN }}' },
        ],
      };
      const res = applySecretsToConfig(config, config.secrets, false);
      expect(res).toStrictEqual({
        secrets: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [{ hostType: 'npm', token: '123test==' }],
      });
      expect(Object.keys(res)).toContain('secrets');
    });

    it('replaces secrets in a array of strings without deleting them', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      const res = applySecretsToConfig(config, config.secrets, false);
      expect(res).toStrictEqual({
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).toContain('secrets');
    });

    it('{} as secrets will result in an error', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      expect(() => applySecretsToConfig(config, {}, false)).toThrow(
        CONFIG_VALIDATION
      );
    });

    it('undefined as secrets will result replace the secret', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      const res = applySecretsToConfig(config, undefined, false);
      expect(res).toStrictEqual({
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).toContain('secrets');
    });

    it('null as secrets will result in an error', () => {
      const config = {
        secrets: { SECRET_MANAGER: 'npm' },
        allowedManagers: ['{{ secrets.SECRET_MANAGER }}'],
      };
      // TODO fix me? #7154
      expect(() => applySecretsToConfig(config, null as never, false)).toThrow(
        CONFIG_VALIDATION
      );
    });
  });
});
