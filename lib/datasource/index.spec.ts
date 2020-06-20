import { mocked } from '../../test/util';
import { DATASOURCE_FAILURE } from '../constants/error-messages';
import { loadModules } from '../util/modules';
import { DatasourceError } from './common';
import * as datasourceDocker from './docker';
import * as datasourceGithubTags from './github-tags';
import * as datasourceMaven from './maven';
import * as datasourceNpm from './npm';
import * as datasourcePackagist from './packagist';
import * as datasource from '.';

jest.mock('./docker');
jest.mock('./maven');
jest.mock('./npm');
jest.mock('./packagist');

const dockerDatasource = mocked(datasourceDocker);
const mavenDatasource = mocked(datasourceMaven);
const npmDatasource = mocked(datasourceNpm);
const packagistDatasource = mocked(datasourcePackagist);

describe('datasource/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
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
    npmDatasource.getReleases.mockResolvedValue({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'node',
    });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
  it('warns if multiple registryUrls for registryStrategy=first', async () => {
    dockerDatasource.getReleases.mockResolvedValue(null);
    const res = await datasource.getPkgReleases({
      datasource: datasourceDocker.id,
      depName: 'something',
      registryUrls: ['https://docker.com', 'https://docker.io'],
    });
    expect(res).toMatchSnapshot();
  });
  it('hunts registries and returns success', async () => {
    packagistDatasource.getReleases.mockResolvedValueOnce(null);
    packagistDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourcePackagist.id,
      depName: 'something',
      registryUrls: ['https://reg1.com', 'https://reg2.io'],
    });
    expect(res).not.toBeNull();
  });
  it('hunts registries and aborts on DatasourceError', async () => {
    packagistDatasource.getReleases.mockImplementationOnce(() => {
      throw new DatasourceError(new Error());
    });
    await expect(
      datasource.getPkgReleases({
        datasource: datasourcePackagist.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow(DATASOURCE_FAILURE);
  });
  it('hunts registries and passes on error', async () => {
    packagistDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('a');
    });
    packagistDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('b');
    });
    await expect(
      datasource.getPkgReleases({
        datasource: datasourcePackagist.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow('b');
  });
  it('merges registries and returns success', async () => {
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }, { version: '1.1.0' }],
    });
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceMaven.id,
      depName: 'something',
      registryUrls: ['https://reg1.com', 'https://reg2.io'],
    });
    expect(res).toMatchSnapshot();
    expect(res.releases).toHaveLength(2);
  });
  it('merges registries and aborts on DatasourceError', async () => {
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new DatasourceError(new Error());
    });
    await expect(
      datasource.getPkgReleases({
        datasource: datasourceMaven.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow(DATASOURCE_FAILURE);
  });
  it('merges registries and passes on error', async () => {
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('a');
    });
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('b');
    });
    await expect(
      datasource.getPkgReleases({
        datasource: datasourceMaven.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow('b');
  });
  it('trims sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      sourceUrl: ' https://abc.com',
      releases: [{ version: '1.0.0' }],
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
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
