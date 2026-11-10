import { validMatchFields } from '../../lib/modules/manager/custom/utils.ts';
import {
  allowedFields,
  exposedConfigOptions,
} from '../../lib/util/template/index.ts';
import { templatableFields } from '../../tools/lint/rules/templatable-fields.generated.ts';

describe('other/validate-templatable-fields', () => {
  // if this test fails, run `pnpm generate`
  it('generated templatable fields are up to date', () => {
    const expected = [
      ...new Set([
        ...validMatchFields,
        ...exposedConfigOptions,
        ...Object.keys(allowedFields),
      ]),
    ].sort();

    expect(templatableFields).toEqual(expected);
  });
});
