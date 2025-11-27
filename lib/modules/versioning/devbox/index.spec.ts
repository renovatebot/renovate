import devbox from '.';

describe('modules/versioning/devbox/index', () => {
  it.each`
    version           | expected
    ${'1'}            | ${false}
    ${'01'}           | ${false}
    ${'1.01'}         | ${false}
    ${'1.1.01'}       | ${false}
    ${'1.1'}          | ${false}
    ${'1.3.0'}        | ${true}
    ${'2.1.20'}       | ${true}
    ${'v1.4'}         | ${false}
    ${'V0.5'}         | ${false}
    ${'3.5.0'}        | ${true}
    ${'1234'}         | ${false}
    ${'foo'}          | ${false}
    ${'latest'}       | ${false}
    ${''}             | ${false}
    ${'*'}            | ${false}
    ${'x'}            | ${false}
    ${'X'}            | ${false}
    ${'~1.2.3'}       | ${false}
    ${'>1.2.3'}       | ${false}
    ${'^1.2.3'}       | ${false}
    ${'1.2.3-'}       | ${false}
    ${'1.2.3-foo'}    | ${true}
    ${'3.5.0-beta.3'} | ${true}
    ${'1.2.3.'}       | ${false}
    ${'4.2.21.Final'} | ${true}
    ${'1.2.3+'}       | ${false}
    ${'1.2.3+8'}      | ${true}
    ${'1.2.3a1'}      | ${true}
    ${'1.2.3rc3'}     | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!devbox.isVersion(version)).toBe(expected);
  });

  it.each`
    version           | isValid
    ${'1'}            | ${true}
    ${'01'}           | ${false}
    ${'1.01'}         | ${false}
    ${'1.1.01'}       | ${false}
    ${'1.1'}          | ${true}
    ${'1.3.0'}        | ${true}
    ${'2.1.20'}       | ${true}
    ${'v1.4'}         | ${false}
    ${'V0.5'}         | ${false}
    ${'3.5.0'}        | ${true}
    ${'1234'}         | ${true}
    ${'foo'}          | ${false}
    ${'latest'}       | ${true}
    ${''}             | ${false}
    ${'*'}            | ${false}
    ${'x'}            | ${false}
    ${'X'}            | ${false}
    ${'~1.2.3'}       | ${false}
    ${'>1.2.3'}       | ${false}
    ${'^1.2.3'}       | ${false}
    ${'1.2.3foo'}     | ${true}
    ${'1.2.3a1'}      | ${true}
    ${'1.2.3rc3'}     | ${true}
    ${'1.2.3-foo'}    | ${true}
    ${'3.5.0-beta.3'} | ${true}
    ${'4.2.21.Final'} | ${true}
    ${'1.2.3+8'}      | ${true}
    ${'1.2.3-'}       | ${false}
    ${'1.2.3.'}       | ${false}
    ${'1.2.3+'}       | ${false}
  `('isValid("$version") === $isValid', ({ version, isValid }) => {
    expect(!!devbox.isValid(version)).toBe(isValid);
  });

  it.each`
    version       | range         | expected
    ${'1'}        | ${'1'}        | ${false}
    ${'1'}        | ${'0'}        | ${false}
    ${'1.2.3'}    | ${'1'}        | ${true}
    ${'1.2'}      | ${'1'}        | ${false}
    ${'1.0.0'}    | ${'1'}        | ${true}
    ${'1.2.0'}    | ${'1.2'}      | ${true}
    ${'1.2.3'}    | ${'1.2'}      | ${true}
    ${'0'}        | ${'latest'}   | ${false}
    ${'1.2.3'}    | ${'latest'}   | ${true}
    ${'1.2.3.5'}  | ${'1.2.3.5'}  | ${true}
    ${'1.2'}      | ${'1.2.3'}    | ${false}
    ${'1.2.3rc3'} | ${'1.2.3rc3'} | ${true}
    ${'1.2.3rc3'} | ${'1.2.3rc4'} | ${false}
    ${'1.2.3+7'}  | ${'1.2.3+8'}  | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(devbox.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    version       | range         | expected
    ${'1'}        | ${'1'}        | ${true}
    ${'1'}        | ${'0'}        | ${false}
    ${'1.2.3'}    | ${'1'}        | ${true}
    ${'1.2'}      | ${'1'}        | ${true}
    ${'1.0.0'}    | ${'1'}        | ${true}
    ${'1.2.0'}    | ${'1.2'}      | ${true}
    ${'1.2.3'}    | ${'1.2'}      | ${true}
    ${'0'}        | ${'latest'}   | ${true}
    ${'1.2.3'}    | ${'latest'}   | ${true}
    ${'latest'}   | ${'latest'}   | ${false}
    ${'latest'}   | ${'1.2.3'}    | ${false}
    ${'1.2.3.5'}  | ${'1.2.3.5'}  | ${true}
    ${'1.2'}      | ${'1.2.3'}    | ${true}
    ${'1.2.3rc3'} | ${'1.2.3rc3'} | ${true}
    ${'1.2.3rc3'} | ${'1.2.3rc4'} | ${false}
    ${'1.2.3+7'}  | ${'1.2.3+8'}  | ${false}
  `(
    'equals("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(devbox.equals(version, range)).toBe(expected);
    },
  );

  it.each`
    version        | expected
    ${'1.2.3'}     | ${true}
    ${'1.2.3-foo'} | ${false}
    ${'1.2.3+8'}   | ${true}
    ${'1.2.3a1'}   | ${false}
    ${'1.2.3rc3'}  | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(devbox.isStable(version)).toBe(expected);
  });

  it.each`
    version              | other                | expected
    ${'1.2.3'}           | ${'1.2.2'}           | ${true}
    ${'1.2.3'}           | ${'1.2.4'}           | ${false}
    ${'1.2.3'}           | ${'1.2.3'}           | ${false}
    ${'1.0.0'}           | ${'1.0.0'}           | ${false}
    ${'2.0.0'}           | ${'1.9.9'}           | ${true}
    ${'1.2'}             | ${'1.2.0'}           | ${false}
    ${'1.2.0'}           | ${'1.2'}             | ${false}
    ${'1.2.3-foo'}       | ${'1.2.2'}           | ${true}
    ${'1.2.3-foo'}       | ${'1.2.3'}           | ${true}
    ${'1.2.3-foo'}       | ${'1.2.4'}           | ${false}
    ${'1.2.3-foo'}       | ${'1.2.3-bar'}       | ${true}
    ${'1.2.3+8'}         | ${'1.2.2'}           | ${true}
    ${'1.2.3+8'}         | ${'1.2.3'}           | ${true}
    ${'1.2.3+8'}         | ${'1.2.4'}           | ${false}
    ${'1.2.3+8'}         | ${'1.2.3+7'}         | ${true}
    ${'1.2.3+8'}         | ${'1.2.3rc1'}        | ${true}
    ${'1.2.3+8'}         | ${'1.2.3a1'}         | ${true}
    ${'1.2.3+8'}         | ${'1.2.3b1'}         | ${true}
    ${'1.2.3a1'}         | ${'1.2.2'}           | ${true}
    ${'1.2.3a1'}         | ${'1.2.3'}           | ${false}
    ${'1.2.3a1'}         | ${'1.2.3a2'}         | ${false}
    ${'1.2.3rc3'}        | ${'1.2.2'}           | ${true}
    ${'1.2.3rc3'}        | ${'1.2.3'}           | ${false}
    ${'1.2.3rc1'}        | ${'1.2.3a2'}         | ${true}
    ${'3.5.0-beta.3'}    | ${'3.4.9'}           | ${true}
    ${'3.5.0-beta.3'}    | ${'3.5.0'}           | ${false}
    ${'4.2.21.Final'}    | ${'4.2.20'}          | ${true}
    ${'4.2.21.Final'}    | ${'4.2.21'}          | ${true}
    ${'4.2.21'}          | ${'4.2.21.Final'}    | ${false}
    ${'1.2.3'}           | ${'1.2.3-foo'}       | ${false}
    ${'1.2.3'}           | ${'1.2.3.5'}         | ${false}
    ${'1.2.3'}           | ${'1.2.3rc1'}        | ${true}
    ${'1.2.3'}           | ${'1.2.3a1'}         | ${true}
    ${'1.2.3alpha1'}     | ${'1.2.3a1'}         | ${false}
    ${'1.2.3beta1'}      | ${'1.2.3b1'}         | ${false}
    ${'1.2.3c1'}         | ${'1.2.3rc1'}        | ${false}
    ${'1.2.3rc1'}        | ${'1.2.3b1'}         | ${true}
    ${'1.2.3b1'}         | ${'1.2.3a1'}         | ${true}
    ${'1.2.3something1'} | ${'1.2.3a1'}         | ${true}
    ${'1.2.3a1'}         | ${'1.2.3something1'} | ${false}
    ${'1.2.3something1'} | ${'1.2.3+8'}         | ${false}
    ${'1.2.3a1.dev'}     | ${'1.2.3a1'}         | ${true}
    ${'invalid'}         | ${'1.2.3'}           | ${true}
    ${'1.2.3'}           | ${'invalid'}         | ${true}
    ${'1.2.3.5'}         | ${'1.2.3'}           | ${true}
    ${'1.2.3-bar'}       | ${'1.2.3-baz'}       | ${false}
    ${'1.2.3.5'}         | ${'1.2.3.4'}         | ${true}
    ${'1.2.3-x'}         | ${'1.2.3-y'}         | ${false}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(devbox.isGreaterThan(version, other)).toBe(expected);
    },
  );
});
