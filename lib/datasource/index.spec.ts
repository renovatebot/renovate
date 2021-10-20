import fs from 'fs-extra';
import * as httpMock from '../../test/http-mock';
import { logger, mocked } from '../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  HOST_DISABLED,
} from '../constants/error-messages';
import { ExternalHostError } from '../types/errors/external-host-error';
import { loadModules } from '../util/modules';
import { Datasource } from './datasource';
import * as datasourceDocker from './docker';
import { GalaxyDatasource } from './galaxy';
import * as datasourceGithubTags from './github-tags';
import * as datasourceMaven from './maven';
import * as datasourceNpm from './npm';
import { PackagistDatasource } from './packagist';
import type { DatasourceApi } from './types';
import * as datasource from '.';

jest.mock('./docker');
jest.mock('./maven');
jest.mock('./npm');
jest.mock('./packagist', () => ({
  __esModule: true,
  PackagistDatasource: jest.fn(() => {
    const { PackagistDatasource: ActualPackagistDatasource } =
      jest.requireActual('./packagist');
    return Object.assign(Object.create(ActualPackagistDatasource.prototype), {
      id: 'packagist',
      registryStrategy: 'hunt',
      customRegistrySupport: true,
      getReleases: () => packagistDatasourceGetReleasesMock(),
    });
  }),
}));

const dockerDatasource = mocked(datasourceDocker);
const mavenDatasource = mocked(datasourceMaven);
const npmDatasource = mocked(datasourceNpm);
const packagistDatasourceGetReleasesMock = jest.fn();
const { PackagistDatasource: ActualPackagistDatasource } =
  jest.requireActual('./packagist');

describe('datasource/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns datasources', () => {
    expect(datasource.getDatasources()).toBeDefined();

    const managerList = fs
      .readdirSync(__dirname, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map((dirent) => dirent.name)
      .sort();
    expect(datasource.getDatasourceList()).toEqual(managerList);
  });
  it('validates datasource', () => {
    function validateDatasource(module: DatasourceApi, name: string): boolean {
      if (!module.getReleases) {
        return false;
      }
      return module.id === name;
    }
    function filterClassBasedDatasources(name: string): boolean {
      return !(datasource.getDatasources().get(name) instanceof Datasource);
    }
    const dss = new Map(datasource.getDatasources());

    for (const ds of dss.values()) {
      if (ds instanceof Datasource) {
        dss.delete(ds.id);
      }
    }

    const loadedDs = loadModules(
      __dirname,
      validateDatasource,
      filterClassBasedDatasources
    );
    expect(Array.from(dss.keys())).toEqual(Object.keys(loadedDs));

    for (const dsName of dss.keys()) {
      const ds = dss.get(dsName);
      expect(validateDatasource(ds, dsName)).toBeTrue();
    }
  });
  it('returns if digests are supported', () => {
    expect(datasource.supportsDigests(datasourceGithubTags.id)).toBeTrue();
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
  it('returns class datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        datasource: 'cdnjs',
        depName: null,
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
    expect(res).toMatchSnapshot({
      changelogUrl:
        'https://github.com/react-native-community/react-native-releases/blob/master/CHANGELOG.md',
    });
  });
  it('applies extractVersion', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      releases: [
        { version: 'v1.0.0' },
        { version: 'v1.0.1' },
        { version: 'v2' },
      ],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'react-native',
      extractVersion: '^(?<version>v\\d+\\.\\d+)',
      versioning: 'loose',
    });
    expect(res.releases).toHaveLength(1);
    expect(res.releases[0].version).toBe('v1.0');
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'node',
    });
    expect(res).toMatchSnapshot({
      sourceUrl: 'https://github.com/nodejs/node',
    });
  });
  it('ignores and warns for registryUrls', async () => {
    httpMock
      .scope('https://galaxy.ansible.com')
      .get('/api/v1/roles/')
      .query({ owner__username: 'some', name: 'dep' })
      .reply(200, {});
    await datasource.getPkgReleases({
      datasource: GalaxyDatasource.id,
      depName: 'some.dep',
      registryUrls: ['https://google.com/'],
    });
    expect(logger.logger.warn).toHaveBeenCalled();
  });
  it('warns if multiple registryUrls for registryStrategy=first', async () => {
    dockerDatasource.getReleases.mockResolvedValue(null);
    const res = await datasource.getPkgReleases({
      datasource: datasourceDocker.id,
      depName: 'something',
      registryUrls: ['https://docker.com', 'https://docker.io'],
    });
    expect(res).toBeNull();
  });
  it('hunts registries and returns success', async () => {
    packagistDatasourceGetReleasesMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        releases: [{ version: '1.0.0' }],
      });
    const res = await datasource.getPkgReleases({
      datasource: ActualPackagistDatasource.id,
      depName: 'something',
      registryUrls: ['https://reg1.com', 'https://reg2.io'],
    });
    expect(res).not.toBeNull();
  });
  it('returns null for HOST_DISABLED', async () => {
    packagistDatasourceGetReleasesMock.mockImplementationOnce(() => {
      throw new ExternalHostError(new Error(HOST_DISABLED));
    });
    expect(
      await datasource.getPkgReleases({
        datasource: ActualPackagistDatasource.id,
        depName: 'something',
        registryUrls: ['https://reg1.com'],
      })
    ).toBeNull();
  });
  it('hunts registries and aborts on ExternalHostError', async () => {
    packagistDatasourceGetReleasesMock.mockRejectedValue(
      new ExternalHostError(new Error())
    );
    await expect(
      datasource.getPkgReleases({
        datasource: ActualPackagistDatasource.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });
  it('hunts registries and returns null', async () => {
    packagistDatasourceGetReleasesMock.mockImplementationOnce(() => {
      throw new Error('a');
    });
    packagistDatasourceGetReleasesMock.mockImplementationOnce(() => {
      throw new Error('b');
    });
    expect(
      await datasource.getPkgReleases({
        datasource: PackagistDatasource.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).toBeNull();
  });
  it('merges custom defaultRegistryUrls and returns success', async () => {
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }, { version: '1.1.0' }],
    });
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceMaven.id,
      depName: 'something',
      defaultRegistryUrls: ['https://reg1.com', 'https://reg2.io'],
    });
    expect(res).toEqual({
      releases: [
        {
          registryUrl: 'https://reg1.com',
          version: '1.0.0',
        },
        {
          registryUrl: 'https://reg1.com',
          version: '1.1.0',
        },
      ],
    });
  });
  it('ignores custom defaultRegistryUrls if registrUrls are set', async () => {
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }, { version: '1.1.0' }],
    });
    mavenDatasource.getReleases.mockResolvedValueOnce({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceMaven.id,
      depName: 'something',
      defaultRegistryUrls: ['https://reg3.com'],
      registryUrls: ['https://reg1.com', 'https://reg2.io'],
    });
    expect(res).toEqual({
      releases: [
        {
          registryUrl: 'https://reg1.com',
          version: '1.0.0',
        },
        {
          registryUrl: 'https://reg1.com',
          version: '1.1.0',
        },
      ],
    });
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
    expect(res).toEqual({
      releases: [
        {
          registryUrl: 'https://reg1.com',
          version: '1.0.0',
        },
        {
          registryUrl: 'https://reg1.com',
          version: '1.1.0',
        },
      ],
    });
  });
  it('merges registries and aborts on ExternalHostError', async () => {
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new ExternalHostError(new Error());
    });
    await expect(
      datasource.getPkgReleases({
        datasource: datasourceMaven.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });
  it('merges registries and returns null for error', async () => {
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('a');
    });
    mavenDatasource.getReleases.mockImplementationOnce(() => {
      throw new Error('b');
    });
    expect(
      await datasource.getPkgReleases({
        datasource: datasourceMaven.id,
        depName: 'something',
        registryUrls: ['https://reg1.com', 'https://reg2.io'],
      })
    ).toBeNull();
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
    expect(res.sourceUrl).toBe('https://abc.com');
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
    expect(res.sourceUrl).toBe('https://github.com/Jasig/cas');
  });

  it('applies replacements', async () => {
    npmDatasource.getReleases.mockResolvedValue({
      releases: [{ version: '1.0.0' }],
    });
    const res = await datasource.getPkgReleases({
      datasource: datasourceNpm.id,
      depName: 'abc',
      replacementName: 'def',
      replacementVersion: '2.0.0',
    });
    expect(res.replacementName).toBe('def');
    expect(res.replacementVersion).toBe('2.0.0');
  });
});
