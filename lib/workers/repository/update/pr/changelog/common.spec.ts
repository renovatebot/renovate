import { slugifyUrl } from './common';

describe('workers/repository/update/pr/changelog/common', () => {
  it.each`
    url                                                    | expected
    ${'https://github-enterprise.example.com/çhãlk/chálk'} | ${'https-github-enterprise-example-com-chalk-chalk'}
    ${'https://github.com/chalk/chalk'}                    | ${'https-github-com-chalk-chalk'}
    ${'https://github-enterprise.example.com/'}            | ${'https-github-enterprise-example-com'}
    ${'https://github.com/sindresorhus/delay'}             | ${'https-github-com-sindresorhus-delay'}
    ${'https://github.com/🔥/∂u/∂t/equals/α∇^2u'}          | ${'https-github-com-du-dt-equals-a2u'}
  `('isSingleVersion("$url") === $expected', ({ url, expected }) => {
    expect(slugifyUrl(url)).toBe(expected);
  });
});
