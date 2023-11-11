import { codeBlock } from 'common-tags';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { fs, mocked } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { getPkgReleases } from '../../../datasource';
import type { UpdateArtifactsConfig } from '../../types';
import { updateArtifacts } from '../index';
import { TerraformProviderHash } from './hash';

// auto-mock fs
jest.mock('../../../../util/fs');
jest.mock('./hash');
jest.mock('../../../datasource', () => mockDeep());

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const mockHash = mocked(TerraformProviderHash).createHashes;
const mockGetPkgReleases = getPkgReleases as jest.MockedFunction<
  typeof getPkgReleases
>;

describe('modules/manager/terraform/lockfile/index', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no .terraform.lock.hcl found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if .terraform.lock.hcl is empty', async () => {
    fs.readLocalFile.mockResolvedValueOnce('');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if .terraform.lock.hcl is invalid', async () => {
    fs.readLocalFile.mockResolvedValueOnce('empty');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('update single dependency with exact constraint and depType provider', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "aaa",
          "bbb",
          "ccc",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');
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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.36.0"
              constraints = "3.36.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);
    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/aws', '3.36.0'],
    ]);
  });

  it('update single dependency with exact constraint and and depType required_provider', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "aaa",
          "bbb",
          "ccc",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.36.0"
              constraints = "3.36.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/aws', '3.36.0'],
    ]);
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
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "a",
          "b",
          "c",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/azurerm" {
              version     = "2.56.0"
              constraints = "~> 2.50"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.example.com', 'hashicorp/azurerm', '2.56.0'],
    ]);
  });

  it('update single dependency with range constraint and major update', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "a",
          "b",
          "c",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/random" {
              version     = "3.1.0"
              constraints = "~> 3.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/random', '3.1.0'],
    ]);
  });

  it('update single dependency in subfolder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "a",
          "b",
          "c",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(
      'test/.terraform.lock.hcl',
    );

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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/random" {
              version     = "3.1.0"
              constraints = "~> 3.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: 'test/.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/random', '3.1.0'],
    ]);
  });

  it('update multiple dependencies which are not ordered', async () => {
    fs.readLocalFile.mockResolvedValue(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "~> 3.0"
        hashes = [
          "a",
          "b",
        ]
      }

      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.56.0"
        constraints = "~> 2.50"
        hashes = [
          "c",
          "d",
        ]
      }

      provider "registry.terraform.io/hashicorp/random" {
        version     = "3.1.0"
        constraints = "~> 3.0"
        hashes = [
          "e",
          "f",
        ]
      }

      provider "registry.terraform.io/telmate/proxmox" {
        version     = "2.7.0"
        constraints = "~> 2.7.0"
        hashes = [
          "g",
          "h",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(
      'test/.terraform.lock.hcl',
    );

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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.1.0"
              constraints = "~> 3.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.terraform.io/hashicorp/azurerm" {
              version     = "2.56.0"
              constraints = "~> 2.50"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.terraform.io/hashicorp/random" {
              version     = "3.1.0"
              constraints = "~> 3.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.terraform.io/telmate/proxmox" {
              version     = "2.7.0"
              constraints = "~> 2.7.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: 'test/.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/aws', '3.1.0'],
      ['https://registry.terraform.io', 'hashicorp/random', '3.1.0'],
      ['https://registry.terraform.io', 'hashicorp/azurerm', '2.56.0'],
      ['https://registry.terraform.io', 'telmate/proxmox', '2.7.0'],
    ]);
  });

  it('do full lock file maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "foo",
        ]
      }

      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }

      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "baz",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockGetPkgReleases
      .mockResolvedValueOnce({
        // aws
        releases: [
          { version: '2.30.0' },
          { version: '3.0.0' },
          { version: '3.36.0' },
        ],
      })
      .mockResolvedValueOnce({
        // azurerm
        releases: [
          { version: '2.50.0' },
          { version: '2.55.0' },
          { version: '2.56.0' },
        ],
      })
      .mockResolvedValueOnce({
        // random
        releases: [
          { version: '2.2.1' },
          { version: '2.2.2' },
          { version: '3.0.0' },
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

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.0.0"
              constraints = "3.0.0"
              hashes = [
                "foo",
              ]
            }

            provider "registry.terraform.io/hashicorp/azurerm" {
              version     = "2.56.0"
              constraints = "~> 2.50"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.terraform.io/hashicorp/random" {
              version     = "2.2.2"
              constraints = "~> 2.2"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.terraform.io', 'hashicorp/azurerm', '2.56.0'],
      ['https://registry.terraform.io', 'hashicorp/random', '2.2.2'],
    ]);
  });

  it('do full lock file maintenance with lockfile in subfolder', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "foo",
        ]
      }

      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }

      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "baz",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(
      'subfolder/.terraform.lock.hcl',
    );

    mockGetPkgReleases
      .mockResolvedValueOnce({
        // aws
        releases: [
          { version: '2.30.0' },
          { version: '3.0.0' },
          { version: '3.36.0' },
        ],
      })
      .mockResolvedValueOnce({
        // azurerm
        releases: [
          { version: '2.50.0' },
          { version: '2.55.0' },
          { version: '2.56.0' },
        ],
      })
      .mockResolvedValueOnce(
        // random
        null,
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
    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.0.0"
              constraints = "3.0.0"
              hashes = [
                "foo",
              ]
            }

            provider "registry.terraform.io/hashicorp/azurerm" {
              version     = "2.56.0"
              constraints = "~> 2.50"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.terraform.io/hashicorp/random" {
              version     = "2.2.1"
              constraints = "~> 2.2"
              hashes = [
                "baz",
              ]
            }
          `,
          path: 'subfolder/.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toMatchInlineSnapshot(
      [['https://registry.terraform.io', 'hashicorp/azurerm', '2.56.0']],
      `
      [
        [
          "https://registry.terraform.io",
          "hashicorp/azurerm",
          "2.56.0",
        ],
      ]
    `,
    );
  });

  it('do full lock file maintenance without necessary changes', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "foo",
        ]
      }

      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }

      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "baz",
        ]
      }
    `);

    mockGetPkgReleases
      .mockResolvedValueOnce({
        // aws
        releases: [{ version: '2.30.0' }, { version: '3.0.0' }],
      })
      .mockResolvedValueOnce({
        // azurerm
        releases: [{ version: '2.50.0' }],
      })
      .mockResolvedValueOnce({
        // random
        releases: [{ version: '2.2.1' }],
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

    expect(mockHash.mock.calls).toBeEmptyArray();
  });

  it('return null if hashing fails', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "foo",
        ]
      }

      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }

      provider "registry.terraform.io/hashicorp/random" {
        version     = "2.2.1"
        constraints = "~> 2.2"
        hashes = [
          "baz",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockGetPkgReleases
      .mockResolvedValueOnce({
        // aws
        releases: [
          { version: '2.30.0' },
          { version: '3.0.0' },
          { version: '3.36.0' },
        ],
      })
      .mockResolvedValueOnce({
        // azurerm
        releases: [
          { version: '2.50.0' },
          { version: '2.55.0' },
          { version: '2.56.0' },
        ],
      })
      .mockResolvedValueOnce({
        // random
        releases: [
          { version: '2.2.1' },
          { version: '2.2.2' },
          { version: '3.0.0' },
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

    expect(mockHash.mock.calls).toMatchInlineSnapshot(
      [
        ['https://registry.terraform.io', 'hashicorp/azurerm', '2.56.0'],
        ['https://registry.terraform.io', 'hashicorp/random', '2.2.2'],
      ],
      `
      [
        [
          "https://registry.terraform.io",
          "hashicorp/azurerm",
          "2.56.0",
        ],
        [
          "https://registry.terraform.io",
          "hashicorp/random",
          "2.2.2",
        ],
      ]
    `,
    );
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

  it('preserves constraints when current value and new value are same', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "~> 3.0.0"
        hashes = [
          "aaa",
          "bbb",
          "ccc",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'aws',
          depType: 'provider',
          packageName: 'hashicorp/aws',
          registryUrls: ['https://registry.example.com'],
          newVersion: '3.36.1',
          currentValue: '~> 3.36',
          newValue: '~> 3.36',
        },
      ],
      newPackageFileContent: '',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.36.1"
              constraints = "~> 3.0.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.example.com', 'hashicorp/aws', '3.36.1'],
    ]);
  });

  it('replaces current value to new version within a constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "~> 3.0.0"
        hashes = [
          "aaa",
          "bbb",
          "ccc",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'aws',
          depType: 'provider',
          packageName: 'hashicorp/aws',
          registryUrls: ['https://registry.example.com'],
          newVersion: '3.37.0',
          currentValue: '~> 3.0.0',
          newValue: '~> 3.37.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.37.0"
              constraints = "~> 3.37.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.example.com', 'hashicorp/aws', '3.37.0'],
    ]);
  });

  it('replaces current version to new version within a constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "~> 3.0.0"
        hashes = [
          "aaa",
          "bbb",
          "ccc",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: 'main.tf',
      updatedDeps: [
        {
          depName: 'aws',
          depType: 'provider',
          packageName: 'hashicorp/aws',
          registryUrls: ['https://registry.example.com'],
          newVersion: '3.37.0',
          currentVersion: '3.0.0',
        },
      ],
      newPackageFileContent: '',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/aws" {
              version     = "3.37.0"
              constraints = "~> 3.37.0"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }
          `,
          path: '.terraform.lock.hcl',
          type: 'addition',
        },
      },
    ]);

    expect(mockHash.mock.calls).toEqual([
      ['https://registry.example.com', 'hashicorp/aws', '3.37.0'],
    ]);
  });
});
