import { isPublicRegistry } from './url.ts';

describe('modules/datasource/gradle-version/url', () => {
  it.each`
    registryUrl                                             | expected
    ${'https://services.gradle.org/versions/all'}           | ${true}
    ${'https://SERVICES.GRADLE.ORG:443/versions/all'}       | ${true}
    ${undefined}                                            | ${false}
    ${'not-a-url'}                                          | ${false}
    ${'http://services.gradle.org/versions/all'}            | ${false}
    ${'https://example.com/versions/all'}                   | ${false}
    ${'https://services.gradle.org/versions/other'}         | ${false}
    ${'https://user@services.gradle.org/versions/all'}      | ${false}
    ${'https://:password@services.gradle.org/versions/all'} | ${false}
    ${'https://services.gradle.org/versions/all?foo=bar'}   | ${false}
    ${'https://services.gradle.org/versions/all#fragment'}  | ${false}
  `('returns $expected for $registryUrl', ({ registryUrl, expected }) => {
    expect(isPublicRegistry(registryUrl)).toBe(expected);
  });
});
