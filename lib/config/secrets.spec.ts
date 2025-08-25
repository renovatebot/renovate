import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
  CONFIG_VARIABLES_INVALID,
} from '../constants/error-messages';
import { getConfig } from './defaults';
import {
  applySecretsAndVariablesToConfig,
  validateConfigSecretsAndVariables,
} from './secrets';

describe('config/secrets', () => {
  describe('validateConfigSecretsAndVariables(config)', () => {
    it('works with default config', () => {
      expect(() =>
        validateConfigSecretsAndVariables(getConfig()),
      ).not.toThrow();
    });

    it('returns if no secrets/variables', () => {
      expect(validateConfigSecretsAndVariables({})).toBeUndefined();
    });

    it('throws for invalid secret name', () => {
      expect(() =>
        validateConfigSecretsAndVariables({
          secrets: { '123': 'abc' },
        }),
      ).toThrow(CONFIG_SECRETS_INVALID);
    });

    it('throws for invalid variable name', () => {
      expect(() =>
        validateConfigSecretsAndVariables({
          variables: { '123': 'abc' },
        }),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });

    it('throws for secrets in repositories', () => {
      expect(() =>
        validateConfigSecretsAndVariables({
          repositories: [{ repository: 'x/y', secrets: { abc: 123 } }],
        } as any),
      ).toThrow(CONFIG_SECRETS_INVALID);
    });

    it('throws for variables in repositories', () => {
      expect(() =>
        validateConfigSecretsAndVariables({
          repositories: [{ repository: 'x/y', variables: { abc: 123 } }],
        } as any),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });
  });

  describe('applySecretsAndVariablesToConfig(config)', () => {
    it('replaces both secrets and variables', () => {
      const config = {
        secrets: { TOKEN: 'secret123' },
        variables: { MANAGER: 'npm' },
        hostRules: [
          {
            hostType: '{{ variables.MANAGER }}',
            token: '{{ secrets.TOKEN }}',
          },
        ],
      };
      const result = applySecretsAndVariablesToConfig({ config });
      expect(result).toEqual({
        hostRules: [{ hostType: 'npm', token: 'secret123' }],
      });
    });

    it('replaces all secrets and variables', () => {
      const config = {
        secrets: { FOO: 'foo', BAR: 'bar', BAZ: 'baz' },
        variables: { FOO: 'foo', BAR: 'bar', BAZ: 'baz' },
        customEnvVariables: {
          SECRETS: '{{ secrets.FOO }} {{ secrets.BAR }} {{ secrets.BAZ }}',
          VARIABLES:
            '{{ variables.FOO }} {{ variables.BAR }} {{ variables.BAZ }}',
        },
      };
      const result = applySecretsAndVariablesToConfig({ config });
      expect(result).toEqual({
        customEnvVariables: {
          SECRETS: 'foo bar baz',
          VARIABLES: 'foo bar baz',
        },
      });
    });

    it('preserves secrets and variables if delete flags are false', () => {
      const config = {
        secrets: { TOKEN: 'secret123' },
        variables: { MANAGER: 'npm' },
        hostRules: [
          {
            hostType: '{{ variables.MANAGER }}',
            token: '{{ secrets.TOKEN }}',
          },
        ],
      };
      const result = applySecretsAndVariablesToConfig({
        config,
        deleteSecrets: false,
        deleteVariables: false,
      });
      expect(result).toEqual({
        secrets: { TOKEN: 'secret123' },
        variables: { MANAGER: 'npm' },
        hostRules: [{ hostType: 'npm', token: 'secret123' }],
      });
    });

    it('throws if secret is missing', () => {
      const config = {
        hostRules: [{ token: '{{ secrets.MISSING_SECRET }}' }],
      };
      expect(() => applySecretsAndVariablesToConfig({ config })).toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('throws if variable is missing', () => {
      const config = {
        hostRules: [{ hostType: '{{ variables.MISSING_VAR }}' }],
      };
      expect(() => applySecretsAndVariablesToConfig({ config })).toThrow(
        CONFIG_VALIDATION,
      );
    });
  });
});
