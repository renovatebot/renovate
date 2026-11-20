import { isPublicRegistry } from './url.ts';

describe('modules/datasource/repology/url', () => {
  it.each`
    registryUrl                            | expected
    ${'https://repology.org/'}             | ${true}
    ${'not-a-url'}                         | ${false}
    ${'https://example.com/'}              | ${false}
    ${'https://repology.org/custom/'}      | ${false}
    ${'https://user@repology.org/'}        | ${false}
    ${'https://:password@repology.org/'}   | ${false}
    ${'https://repology.org/?query=value'} | ${false}
    ${'https://repology.org/#fragment'}    | ${false}
  `('returns $expected for $registryUrl', ({ registryUrl, expected }) => {
    expect(isPublicRegistry(registryUrl)).toBe(expected);
  });
});
