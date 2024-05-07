import { coerceNumber, parseInteger } from './number';

describe('util/number', () => {
  it.each`
    val          | def          | expected
    ${1}         | ${2}         | ${1}
    ${undefined} | ${2}         | ${2}
    ${undefined} | ${undefined} | ${0}
  `('coerceNumber($val, $def) = $expected', ({ val, def, expected }) => {
    expect(coerceNumber(val, def)).toBe(expected);
  });

  it.each`
    val          | def          | expected
    ${1}         | ${2}         | ${2}
    ${undefined} | ${2}         | ${2}
    ${undefined} | ${undefined} | ${0}
    ${''}        | ${undefined} | ${0}
    ${'-1'}      | ${undefined} | ${0}
    ${'1.1'}     | ${undefined} | ${0}
    ${'a'}       | ${undefined} | ${0}
    ${'5'}       | ${undefined} | ${5}
  `('parseInteger($val, $def) = $expected', ({ val, def, expected }) => {
    expect(parseInteger(val, def)).toBe(expected);
  });
});
