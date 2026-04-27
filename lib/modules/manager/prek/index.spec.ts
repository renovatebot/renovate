import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import {
  categories,
  defaultConfig,
  knownDepTypes,
  supportedDatasources,
} from './index.ts';

describe('modules/manager/prek/index', () => {
  it('matches prek.toml files', () => {
    expect(defaultConfig.managerFilePatterns).toEqual(['/(^|/)prek\\.toml$/']);
  });

  it('categorizes prek as a git manager', () => {
    expect(categories).toEqual(['git']);
  });

  it('lists all datasources used by extraction', () => {
    expect(supportedDatasources).toEqual(
      expect.arrayContaining([
        GithubTagsDatasource.id,
        GitlabTagsDatasource.id,
        NpmDatasource.id,
        PypiDatasource.id,
        GoDatasource.id,
      ]),
    );
  });

  it('exports known dep types for manager docs metadata', () => {
    expect(knownDepTypes.map(({ depType }) => depType)).toEqual(
      expect.arrayContaining([
        'repository',
        'pre-commit-node',
        'pre-commit-python',
        'pre-commit-golang',
      ]),
    );
  });
});
