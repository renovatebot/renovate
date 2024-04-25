import is from '@sindresorhus/is';
import { parsePEP508 } from './utils';

describe('modules/manager/pep621/utils', () => {
  describe('parsePEP508()', () => {
    it.each`
      value                                                        | success  | packageName            | currentValue       | extras              | marker
      ${''}                                                        | ${false} | ${undefined}           | ${undefined}       | ${undefined}        | ${undefined}
      ${undefined}                                                 | ${false} | ${undefined}           | ${undefined}       | ${undefined}        | ${undefined}
      ${null}                                                      | ${false} | ${undefined}           | ${undefined}       | ${undefined}        | ${undefined}
      ${'blinker'}                                                 | ${true}  | ${'blinker'}           | ${undefined}       | ${undefined}        | ${undefined}
      ${'packaging==20.0.0'}                                       | ${true}  | ${'packaging'}         | ${'==20.0.0'}      | ${undefined}        | ${undefined}
      ${'packaging>=20.9,!=22.0'}                                  | ${true}  | ${'packaging'}         | ${'>=20.9,!=22.0'} | ${undefined}        | ${undefined}
      ${'cachecontrol[filecache]>=0.12.11'}                        | ${true}  | ${'cachecontrol'}      | ${'>=0.12.11'}     | ${['filecache']}    | ${undefined}
      ${'tomli>=1.1.0; python_version < "3.11"'}                   | ${true}  | ${'tomli'}             | ${'>=1.1.0'}       | ${undefined}        | ${'python_version < "3.11"'}
      ${'typing-extensions; python_version < "3.8"'}               | ${true}  | ${'typing-extensions'} | ${undefined}       | ${undefined}        | ${'python_version < "3.8"'}
      ${'typing-extensions[test-feature]; python_version < "3.8"'} | ${true}  | ${'typing-extensions'} | ${undefined}       | ${['test-feature']} | ${'python_version < "3.8"'}
    `(
      '(parse $value"',
      ({ value, success, packageName, currentValue, extras, marker }) => {
        const result = parsePEP508(value);

        const expected = is.truthy(success)
          ? clear({ packageName, currentValue, extras, marker })
          : null;
        expect(result).toEqual(expected);
      },
    );
  });
});

function clear(a: any) {
  Object.keys(a).forEach((key) => {
    if (a[key] === undefined) {
      delete a[key];
    }
  });
  return a;
}
