import {
  CONFIG_VALIDATION,
  CONFIG_VARIABLES_INVALID,
} from '../constants/error-messages';
import { getConfig } from './defaults';
import { applyVariablesToConfig, validateConfigVariables } from './variables';

describe('config/variables', () => {
  describe('validateConfigVariables(config)', () => {
    it('works with default config', () => {
      expect(() => validateConfigVariables(getConfig())).not.toThrow();
    });

    it('returns if no variables', () => {
      expect(validateConfigVariables({})).toBeUndefined();
    });

    it('throws if variables is not an object', () => {
      expect(() =>
        validateConfigVariables({ variables: 'hello' } as any),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });

    it('throws for invalid variable names', () => {
      expect(() =>
        validateConfigVariables({ variables: { '123': 'abc' } }),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });

    it('throws for non-string variable', () => {
      expect(() =>
        validateConfigVariables({ variables: { abc: 123 } } as any),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });

    it('throws for variables inside repositories', () => {
      expect(() =>
        validateConfigVariables({
          repositories: [
            { repository: 'abc/def', variables: { abc: 123 } },
          ] as any,
        }),
      ).toThrow(CONFIG_VARIABLES_INVALID);
    });
  });

  describe('applyVariablesToConfig(config)', () => {
    it('works with default config', () => {
      expect(() => applyVariablesToConfig(getConfig())).not.toThrow();
    });

    it('throws if disallowed field is used', () => {
      const config = {
        prTitle: '{{ variables.ARTIFACTORY_TOKEN }}',
        variables: {
          ARTIFACTORY_TOKEN: '123test==',
        },
      };
      expect(() => applyVariablesToConfig(config)).toThrow(CONFIG_VALIDATION);
    });

    it('throws if an unknown variable is used', () => {
      const config = {
        npmToken: '{{ variables.ARTIFACTORY_TOKEN }}',
      };
      expect(() => applyVariablesToConfig(config)).toThrow(CONFIG_VALIDATION);
    });

    it('replaces variables in the top level', () => {
      const config = {
        variables: { ARTIFACTORY_TOKEN: '123test==' },
        npmToken: '{{ variables.ARTIFACTORY_TOKEN }}',
      };
      const res = applyVariablesToConfig(config);
      expect(res).toStrictEqual({
        npmToken: '123test==',
      });
      expect(Object.keys(res)).not.toContain('variables');
    });

    it('replaces variables in a subobject', () => {
      const config = {
        variables: { ARTIFACTORY_TOKEN: '123test==' },
        npm: { npmToken: '{{ variables.ARTIFACTORY_TOKEN }}' },
      };
      const res = applyVariablesToConfig(config);
      expect(res).toStrictEqual({
        npm: {
          npmToken: '123test==',
        },
      });
      expect(Object.keys(res)).not.toContain('variables');
    });

    it('replaces variables in a array of objects', () => {
      const config = {
        variables: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [
          { hostType: 'npm', token: '{{ variables.ARTIFACTORY_TOKEN }}' },
        ],
      };
      const res = applyVariablesToConfig(config);
      expect(res).toStrictEqual({
        hostRules: [{ hostType: 'npm', token: '123test==' }],
      });
      expect(Object.keys(res)).not.toContain('variables');
    });

    it('replaces variables in a array of strings', () => {
      const config = {
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['{{ variables.VARIABLE_MANAGER }}'],
      };
      const res = applyVariablesToConfig(config);
      expect(res).toStrictEqual({
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).not.toContain('variables');
    });

    it('replaces variables in a array of objects without deleting them', () => {
      const config = {
        variables: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [
          { hostType: 'npm', token: '{{ variables.ARTIFACTORY_TOKEN }}' },
        ],
      };
      const res = applyVariablesToConfig(config, config.variables, false);
      expect(res).toStrictEqual({
        variables: { ARTIFACTORY_TOKEN: '123test==' },
        hostRules: [{ hostType: 'npm', token: '123test==' }],
      });
      expect(Object.keys(res)).toContain('variables');
    });

    it('replaces variables in a array of strings without deleting them', () => {
      const config = {
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['{{ variables.VARIABLE_MANAGER }}'],
      };
      const res = applyVariablesToConfig(config, config.variables, false);
      expect(res).toStrictEqual({
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).toContain('variables');
    });

    it('{} as variables will result in an error', () => {
      const config = {
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['{{ variables.VARIABLE_MANAGER }}'],
      };
      expect(() => applyVariablesToConfig(config, {}, false)).toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('undefined as variables will result replace the variable', () => {
      const config = {
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['{{ variables.VARIABLE_MANAGER }}'],
      };
      const res = applyVariablesToConfig(config, undefined, false);
      expect(res).toStrictEqual({
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['npm'],
      });
      expect(Object.keys(res)).toContain('variables');
    });

    it('null as variables will result in an error', () => {
      const config = {
        variables: { VARIABLE_MANAGER: 'npm' },
        allowedManagers: ['{{ variables.VARIABLE_MANAGER }}'],
      };
      // TODO fix me? #22198
      expect(() =>
        applyVariablesToConfig(config, null as never, false),
      ).toThrow(CONFIG_VALIDATION);
    });
  });
});
