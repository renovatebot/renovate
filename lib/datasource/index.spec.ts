import { mocked } from '../../test/util';
import { loadModules } from '../util/modules';
import * as datasourceDocker from './docker';
import * as datasourceGithubTags from './github-tags';
import * as datasourceNpm from './npm';
import * as datasource from '.';

jest.mock('./docker');
jest.mock('./npm');

const npmDatasource = mocked(datasourceNpm);

describe('datasource/index', () => {
  it('returns datasources', () => {
    expect(datasource.getDatasources()).toBeDefined();
    expect(datasource.getDatasourceList()).toBeDefined();
  });
  it('validates dataource', async () => {
    function validateDatasource(
      module: datasource.Datasource,
      name: string
    ): boolean {
      if (!module.getReleases) {
        return false;
      }
      if (module.id !== name) {
        return false;
      }
      return true;
    }
    const dss = datasource.getDatasources();

    const loadedDs = loadModules(__dirname, validateDatasource);
    expect(Array.from(dss.keys())).toEqual(Object.keys(loadedDs));

    for (const dsName of dss.keys()) {
      const ds = await dss.get(dsName);
      expect(validateDatasource(ds, dsName)).toBe(true);
    }
  });
  it('returns if digests are supported', async () => {
    expect(
      await datasource.supportsDigests({ datasource: datasourceGithubTags.id })
    ).toBe(true);
  });
  it('returns null for no datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        datasource: null,
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns null for no lookupName', async () => {
    expect(
      await datasource.getPkgReleases({
        datasource: 'npm',
        depName: null,
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
    npmDatasource.getReleases.mockResolvedValue({ releases: [] });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({ releases: [] });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'node',
    });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
  it('trims sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      sourceUrl: ' https://abc.com',
      releases: [],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://abc.com');
  });
  it('massages sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      sourceUrl: 'scm:git@github.com:Jasig/cas.git',
      releases: [],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
