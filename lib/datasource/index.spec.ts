import * as datasource from '.';

import * as datasourceDocker from './docker';
import * as datasourceGithubTags from './github-tags';
import * as datasourceNpm from './npm';

jest.mock('./docker');
jest.mock('./npm');

const npmDatasource = mocked(datasourceNpm);

describe('datasource/index', () => {
  it('returns datasources', () => {
    expect(datasource.getDatasources()).toBeDefined();
    expect(datasource.getDatasourceList()).toBeDefined();
  });
  it('returns if digests are supported', () => {
    expect(
      datasource.supportsDigests({ datasource: datasourceGithubTags.id })
    ).toBe(true);
  });
  it('returns null for no datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns null for unknown datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        datasource: 'gitbucket',
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await datasource.getDigest({
        datasource: datasourceDocker.id,
        depName: 'docker/node',
      })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'node',
    });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
  it('trims sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({
      sourceUrl: ' https://abc.com',
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://abc.com');
  });
  it('massages sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({
      sourceUrl: 'scm:git@github.com:Jasig/cas.git',
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
