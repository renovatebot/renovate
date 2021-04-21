import { getName } from '../../../test/util';
import { getOptions } from '../../config/definitions';
import * as template from '.';

describe(getName(__filename), () => {
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
    const input = { isFoo: true, platform: 'github', token: 'abc123 ' };
    const output = template.compile(userTemplate, input);
    expect(output).toMatchSnapshot();
    expect(output).toContain('github');
    expect(output).not.toContain('abc123');
  });
});
