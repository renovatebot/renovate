import {
  compareChangelogFilePath,
  isFreshRelease,
  slugifyUrl,
} from './common.ts';

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

  describe('isFreshRelease()', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-10-19T12:00:00Z') });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each`
      releaseDate                         | expected
      ${'2026-10-19T11:30:00Z'}           | ${true}
      ${new Date('2026-10-19T11:30:00Z')} | ${true}
      ${'2026-10-19T11:00:00Z'}           | ${false}
      ${'2026-10-18T11:30:00Z'}           | ${false}
      ${'not a date'}                     | ${false}
      ${undefined}                        | ${false}
      ${null}                             | ${false}
    `(
      'isFreshRelease($releaseDate) === $expected',
      ({ releaseDate, expected }) => {
        expect(isFreshRelease(releaseDate)).toBe(expected);
      },
    );
  });
});
