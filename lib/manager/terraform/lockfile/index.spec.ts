import { readFileSync } from 'fs';
import _fs from 'fs-extra';
import { join } from 'upath';
import * as httpMock from '../../../../test/http-mock';
import { getName } from '../../../../test/util';
import { getPkgReleases } from '../../../datasource';
import { defaultRegistryUrls } from '../../../datasource/terraform-provider';
import type { UpdateArtifactsConfig } from '../../types';
import hash from './hash';
import { updateArtifacts } from './index';

// auto-mock fs
jest.mock('fs-extra');
jest.mock('./hash');
jest.mock('../../../datasource');

jest.setTimeout(15000);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  constraints: {},
};

const validLockfile = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/validLockfile.hcl',
  'utf8'
);

const releaseBackendAWS = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/releaseBackendAWS_3_36_0.json',
  'utf8'
);

const releaseBackendRandom = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/releaseBackendRandom_3_1_0.json',
  'utf8'
);

const releaseBackendAzurerm = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/releaseBackendAzurerm_2_56_0.json',
  'utf8'
);

const serviceDiscoveryResult = readFileSync(
  'lib/datasource/terraform-module/__fixtures__/service-discovery.json'
);

const fs: jest.Mocked<typeof _fs> = _fs as any;
const mockHash = hash as jest.MockedFunction<typeof hash>;
const mockGetPkgReleases = getPkgReleases as jest.MockedFunction<
  typeof getPkgReleases
>;

const registryUrl = defaultRegistryUrls[0];
const releaseBackendUrl = defaultRegistryUrls[1];

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    httpMock.reset();
    httpMock.setup();
  });
  afterEach(() => {
    httpMock.reset();
  });
  it('returns null if no .terraform.lock.hcl found', async () => {
    fs.readFile.mockResolvedValueOnce(null);
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: ['aws'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if .terraform.lock.hcl is empty', async () => {
    fs.readFile.mockResolvedValueOnce('empty');
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: ['aws'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('update single dependency with exact constraint', async () => {
    fs.readFile.mockResolvedValueOnce(validLockfile);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-aws/3.36.0/index.json')
      .reply(200, JSON.parse(releaseBackendAWS));

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'minor',
      newVersion: '3.36.0',
      newValue: '3.36.0',
      ...config,
    };
    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: ['aws'],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result[0].file).not.toBeNull();
    expect(result[0].file).toMatchSnapshot();
    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });
  it('update single dependency with range constraint and minor update', async () => {
    fs.readFile.mockResolvedValueOnce(validLockfile);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .reply(200, JSON.parse(releaseBackendAzurerm));

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'minor',
      newVersion: '2.56.0',
      newValue: '~> 2.50',
      ...config,
    };
    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: ['azurerm'],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result[0].file).not.toBeNull();
    expect(result[0].file).toMatchSnapshot();
    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });
  it('update single dependency with range constraint and major update', async () => {
    fs.readFile.mockResolvedValueOnce(validLockfile);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-random/3.1.0/index.json')
      .reply(200, JSON.parse(releaseBackendRandom));

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'major',
      newVersion: '3.1.0',
      newValue: '~> 3.0',
      ...config,
    };
    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: ['random'],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result[0].file).not.toBeNull();
    expect(result[0].file).toMatchSnapshot();
    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });
  it('do full lock file maintenance', async () => {
    httpMock
      .scope(registryUrl)
      .get('/.well-known/terraform.json')
      .reply(200, serviceDiscoveryResult);

    fs.readFile.mockResolvedValueOnce(validLockfile);

    mockGetPkgReleases
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // aws
            releases: [
              {
                version: '2.30.0',
              },
              {
                version: '3.0.0',
              },
              {
                version: '3.36.0',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // azurerm
            releases: [
              {
                version: '2.50.0',
              },
              {
                version: '2.55.0',
              },
              {
                version: '2.56.0',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // random
            releases: [
              {
                version: '2.2.1',
              },
              {
                version: '2.2.2',
              },
              {
                version: '3.0.0',
              },
            ],
          })
        )
      );
    mockHash.mockResolvedValue([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'lockFileMaintenance',
      ...config,
    };
    const result = await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    result.forEach((value) => expect(value.file).not.toBeNull());
    result.forEach((value) => expect(value.file).toMatchSnapshot());
    expect(mockHash.mock.calls).toBeArrayOfSize(2);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });
  it('do full lock file maintenance without needed changes', async () => {
    httpMock
      .scope(registryUrl)
      .get('/.well-known/terraform.json')
      .reply(200, serviceDiscoveryResult);

    fs.readFile.mockResolvedValueOnce(validLockfile);

    mockGetPkgReleases
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // aws
            releases: [
              {
                version: '2.30.0',
              },
              {
                version: '3.0.0',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // azurerm
            releases: [
              {
                version: '2.50.0',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Promise((resolve) =>
          resolve({
            // random
            releases: [
              {
                version: '2.2.1',
              },
            ],
          })
        )
      );
    mockHash.mockResolvedValue([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'lockFileMaintenance',
      ...config,
    };
    const result = await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: localConfig,
    });
    expect(result).toBeNull();
    expect(mockHash.mock.calls).toBeArrayOfSize(0);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });
});
