import { isPublicRepository } from './url.ts';

describe('modules/datasource/helm/url', () => {
  it.each`
    repositoryUrl                                | expected
    ${'https://charts.helm.sh/stable'}           | ${true}
    ${'https://charts.helm.sh/stable/'}          | ${true}
    ${'https://CHARTS.HELM.SH:443/stable'}       | ${true}
    ${'not-a-url'}                               | ${false}
    ${'s3://chart-bucket/charts'}                | ${false}
    ${'http://charts.helm.sh/stable'}            | ${false}
    ${'https://example.com/stable'}              | ${false}
    ${'https://charts.helm.sh/other'}            | ${false}
    ${'https://user@charts.helm.sh/stable'}      | ${false}
    ${'https://:password@charts.helm.sh/stable'} | ${false}
    ${'https://charts.helm.sh/stable?foo=bar'}   | ${false}
    ${'https://charts.helm.sh/stable#fragment'}  | ${false}
  `('returns $expected for $repositoryUrl', ({ repositoryUrl, expected }) => {
    expect(isPublicRepository(repositoryUrl)).toBe(expected);
  });
});
