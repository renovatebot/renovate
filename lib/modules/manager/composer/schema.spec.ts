import { Repos, ReposArray, ReposRecord } from './schema';

describe('modules/manager/composer/schema', () => {
  describe('ReposRecord', () => {
    it('parses default values', () => {
      expect(ReposRecord.parse({})).toEqual([]);
    });

    it('parses repositories', () => {
      expect(
        ReposRecord.parse({
          wpackagist: { type: 'composer', url: 'https://wpackagist.org' },
          someGit: { type: 'vcs', url: 'https://some-vcs.com' },
          somePath: { type: 'path', url: '/some/path' },
          packagist: false,
          'packagist.org': false,
          foo: 'bar',
        }),
      ).toEqual([
        { type: 'composer', url: 'https://wpackagist.org' },
        { name: 'someGit', type: 'git', url: 'https://some-vcs.com' },
        { name: 'somePath', type: 'path', url: '/some/path' },
        { type: 'disable-packagist' },
        { type: 'disable-packagist' },
      ]);
    });
  });

  describe('ReposArray', () => {
    it('parses default values', () => {
      expect(ReposArray.parse([])).toEqual([]);
    });

    it('parses repositories', () => {
      expect(
        ReposArray.parse([
          {
            type: 'composer',
            url: 'https://wpackagist.org',
          },
          { name: 'someGit', type: 'vcs', url: 'https://some-vcs.com' },
          { name: 'somePath', type: 'path', url: '/some/path' },
          { packagist: false },
          { 'packagist.org': false },
          { foo: 'bar' },
        ]),
      ).toEqual([
        { type: 'composer', url: 'https://wpackagist.org' },
        { name: 'someGit', type: 'git', url: 'https://some-vcs.com' },
        { name: 'somePath', type: 'path', url: '/some/path' },
        { type: 'disable-packagist' },
        { type: 'disable-packagist' },
      ]);
    });
  });

  describe('Repos', () => {
    it('parses default values', () => {
      expect(Repos.parse(null)).toEqual({
        pathRepos: {},
        gitRepos: {},
        registryUrls: null,
      });
    });

    it('parses repositories', () => {
      expect(
        Repos.parse([
          {
            name: 'wpackagist',
            type: 'composer',
            url: 'https://wpackagist.org',
          },
          { name: 'someGit', type: 'vcs', url: 'https://some-vcs.com' },
          { name: 'somePath', type: 'path', url: '/some/path' },
        ]),
      ).toEqual({
        pathRepos: {
          somePath: { name: 'somePath', type: 'path', url: '/some/path' },
        },
        registryUrls: ['https://wpackagist.org', 'https://packagist.org'],
        gitRepos: {
          someGit: {
            name: 'someGit',
            type: 'git',
            url: 'https://some-vcs.com',
          },
        },
      });
    });

    it(`parses repositories with packagist disabled`, () => {
      expect(
        Repos.parse({
          wpackagist: { type: 'composer', url: 'https://wpackagist.org' },
          someGit: { type: 'vcs', url: 'https://some-vcs.com' },
          somePath: { type: 'path', url: '/some/path' },
          packagist: false,
        }),
      ).toEqual({
        pathRepos: {
          somePath: { name: 'somePath', type: 'path', url: '/some/path' },
        },
        registryUrls: ['https://wpackagist.org'],
        gitRepos: {
          someGit: {
            name: 'someGit',
            type: 'git',
            url: 'https://some-vcs.com',
          },
        },
      });
    });
  });
});
