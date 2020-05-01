import { getOptions } from '../../config/definitions';
import * as template from '.';

describe('util/template', () => {
  it('has valid exposed config options', () => {
    const allOptions = getOptions().map((option) => option.name);
    const missingOptions = template.exposedConfigOptions.filter(
      (option) => !allOptions.includes(option)
    );
    expect(missingOptions).toEqual([]);
  });
});
