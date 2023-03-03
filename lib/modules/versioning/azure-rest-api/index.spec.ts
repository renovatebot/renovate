import { api } from '.';

describe('modules/versioning/azure-rest-api/index', () => {
  test.each`
    version         | result
    ${'2023-01-01'} | ${true}
  `('isValid("$version") === $result', ({ version, result }) => {
    const res = api.isValid(version);
    expect(res).toBe(result);
  });
});
