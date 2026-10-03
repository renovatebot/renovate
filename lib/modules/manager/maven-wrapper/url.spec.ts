import { isPublicArtifactUrl } from './url.ts';

describe('modules/manager/maven-wrapper/url', () => {
  it.each`
    url                                                                                                      | expected
    ${'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip'} | ${true}
    ${'https://repo1.maven.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar'} | ${true}
    ${'https://REPO.MAVEN.APACHE.ORG:443/maven2/file.zip'}                                                   | ${true}
    ${'not-a-url'}                                                                                           | ${false}
    ${'https://example.com/maven2/org/apache/maven/apache-maven/3.9.9/file.zip'}                             | ${false}
    ${'http://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/file.zip'}                    | ${false}
    ${'https://repo.maven.apache.org/other/file.zip'}                                                        | ${false}
    ${'https://user@repo.maven.apache.org/maven2/file.zip'}                                                  | ${false}
    ${'https://:password@repo.maven.apache.org/maven2/file.zip'}                                             | ${false}
    ${'https://repo.maven.apache.org/maven2/file.zip?token=secret'}                                          | ${false}
    ${'https://repo.maven.apache.org/maven2/file.zip?'}                                                      | ${false}
    ${'https://repo.maven.apache.org/maven2/file.zip#fragment'}                                              | ${false}
    ${'https://repo.maven.apache.org/maven2/file.zip#'}                                                      | ${false}
  `('returns $expected for $url', ({ url, expected }) => {
    expect(isPublicArtifactUrl(url)).toBe(expected);
  });
});
