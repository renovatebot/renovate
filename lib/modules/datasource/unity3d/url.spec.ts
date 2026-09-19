import { isPublicPageUrl } from './url.ts';

describe('modules/datasource/unity3d/url', () => {
  it.each`
    pageUrl                                                                                                                                                | expected
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?stream=LTS&limit=25&offset=0'}                                                      | ${true}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?stream=TECH&limit=25&offset=0'}                                                     | ${true}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?stream=ALPHA&limit=25&offset=0'}                                                    | ${true}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?stream=BETA&limit=25&offset=0'}                                                     | ${true}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?stream=LTS&limit=25&offset=0&order=asc&platform=win&architecture=x64&version=6000'} | ${true}
    ${'https://SERVICES.API.UNITY.COM:443/unity/editor/release/v1/releases?stream=LTS&limit=25&offset=0'}                                                  | ${true}
    ${'not-a-url'}                                                                                                                                         | ${false}
    ${'https://example.com/unity/editor/release/v1/releases?stream=LTS'}                                                                                   | ${false}
    ${'https://user@services.api.unity.com/unity/editor/release/v1/releases?stream=LTS'}                                                                   | ${false}
    ${'https://:password@services.api.unity.com/unity/editor/release/v1/releases?stream=LTS'}                                                              | ${false}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases#fragment'}                                                                          | ${false}
    ${'https://services.api.unity.com/other?stream=LTS'}                                                                                                   | ${false}
    ${'https://services.api.unity.com/unity/editor/release/v1/releases?account=private'}                                                                   | ${false}
  `('returns $expected for $pageUrl', ({ pageUrl, expected }) => {
    expect(isPublicPageUrl(pageUrl)).toBe(expected);
  });
});
