import nixhub from '.';

describe('modules/versioning/nixhub/index', () => {
  it.each`
    version     | expected
    ${'1.1'}    | ${true}
    ${'1.3.0'}  | ${true}
    ${'2.1.20'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!nixhub.isVersion(version)).toBe(expected);
  });

  it.each`
    version           | isValid
    ${'v1.4'}         | ${false}
    ${'V0.5'}         | ${false}
    ${'3.5.0'}        | ${true}
    ${'4.2.21.Final'} | ${false}
    ${'1234'}         | ${true}
    ${'foo'}          | ${false}
    ${'latest'}       | ${false}
    ${''}             | ${false}
    ${'3.5.0-beta.3'} | ${false}
    ${'*'}            | ${false}
    ${'x'}            | ${false}
    ${'X'}            | ${false}
    ${'~1.2.3'}       | ${false}
    ${'>1.2.3'}       | ${false}
    ${'^1.2.3'}       | ${false}
    ${'1.2.3-foo'}    | ${false}
    ${'1.2.3foo'}     | ${false}
  `('isValid("$version") === $isValid', ({ version, isValid }) => {
    expect(!!nixhub.isValid(version)).toBe(isValid);
  });
});
