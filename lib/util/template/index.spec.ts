import { getOptions } from '../../config/options';
import * as template from '.';

describe('util/template/index', () => {
  it('has valid exposed config options', () => {
    const allOptions = getOptions().map((option) => option.name);
    const missingOptions = template.exposedConfigOptions.filter(
      (option) => !allOptions.includes(option)
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

  describe('proxyCompileInput', () => {
    const allowedField = 'body';
    const forbiddenField = 'foobar';

    type TestCompileInput = Record<
      typeof allowedField | typeof forbiddenField,
      unknown
    >;

    const compileInput: TestCompileInput = {
      [allowedField]: 'allowed',
      [forbiddenField]: 'forbidden',
    };

    it('accessing allowed files', () => {
      const p = template.proxyCompileInput(compileInput);

      expect(p[allowedField]).toBe('allowed');
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
          'logJSON'
        )
      ).toBeTrue();
      expect(
        template.containsTemplates(
          '{{#with logJSON.hasReleaseNotes as | hasNotes |}}{{hasNotes}}{{/if}}',
          'logJSON'
        )
      ).toBeTrue();
      expect(
        template.containsTemplates(
          '{{#if logJSON.hasReleaseNotes}}has notes{{/if}}',
          'logJSON'
        )
      ).toBeTrue();
    });

    it('does not contain template', () => {
      expect(template.containsTemplates('{{body}}', ['logJSON'])).toBeFalse();
    });
  });
});
