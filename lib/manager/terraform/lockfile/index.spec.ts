import { join } from 'upath';
import { fs, getName, loadFixture, mocked } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import { getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import * as hash from './hash';
import { updateArtifacts } from './index';

// auto-mock fs
jest.mock('../../../util/fs');
jest.mock('./hash');
jest.mock('../../../datasource');

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};

const validLockfile = loadFixture('validLockfile.hcl');

const mockHash = mocked(hash).createHashes;
const mockGetPkgReleases = getPkgReleases as jest.MockedFunction<
  typeof getPkgReleases
>;

describe(getName(), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    setAdminConfig(adminConfig);
  });

  afterEach(() => {
    delete process.env.RENOVATE_X_TERRAFORM_LOCK_FILE;
  });

  it('returns null if no .terraform.lock.hcl found', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

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
    fs.readLocalFile.mockResolvedValueOnce('empty' as any);

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('update single dependency with exact constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'minor',
      newVersion: '3.36.0',
      newValue: '3.36.0',
      ...config,
    };

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [{ depName: 'hashicorp/aws', lookupName: 'hashicorp/aws' }],
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

  it('update single dependency with range constraint and minor update from private registry', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'minor',
      newVersion: '2.56.0',
      newValue: '~> 2.50',
      ...config,
    };

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'azurerm',
          lookupName: 'azurerm',
          registryUrls: ['https://registry.example.com'],
        },
      ],
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
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const localConfig: UpdateArtifactsConfig = {
      updateType: 'major',
      newVersion: '3.1.0',
      newValue: '~> 3.0',
      ...config,
    };

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [{ depName: 'random', lookupName: 'hashicorp/random' }],
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
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

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

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

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

  it('do full lock file maintenance without necessary changes', async () => {
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

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
    fs.readLocalFile.mockResolvedValueOnce(validLockfile as any);

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

    process.env.RENOVATE_X_TERRAFORM_LOCK_FILE = 'test';

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
