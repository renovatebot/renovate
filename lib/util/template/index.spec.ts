import { getOptions } from '../../config/options';
import * as _execUtils from '../exec/utils';
import * as template from '.';

vi.mock('../exec/utils');

const execUtils = vi.mocked(_execUtils);

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

  it('string to pretty JSON', () => {
    const userTemplate =
      '{{{ stringToPrettyJSON \'{"some":{"fancy":"json"}}\'}}}';
    const output = template.compile(userTemplate, undefined as never);
    expect(output).toMatchSnapshot();
  });

  it('to JSON', () => {
    const userTemplate = '{{{ toJSON upgrades }}}';
    const input = {
      upgrades: [
        {
          depName: 'foo-lib',
          currentVersion: '1.0.0',
          newVersion: '1.0.1',
        },
      ],
    };
    const output = template.compile(userTemplate, input);
    expect(JSON.parse(output)).toEqual(input.upgrades);
  });

  it('to JSON empty array', () => {
    const userTemplate = '{{{ toJSON (toArray) }}}';
    const output = template.compile(userTemplate, {});
    expect(JSON.parse(output)).toEqual([]);
  });

  it('to JSON empty object', () => {
    const userTemplate = '{{{ toJSON (toObject) }}}';
    const output = template.compile(userTemplate, {});
    expect(JSON.parse(output)).toEqual({});
  });

  it('to Object passing illegal number of elements', () => {
    const userTemplate = "{{{ toJSON (toObject 'foo') }}}";
    const outputFunc = () => template.compile(userTemplate, {});
    expect(outputFunc).toThrow();
  });

  it('build complex json', () => {
    const userTemplate =
      "{{{ toJSON (toObject 'upgrades' upgrades 'array' (toArray platform isMajor 'foo')) }}}";
    const input = {
      platform: 'github',
      isMajor: true,
      upgrades: [
        {
          depName: 'foo-lib',
        },
      ],
    };
    const output = template.compile(userTemplate, input);
    expect(JSON.parse(output)).toEqual({
      upgrades: input.upgrades,
      array: [input.platform, input.isMajor, 'foo'],
    });
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

  it('and has access to prBodyDefinitions', () => {
    const userTemplate =
      'Issues: {{#each upgrades}}{{{prBodyDefinitions.Issue}}} {{/each}}';
    const config = {
      upgrades: [
        {
          prBodyDefinitions: {
            Issue: '1234',
          },
        },
      ],
    };
    const output = template.compile(userTemplate, config);
    expect(output).toBe('Issues: 1234 ');
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
      const warnVariables = new Set<string>();
      const p = template.proxyCompileInput(compileInput, warnVariables);

      expect(p[allowedField]).toBe('allowed');
      expect(p[allowedArrayField]).toStrictEqual(['allowed']);
      expect(warnVariables).toBeEmpty();
      expect(p[forbiddenField]).toBeUndefined();
      expect(warnVariables).toEqual(new Set<string>([forbiddenField]));
    });

    it('supports object nesting', () => {
      const warnVariables = new Set<string>();
      const proxy = template.proxyCompileInput(
        {
          [allowedField]: compileInput,
        },
        warnVariables,
      );

      const obj = proxy[allowedField] as TestCompileInput;
      expect(obj[allowedField]).toBe('allowed');
      expect(warnVariables).toBeEmpty();
      expect(obj[forbiddenField]).toBeUndefined();
      expect(warnVariables).toEqual(new Set<string>([forbiddenField]));
    });

    it('supports array nesting', () => {
      const warnVariables = new Set<string>();
      const proxy = template.proxyCompileInput(
        {
          [allowedField]: [compileInput],
        },
        warnVariables,
      );

      const arr = proxy[allowedField] as TestCompileInput[];
      const obj = arr[0];
      expect(obj[allowedField]).toBe('allowed');
      expect(obj[allowedArrayField]).toStrictEqual(['allowed']);
      expect(warnVariables).toBeEmpty();
      expect(obj[forbiddenField]).toBeUndefined();
      expect(warnVariables).toEqual(new Set<string>([forbiddenField]));
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

  describe('split', () => {
    it('should return empty array on non string input', () => {
      const output = template.compile("test {{ split labels '-' }}", {
        labels: 123,
      });
      expect(output).toBe('test ');
    });

    it('should return empty array on missing parameter', () => {
      const output = template.compile('test {{ split labels }}', {
        labels: 'foo-bar',
      });
      expect(output).toBe('test ');
    });

    it('should return array on success', () => {
      const output = template.compile("{{ split labels '-' }}", {
        labels: 'foo-bar',
      });
      expect(output).toBe('foo,bar');
    });

    it('should return array element', () => {
      const output = template.compile(
        "{{ lookup (split packageName '-') 1 }}",
        {
          packageName: 'foo-bar-test',
        },
      );
      expect(output).toBe('bar');
    });
  });

  describe('lookupArray', () => {
    it('performs lookup for every array element', () => {
      const output = template.compile(
        '{{#each (lookupArray upgrades "prBodyDefinitions")}} {{{Issue}}}{{/each}}',
        {
          upgrades: [
            {
              prBodyDefinitions: {
                Issue: 'ABC-123',
              },
            },
            {},
            {
              prBodyDefinitions: {
                Issue: 'DEF-456',
              },
            },
            null,
            undefined,
          ],
        },
      );

      expect(output).toBe(' ABC-123 DEF-456');
    });

    it('handles null input array', () => {
      const output = template.compile(
        '{{#each (lookupArray testArray "prBodyDefinitions")}} {{{Issue}}}{{/each}}',
        {
          testArray: null,
        },
        false,
      );

      expect(output).toBe('');
    });

    it('handles empty string key', () => {
      const output = template.compile(
        '{{#each (lookupArray testArray "")}} {{{.}}}{{/each}}',
        {
          testArray: [
            {
              '': 'ABC-123',
            },
          ],
        },
        false,
      );

      expect(output).toBe(' ABC-123');
    });

    it('handles null key', () => {
      const output = template.compile(
        '{{#each (lookupArray testArray null)}} {{{.}}}{{/each}}',
        {
          testArray: [
            {
              null: 'ABC-123',
            },
          ],
        },
        false,
      );

      expect(output).toBe(' ABC-123');
    });
  });

  describe('distinct', () => {
    it('skips duplicate values', () => {
      const output = template.compile(
        '{{#each (distinct (lookupArray (lookupArray upgrades "prBodyDefinitions") "Issue"))}} {{{.}}}{{/each}}',
        {
          upgrades: [
            {
              prBodyDefinitions: {
                Issue: 'ABC-123',
              },
            },
            {
              prBodyDefinitions: {
                Issue: 'DEF-456',
              },
            },
            {
              prBodyDefinitions: {
                Issue: 'ABC-123',
              },
            },
          ],
        },
      );

      expect(output).toBe(' ABC-123 DEF-456');
    });

    it('handles null elements', () => {
      const output = template.compile(
        '{{#each (distinct input)}}{{{.}}}{{/each}}',
        {
          input: [null, null],
        },
        false,
      );

      expect(output).toBe('');
    });

    it('handles null input', () => {
      const output = template.compile(
        '{{#each (distinct input)}}{{{.}}}{{/each}}',
        {
          input: null,
        },
        false,
      );

      expect(output).toBe('');
    });
  });
});
