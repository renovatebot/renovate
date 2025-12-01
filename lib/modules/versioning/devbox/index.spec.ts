import devbox from '.';

describe('modules/versioning/devbox/index', () => {
  it.each`
    version           | expected
    ${'1'}            | ${false}
    ${'01'}           | ${false}
    ${'1.01'}         | ${false}
    ${'1.1'}          | ${false}
    ${'1.3.0'}        | ${true}
    ${'2.1.20'}       | ${true}
    ${'v1.4'}         | ${false}
    ${'V0.5'}         | ${false}
    ${'3.5.0'}        | ${true}
    ${'4.2.21.Final'} | ${false}
    ${'1234'}         | ${false}
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
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!devbox.isVersion(version)).toBe(expected);
  });

  it.each`
    version           | isValid
    ${'1'}            | ${true}
    ${'01'}           | ${false}
    ${'1.01'}         | ${false}
    ${'1.1'}          | ${true}
    ${'1.3.0'}        | ${true}
    ${'2.1.20'}       | ${true}
    ${'v1.4'}         | ${false}
    ${'V0.5'}         | ${false}
    ${'3.5.0'}        | ${true}
    ${'4.2.21.Final'} | ${false}
    ${'1234'}         | ${true}
    ${'foo'}          | ${false}
    ${'latest'}       | ${true}
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
    expect(!!devbox.isValid(version)).toBe(isValid);
  });

  it.each`
    version      | range        | expected
    ${'1'}       | ${'1'}       | ${false}
    ${'1'}       | ${'0'}       | ${false}
    ${'1.2.3'}   | ${'1'}       | ${true}
    ${'1.2'}     | ${'1'}       | ${false}
    ${'1.0.0'}   | ${'1'}       | ${true}
    ${'1.2.0'}   | ${'1.2'}     | ${true}
    ${'1.2.3'}   | ${'1.2'}     | ${true}
    ${'0'}       | ${'latest'}  | ${false}
    ${'1.2.3'}   | ${'latest'}  | ${true}
    ${'1.2.3.5'} | ${'1.2.3.5'} | ${false}
    ${'1.2'}     | ${'1.2.3'}   | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(devbox.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    version      | range        | expected
    ${'1'}       | ${'1'}       | ${true}
    ${'1'}       | ${'0'}       | ${false}
    ${'1.2.3'}   | ${'1'}       | ${true}
    ${'1.2'}     | ${'1'}       | ${true}
    ${'1.0.0'}   | ${'1'}       | ${true}
    ${'1.2.0'}   | ${'1.2'}     | ${true}
    ${'1.2.3'}   | ${'1.2'}     | ${true}
    ${'0'}       | ${'latest'}  | ${true}
    ${'1.2.3'}   | ${'latest'}  | ${true}
    ${'1.2.3.5'} | ${'1.2.3.5'} | ${false}
    ${'latest'}  | ${'latest'}  | ${false}
    ${'latest'}  | ${'1.2.3'}   | ${false}
    ${'1.2'}     | ${'1.2.3'}   | ${true}
  `(
    'equals("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(devbox.equals(version, range)).toBe(expected);
    },
  );
});
