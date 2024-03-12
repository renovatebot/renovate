import { api as azureRestApi } from '.';

describe('modules/versioning/azure-rest-api/index', () => {
  it.each`
    version                        | expected
    ${'0000-00-00'}                | ${true}
    ${'2023-01-01'}                | ${true}
    ${'2023-01-01-preview'}        | ${true}
    ${'2023-01-01-alpha'}          | ${true}
    ${'2023-01-01-beta'}           | ${true}
    ${'2023-01-01-rc'}             | ${true}
    ${'2023-01-01-privatepreview'} | ${true}
    ${'2023-01-01preview'}         | ${false}
    ${'2023-01-01 '}               | ${false}
    ${' 2023-01-01'}               | ${false}
    ${'2023-01-01-'}               | ${false}
    ${'2023 01 01'}                | ${false}
    ${'2023-01-01-23'}             | ${false}
    ${'2023.01.01'}                | ${false}
    ${'2023_01_01'}                | ${false}
    ${'2023/01/01'}                | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(azureRestApi.isValid(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${'2023-01-01'}         | ${true}
    ${'2023-01-01-preview'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(azureRestApi.isCompatible(version)).toBe(expected);
  });

  it.each`
    version                        | expected
    ${'2023-01-01'}                | ${true}
    ${'2023-01-01-preview'}        | ${false}
    ${'2023-01-01-rc'}             | ${false}
    ${'2023-01-01-alpha'}          | ${false}
    ${'2023-01-01-beta'}           | ${false}
    ${'2023-01-01-privatepreview'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(azureRestApi.isStable(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${'2023-01-01'}         | ${true}
    ${'2023-01-01-preview'} | ${true}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(azureRestApi.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${'2023-01-01'}         | ${true}
    ${'2023-01-01-preview'} | ${true}
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${123}                  | ${false}
    ${'1.2.3'}              | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(azureRestApi.isVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${'2023-01-01'}         | ${20230101}
    ${'2023-01-01-preview'} | ${20230101}
  `('getMajor("$version") === 1', ({ version, expected }) => {
    expect(azureRestApi.getMajor(version)).toBe(expected);
  });

  it.each`
    version
    ${'2023-01-01'}
    ${'2023-01-01-preview'}
  `('getMinor("$version") === 0', ({ version }) => {
    expect(azureRestApi.getMinor(version)).toBe(0);
  });

  it.each`
    version
    ${'2023-01-01'}
    ${'2023-01-01-preview'}
  `('getPatch("$version") === 0', ({ version }) => {
    expect(azureRestApi.getPatch(version)).toBe(0);
  });

  it.each`
    version                 | other                   | expected
    ${'2023-01-01'}         | ${'2023-01-01'}         | ${true}
    ${'2023-01-01-preview'} | ${'2023-01-01-preview'} | ${true}
    ${'2023-01-01'}         | ${'2023-01-02'}         | ${false}
    ${'2023-01-01'}         | ${'2023-02-01'}         | ${false}
    ${'2023-01-01'}         | ${'2024-01-01'}         | ${false}
  `(
    'equals("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(azureRestApi.equals(version, other)).toBe(expected);
    },
  );

  it.each`
    version                 | other                   | expected
    ${'2023-01-01'}         | ${'2023-01-02'}         | ${false}
    ${'2023-01-01'}         | ${'2023-02-01'}         | ${false}
    ${'2023-01-01'}         | ${'2024-01-01'}         | ${false}
    ${'2023-01-01'}         | ${'2023-01-01'}         | ${false}
    ${'2023-01-01-preview'} | ${'2023-01-01-preview'} | ${false}
    ${'2023-01-02'}         | ${'2023-01-01'}         | ${true}
    ${'2023-02-01'}         | ${'2023-01-01'}         | ${true}
    ${'2024-01-01'}         | ${'2023-01-01'}         | ${true}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(azureRestApi.isGreaterThan(version, other)).toBe(expected);
    },
  );

  it.each`
    version                 | other                   | expected
    ${'2023-01-01'}         | ${'2023-01-01'}         | ${0}
    ${'2023-01-01-preview'} | ${'2023-01-01-preview'} | ${0}
    ${'2023-01-01'}         | ${'2023-01-02'}         | ${-1}
    ${'2023-01-01'}         | ${'2023-02-01'}         | ${-1}
    ${'2023-01-01'}         | ${'2024-01-01'}         | ${-1}
    ${'2023-01-02'}         | ${'2023-01-01'}         | ${1}
    ${'2023-02-01'}         | ${'2023-01-01'}         | ${1}
    ${'2024-01-01'}         | ${'2023-01-01'}         | ${1}
  `(
    'sortVersions("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(azureRestApi.sortVersions(version, other)).toBe(expected);
    },
  );
});
