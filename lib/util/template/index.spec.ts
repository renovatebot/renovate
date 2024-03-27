import { mocked } from '../../../test/util';
import { getOptions } from '../../config/options';
import * as _execUtils from '../exec/utils';
import * as template from '.';

jest.mock('../exec/utils');

const execUtils = mocked(_execUtils);

describe('util/template/index', () => {
  beforeEach(() => {
    execUtils.getChildEnv.mockReturnValue({
      CUSTOM_FOO: 'foo',
      HOME: '/root',
    });
  });

  it('returns empty string if cannot compile', () => {
    expect(template.safeCompile('{{abc', {})).toBe('');
  });

  it('has valid exposed config options', () => {
    const allOptions = getOptions().map((option) => option.name);
    const missingOptions = template.exposedConfigOptions.filter(
      (option) => !allOptions.includes(option),
    );
    expect(missingOptions).toEqual([]);
  });

  it('filters out disallowed fields', () => {
    const userTemplate =
      '{{#if isFoo}}foo{{/if}}{{platform}} token = "{{token}}"';
    const input = {
      isFoo: true,
      platform: 'github',
      token: '123test ',
      releases: [{ token: '123test' }],
      logJSON: { token: '123test' },
    };
    const output = template.compile(userTemplate, input);
    expect(output).toBe('github token = ""');
  });

  it('containsString', () => {
    const userTemplate =
      "{{#if (containsString platform 'git')}}True{{else}}False{{/if}}";
    const input = { platform: 'github' };
    const output = template.compile(userTemplate, input, false);
    expect(output).toContain('True');
  });

  it('not containsString', () => {
    const userTemplate =
      "{{#if (containsString platform 'hub')}}True{{else}}False{{/if}}";
    const input = { platform: 'gitlab' };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('False');
  });

  it('and returns true when all parameters are true', () => {
    const userTemplate =
      '{{#if (and isMajor isSingleVersion isReplacement)}}True{{else}}False{{/if}}';
    const input = { isMajor: true, isSingleVersion: true, isReplacement: true };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('True');
  });

  it('and returns false when at least one parameter is false', () => {
    const userTemplate =
      '{{#if (and isMajor isPatch isGithub)}}True{{else}}False{{/if}}';
    const input = { isMajor: true, isPatch: false, isReplacement: true };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('False');
  });

  it('or returns true when at least one is true', () => {
    const userTemplate =
      '{{#if (or isMajor isPatch isReplacement)}}True{{else}}False{{/if}}';
    const input = { isMajor: false, isPatch: true, isReplacement: false };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('True');
  });

  it('or returns false when all are false', () => {
    const userTemplate =
      '{{#if (or isMajor isPatch isReplacement)}}True{{else}}False{{/if}}';
    const input = { isMajor: false, isPatch: false, isReplacement: false };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('False');
  });

  it('string to pretty JSON ', () => {
    const userTemplate =
      '{{{ stringToPrettyJSON \'{"some":{"fancy":"json"}}\'}}}';
    const output = template.compile(userTemplate, undefined as never);
    expect(output).toMatchSnapshot();
  });

  it('lowercase', () => {
    const userTemplate = "{{{ lowercase 'FOO'}}}";
    const output = template.compile(userTemplate, undefined as never);
    expect(output).toBe('foo');
  });

  it('has access to basic environment variables (basicEnvVars)', () => {
    const userTemplate = 'HOME is {{env.HOME}}';
    const output = template.compile(userTemplate, {});
    expect(output).toBe('HOME is /root');
  });

  it('and has access to custom variables (customEnvVariables)', () => {
    const userTemplate = 'CUSTOM_FOO is {{env.CUSTOM_FOO}}';
    const output = template.compile(userTemplate, {});
    expect(output).toBe('CUSTOM_FOO is foo');
  });

  it('replace', () => {
    const userTemplate =
      "{{ replace '[a-z]+\\.github\\.com' 'ghc' depName }}{{ replace 'some' 'other' depType }}";
    const output = template.compile(userTemplate, {
      depName: 'some.github.com/dep',
    });
    expect(output).toBe('ghc/dep');
  });

  describe('proxyCompileInput', () => {
    const allowedField = 'body';
    const allowedArrayField = 'prBodyNotes';
    const forbiddenField = 'foobar';

    type TestCompileInput = Record<
      typeof allowedField | typeof allowedArrayField | typeof forbiddenField,
      unknown
    >;

    const compileInput: TestCompileInput = {
      [allowedField]: 'allowed',
      [allowedArrayField]: ['allowed'],
      [forbiddenField]: 'forbidden',
    };

    it('accessing allowed fields', () => {
      const p = template.proxyCompileInput(compileInput);

      expect(p[allowedField]).toBe('allowed');
      expect(p[allowedArrayField]).toStrictEqual(['allowed']);
      expect(p[forbiddenField]).toBeUndefined();
    });

    it('supports object nesting', () => {
      const proxy = template.proxyCompileInput({
        [allowedField]: compileInput,
      });

      const obj = proxy[allowedField] as TestCompileInput;
      expect(obj[allowedField]).toBe('allowed');
      expect(obj[forbiddenField]).toBeUndefined();
    });

    it('supports array nesting', () => {
      const proxy = template.proxyCompileInput({
        [allowedField]: [compileInput],
      });

      const arr = proxy[allowedField] as TestCompileInput[];
      const obj = arr[0];
      expect(obj[allowedField]).toBe('allowed');
      expect(obj[allowedArrayField]).toStrictEqual(['allowed']);
      expect(obj[forbiddenField]).toBeUndefined();
    });
  });

  describe('containsTemplate', () => {
    it('supports null', () => {
      expect(template.containsTemplates(null, 'logJSON')).toBeFalse();
    });

    it('contains template', () => {
      expect(
        template.containsTemplates(
          '{{#if logJSON}}{{logJSON}}{{/if}}',
          'logJSON',
        ),
      ).toBeTrue();
      expect(
        template.containsTemplates(
          '{{#with logJSON.hasReleaseNotes as | hasNotes |}}{{hasNotes}}{{/if}}',
          'logJSON',
        ),
      ).toBeTrue();
      expect(
        template.containsTemplates(
          '{{#if logJSON.hasReleaseNotes}}has notes{{/if}}',
          'logJSON',
        ),
      ).toBeTrue();
    });

    it('does not contain template', () => {
      expect(template.containsTemplates('{{body}}', ['logJSON'])).toBeFalse();
    });
  });

  describe('percent encoding', () => {
    it('encodes values', () => {
      const output = template.compile(
        '{{{encodeURIComponent "@fsouza/prettierd"}}}',
        undefined as never,
      );
      expect(output).toBe('%40fsouza%2Fprettierd');
    });

    it('decodes values', () => {
      const output = template.compile(
        '{{{decodeURIComponent "%40fsouza/prettierd"}}}',
        undefined as never,
      );
      expect(output).toBe('@fsouza/prettierd');
    });
  });

  describe('base64 encoding', () => {
    it('encodes values', () => {
      const output = template.compile(
        '{{{encodeBase64 "@fsouza/prettierd"}}}',
        undefined as never,
      );
      expect(output).toBe('QGZzb3V6YS9wcmV0dGllcmQ=');
    });

    it('handles null values gracefully', () => {
      const output = template.compile('{{{encodeBase64 packageName}}}', {
        packageName: null,
      });
      expect(output).toBe('');
    });

    it('handles undefined values gracefully', () => {
      const output = template.compile('{{{encodeBase64 packageName}}}', {
        packageName: undefined,
      });
      expect(output).toBe('');
    });
  });

  describe('equals', () => {
    it('equals', () => {
      const output = template.compile(
        '{{#if (equals datasource "git-refs")}}https://github.com/{{packageName}}{{else}}{{packageName}}{{/if}}',
        {
          datasource: 'git-refs',
          packageName: 'renovatebot/renovate',
        },
      );
      expect(output).toBe('https://github.com/renovatebot/renovate');
    });

    it('not equals', () => {
      const output = template.compile(
        '{{#if (equals datasource "git-refs")}}https://github.com/{{packageName}}{{else}}{{packageName}}{{/if}}',
        {
          datasource: 'github-releases',
          packageName: 'renovatebot/renovate',
        },
      );
      expect(output).toBe('renovatebot/renovate');
    });

    it('not strict equals', () => {
      const output = template.compile(
        '{{#if (equals newMajor "3")}}equals{{else}}not equals{{/if}}',
        {
          newMajor: 3,
        },
      );
      expect(output).toBe('not equals');
    });
  });

  describe('includes', () => {
    it('includes is true', () => {
      const output = template.compile(
        '{{#if (includes labels "dependencies")}}production{{else}}notProduction{{/if}}',
        {
          labels: ['dependencies'],
        },
      );

      expect(output).toBe('production');
    });

    it('includes is false', () => {
      const output = template.compile(
        '{{#if (includes labels "dependencies")}}production{{else}}notProduction{{/if}}',
        {
          labels: ['devDependencies'],
        },
      );

      expect(output).toBe('notProduction');
    });

    it('includes with incorrect type first argument', () => {
      const output = template.compile(
        '{{#if (includes labels "dependencies")}}production{{else}}notProduction{{/if}}',
        {
          labels: 'devDependencies',
        },
      );

      expect(output).toBe('notProduction');
    });

    it('includes with incorrect type second argument', () => {
      const output = template.compile(
        '{{#if (includes labels 555)}}production{{else}}notProduction{{/if}}',
        {
          labels: ['devDependencies'],
        },
      );

      expect(output).toBe('notProduction');
    });
  });
});
