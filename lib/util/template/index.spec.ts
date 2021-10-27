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
});
