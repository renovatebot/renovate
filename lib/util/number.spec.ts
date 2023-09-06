import { coerceNumber } from './number';

describe('util/number', () => {
  it.each`
    val          | def          | expected
    ${1}         | ${2}         | ${1}
    ${undefined} | ${2}         | ${2}
    ${undefined} | ${undefined} | ${0}
  `('coerceNumber($val, $def) = $expected', ({ val, def, expected }) => {
    expect(coerceNumber(val, def)).toBe(expected);
  });
});
