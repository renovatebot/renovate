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
      "{{#if (containsString platform 'github')}}Is GitHub{{else}}Is Other{{/if}}";
    const input = { platform: 'github' };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('Is GitHub');
  });
  it('containsString is other', () => {
    const userTemplate =
      "{{#if (containsString platform 'github')}}Is GitHub{{else}}Is Other{{/if}}";
    const input = { platform: 'bitbucket' };
    const output = template.compile(userTemplate, input);
    expect(output).toContain('Is Other');
  });
  it('and returns true', () => {
    const userTemplate = '{{#if (and true true)}}True{{else}}False{{/if}}';
    const output = template.compile(userTemplate, {});
    expect(output).toContain('True');
  });
  it('and returns false', () => {
    const userTemplate =
      '{{#if (and true true false)}}True{{else}}False{{/if}}';
    const output = template.compile(userTemplate, {});
    expect(output).toContain('False');
  });
  it('or returns true', () => {
    const userTemplate =
      '{{#if (or false false true)}}TRUE{{else}}False{{/if}}';
    const output = template.compile(userTemplate, {});
    expect(output).toContain('True');
  });
  it('or returns false', () => {
    const userTemplate =
      '{{#if (or false false false)}}TRUE{{else}}False{{/if}}';
    const output = template.compile(userTemplate, {});
    expect(output).toContain('False');
  });
  it('string to pretty JSON ', () => {
    const userTemplate =
      '{{{ stringToPrettyJSON \'{"some":{"fancy":"json"}}\'}}}';
    const output = template.compile(userTemplate, undefined);
    expect(output).toMatchSnapshot();
  });
});
