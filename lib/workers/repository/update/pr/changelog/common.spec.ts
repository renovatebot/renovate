import { compareChangelogFilePath, slugifyUrl } from './common';

describe('workers/repository/update/pr/changelog/common', () => {
  describe('slugifyUrl()', () => {
    it.each`
      url                                                    | expected
      ${'https://github-enterprise.example.com/çhãlk/chálk'} | ${'https-github-enterprise-example-com-chalk-chalk'}
      ${'https://github.com/chalk/chalk'}                    | ${'https-github-com-chalk-chalk'}
      ${'https://github-enterprise.example.com/'}            | ${'https-github-enterprise-example-com'}
      ${'https://github.com/sindresorhus/delay'}             | ${'https-github-com-sindresorhus-delay'}
      ${'https://github.com/🔥/∂u/∂t/equals/α∇^2u'}          | ${'https-github-com-du-dt-equals-a2u'}
    `('slugifyUrl("$url") === $expected', ({ url, expected }) => {
      expect(slugifyUrl(url)).toBe(expected);
    });
  });

  describe('compareChangelogFilePath()', () => {
    it.each`
      files                                                               | expected
      ${['CHANGELOG', 'CHANGELOG.md', 'CHANGELOG.json', 'CHANGELOG.txt']} | ${['CHANGELOG.md', 'CHANGELOG.txt', 'CHANGELOG', 'CHANGELOG.json']}
    `('sorts $files to $expected', ({ files, expected }) => {
      expect(files.sort(compareChangelogFilePath)).toEqual(expected);
    });
  });
});
