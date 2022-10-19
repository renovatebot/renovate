import { join } from 'upath';
import { Fixtures } from '../../../../../test/fixtures';
import { fs, mocked } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import { updateArtifacts } from '../index';
import { TerraformProviderHash } from './hash';

// auto-mock fs
jest.mock('../../../../util/fs');
jest.mock('./hash');
jest.mock('../../../datasource');

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const validLockfile = Fixtures.get('validLockfile.hcl');
const validLockfile2 = Fixtures.get('validLockfile2.hcl');

const mockHash = mocked(TerraformProviderHash).createHashes;
const mockGetPkgReleases = getPkgReleases as jest.MockedFunction<
  typeof getPkgReleases
>;

describe('modules/manager/terraform/lockfile/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no .terraform.lock.hcl found', async () => {
    fs.readLocalFile.mockResolvedValueOnce('');

    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if .terraform.lock.hcl is empty', async () => {
    fs.readLocalFile.mockResolvedValueOnce('empty');

    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('update single dependency with exact constraint and depType provider', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'hashicorp/aws',
          packageName: 'hashicorp/aws',
          depType: 'provider',
          newVersion: '3.36.0',
          newValue: '3.36.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('update single dependency with exact constraint and and depType required_provider', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'hashicorp/aws',
          packageName: 'hashicorp/aws',
          depType: 'required_provider',
          newVersion: '3.36.0',
          newValue: '3.36.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('do not update dependency with depType module', async () => {
    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'terraform-aws-modules/vpc/aws',
          packageName: 'terraform-aws-modules/vpc/aws',
          depType: 'module',
          newVersion: '3.36.0',
          newValue: '3.36.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).toBeNull();
  });

  it('update single dependency with range constraint and minor update from private registry', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'azurerm',
          depType: 'provider',
          packageName: 'azurerm',
          registryUrls: ['https://registry.example.com'],
          newVersion: '2.56.0',
          newValue: '~> 2.50',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('update single dependency with range constraint and major update', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'random',
          packageName: 'hashicorp/random',
          depType: 'provider',
          newVersion: '3.1.0',
          newValue: '~> 3.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('update single dependency in subfolder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('test/.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'test/main.tf',
      updatedDeps: [
        {
          depName: 'random',
          packageName: 'hashicorp/random',
          depType: 'provider',
          newVersion: '3.1.0',
          newValue: '~> 3.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(1);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('update multiple dependencies which are not ordered', async () => {
    fs.readLocalFile.mockResolvedValue(validLockfile2);
    fs.getSiblingFileName.mockReturnValue('test/.terraform.lock.hcl');

    mockHash.mockResolvedValue([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'test/main.tf',
      updatedDeps: [
        {
          depName: 'aws',
          packageName: 'hashicorp/aws',
          depType: 'provider',
          newVersion: '3.1.0',
          newValue: '~> 3.0',
        },
        {
          depName: 'random',
          packageName: 'hashicorp/random',
          depType: 'provider',
          newVersion: '3.1.0',
          newValue: '~> 3.0',
        },
        {
          depName: 'azurerm',
          packageName: 'hashicorp/azurerm',
          depType: 'provider',
          newVersion: '2.56.0',
          newValue: '~> 2.50',
        },
        {
          depName: 'proxmox',
          packageName: 'Telmate/proxmox',
          depType: 'provider',
          newVersion: '2.7.0',
          newValue: '~> 2.7.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(1);
    expect(result?.[0].file).not.toBeNull();
    expect(result?.[0].file).toMatchSnapshot();

    expect(mockHash.mock.calls).toBeArrayOfSize(4);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('do full lock file maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('.terraform.lock.hcl');

    mockGetPkgReleases
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      });
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

    result?.forEach((value) => expect(value.file).not.toBeNull());
    result?.forEach((value) => expect(value.file).toMatchSnapshot());

    expect(mockHash.mock.calls).toBeArrayOfSize(2);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('do full lock file maintenance with lockfile in subfolder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);
    fs.getSiblingFileName.mockReturnValueOnce('subfolder/.terraform.lock.hcl');

    mockGetPkgReleases
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      });
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

    result?.forEach((value) => expect(value.file).not.toBeNull());
    result?.forEach((value) => expect(value.file).toMatchSnapshot());

    expect(mockHash.mock.calls).toBeArrayOfSize(2);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('do full lock file maintenance without necessary changes', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);

    mockGetPkgReleases
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        // azurerm
        releases: [
          {
            version: '2.50.0',
          },
        ],
      })
      .mockResolvedValueOnce({
        // random
        releases: [
          {
            version: '2.2.1',
          },
        ],
      });
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

  it('return null if hashing fails', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile);

    mockGetPkgReleases
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
      });
    mockHash.mockResolvedValue(null);

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

    expect(mockHash.mock.calls).toBeArrayOfSize(2);
    expect(mockHash.mock.calls).toMatchSnapshot();
  });

  it('return null if experimental flag is not set', async () => {
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
  });
});
