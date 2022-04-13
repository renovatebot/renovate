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
    const input = { isFoo: true, platform: 'github', token: '123test ' };
    const output = template.compile(userTemplate, input);
    expect(output).toMatchSnapshot();
    expect(output).toContain('github');
    expect(output).not.toContain('123test');
  });

  it('containsString', () => {
    const userTemplate =
      "{{#if (containsString platform 'git')}}True{{else}}False{{/if}}";
    const input = { platform: 'github' };
    const output = template.compile(userTemplate, input);
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
    const output = template.compile(userTemplate, undefined);
    expect(output).toMatchSnapshot();
  });
});
