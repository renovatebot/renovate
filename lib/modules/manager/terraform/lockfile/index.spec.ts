import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import * as _dateUtil from '../../../../util/date.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import { asTimestamp } from '../../../../util/timestamp.ts';
import { getPkgReleases } from '../../../datasource/index.ts';
import * as versioningApi from '../../../versioning/index.ts';
import type { UpdateArtifactsConfig } from '../../types.ts';
import { updateArtifacts } from '../index.ts';
import { TerraformProviderHash } from './hash.ts';
import { getNewConstraint } from './index.ts';

// auto-mock fs
vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../../util/date.ts');
vi.mock('./hash.ts');
vi.mock('../../../datasource/index.ts', () => mockDeep());

const config = {
  constraints: {},
};

const adminConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};

const mockHash = vi.mocked(TerraformProviderHash.createHashes);
const mockGetPkgReleases = vi.mocked(getPkgReleases);
const dateUtil = vi.mocked(_dateUtil);

describe('modules/manager/terraform/lockfile/index', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    dateUtil.getElapsedMs.mockReset();
  });

  it('returns artifact error', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');
    fs.readLocalFile.mockRejectedValueOnce(new Error('File not found'));
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: [{ depName: 'aws' }],
        newPackageFileContent: '',
        config,
      }),
    ).toEqual([
      {
        artifactError: {
          fileName: '.terraform.lock.hcl',
          stderr: 'File not found',
        },
      },
    ]);
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

  it.each`
    depType                | registryHost               | registryUrl
    ${'provider'}          | ${'registry.opentofu.org'} | ${'https://registry.opentofu.org'}
    ${'required_provider'} | ${'registry.terraform.io'} | ${'https://registry.terraform.io'}
  `(
    'updates a single exact-constraint dependency for depType=$depType',
    async ({ depType, registryHost, registryUrl }) => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        provider "${registryHost}/hashicorp/aws" {
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
            depType,
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
              provider "${registryHost}/hashicorp/aws" {
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
        [registryUrl, 'hashicorp/aws', '3.36.0'],
      ]);
    },
  );

  it.each(['3.0.0', '~> 3.0, 3.0.0'])(
    'does not update dependency with exact constraint during lockfile update: %s',
    async (constraints) => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        provider "registry.terraform.io/hashicorp/aws" {
          version     = "3.0.0"
          constraints = "${constraints}"
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
            currentVersion: '3.0.0',
            currentValue: '3.0.0',
            newVersion: '3.36.0',
            newValue: '3.36.0',
            isLockfileUpdate: true,
          },
        ],
        newPackageFileContent: '',
        config,
      });

      expect(result).toBeNull();
    },
  );

  it('updates dependency when lockfile update version satisfies constraints', async () => {
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
          depName: 'hashicorp/aws',
          packageName: 'hashicorp/aws',
          depType: 'required_provider',
          versioning: 'hashicorp',
          currentVersion: '3.0.0',
          currentValue: '~> 3.0.0',
          newVersion: '3.0.1',
          newValue: '~> 3.0.1',
          isLockfileUpdate: true,
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
              version     = "3.0.1"
              constraints = "~> 3.0.1"
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
  });

  it('does not update dependencies with depType=module', async () => {
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

  it('updates a single dependency with a range constraint from a private registry', async () => {
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

  it('updates a single dependency with a range constraint across a major version', async () => {
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

  it('updates a single dependency in a subfolder lockfile', async () => {
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

  it('updates multiple dependencies regardless of updatedDeps order', async () => {
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

  it('updates all lockfile entries during lock file maintenance', async () => {
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

      provider "registry.opentofu.org/hashicorp/random" {
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
      isLockFileMaintenance: true,
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

            provider "registry.opentofu.org/hashicorp/random" {
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
      ['https://registry.opentofu.org', 'hashicorp/random', '2.2.2'],
    ]);

    expect(mockGetPkgReleases.mock.calls).toEqual([
      [
        {
          datasource: 'terraform-provider',
          packageName: 'hashicorp/aws',
          registryUrls: ['https://registry.terraform.io'],
        },
      ],
      [
        {
          datasource: 'terraform-provider',
          packageName: 'hashicorp/azurerm',
          registryUrls: ['https://registry.terraform.io'],
        },
      ],
      [
        {
          datasource: 'terraform-provider',
          packageName: 'hashicorp/random',
          registryUrls: ['https://registry.opentofu.org'],
        },
      ],
    ]);
  });

  it('updates all lockfile entries during lock file maintenance in a subfolder', async () => {
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
      isLockFileMaintenance: true,
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

  it('filters lock file maintenance releases using minimumReleaseAge', async () => {
    dateUtil.getElapsedMs
      .mockReturnValueOnce(toMs('12 hours') ?? 0)
      .mockReturnValueOnce(toMs('12 days') ?? 0)
      .mockReturnValueOnce(toMs('12 hours') ?? 0)
      .mockReturnValueOnce(toMs('4 days') ?? 0);

    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }

      provider "registry.opentofu.org/hashicorp/random" {
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
        releases: [
          {
            version: '2.50.0',
            releaseTimestamp: asTimestamp('2026-03-01T00:00:00.000Z'),
          },
          {
            version: '2.55.0',
            releaseTimestamp: asTimestamp('2026-03-20T00:00:00.000Z'),
          },
          {
            version: '2.56.0',
            releaseTimestamp: asTimestamp('2026-03-31T12:00:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        releases: [
          {
            version: '2.2.1',
            releaseTimestamp: asTimestamp('2026-03-01T00:00:00.000Z'),
          },
          {
            version: '2.2.2',
            releaseTimestamp: asTimestamp('2026-03-28T00:00:00.000Z'),
          },
          {
            version: '2.2.3',
            releaseTimestamp: asTimestamp('2026-03-31T12:00:00.000Z'),
          },
        ],
      });
    mockHash.mockResolvedValue([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {
        ...config,
        isLockFileMaintenance: true,
        minimumReleaseAge: '3 days',
      },
    });

    expect(result).toEqual([
      {
        file: {
          contents: codeBlock`
            provider "registry.terraform.io/hashicorp/azurerm" {
              version     = "2.55.0"
              constraints = "~> 2.50"
              hashes = [
                "h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=",
                "h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=",
              ]
            }

            provider "registry.opentofu.org/hashicorp/random" {
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
      ['https://registry.terraform.io', 'hashicorp/azurerm', '2.55.0'],
      ['https://registry.opentofu.org', 'hashicorp/random', '2.2.2'],
    ]);
  });

  it('updates lock file maintenance when release timestamp is missing and minimumReleaseAgeBehaviour=timestamp-optional', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockGetPkgReleases.mockResolvedValueOnce({
      releases: [
        {
          version: '2.50.0',
          releaseTimestamp: asTimestamp('2026-03-01T00:00:00.000Z'),
        },
        {
          version: '2.56.0',
        },
      ],
    });
    mockHash.mockResolvedValue([
      'h1:lDsKRxDRXPEzA4AxkK4t+lJd3IQIP2UoaplJGjQSp2s=',
      'h1:6zB2hX7YIOW26OrKsLJn0uLMnjqbPNxcz9RhlWEuuSY=',
    ]);

    const result = await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {
        ...config,
        isLockFileMaintenance: true,
        minimumReleaseAge: '3 days',
        minimumReleaseAgeBehaviour: 'timestamp-optional',
      },
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
      ['https://registry.terraform.io', 'hashicorp/azurerm', '2.56.0'],
    ]);
  });

  it('does not update lock file maintenance when the latest satisfying release has no version and no minimumReleaseAge is set', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/azurerm" {
        version     = "2.50.0"
        constraints = "~> 2.50"
        hashes = [
          "bar",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    const getVersioningSpy = vi.spyOn(versioningApi, 'get').mockReturnValue({
      matches: () => true,
    } as never);

    mockGetPkgReleases.mockResolvedValueOnce({
      releases: [{} as never],
    });

    const result = await updateArtifacts({
      packageFileName: '',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {
        ...config,
        isLockFileMaintenance: true,
      },
    });

    expect(result).toBeNull();
    expect(mockHash).not.toHaveBeenCalled();

    getVersioningSpy.mockRestore();
  });

  it.each([
    {
      description: 'all satisfying releases are pending',
      elapsedMs: [toMs('12 hours') ?? 0, toMs('2 days') ?? 0],
      releases: [
        {
          version: '2.50.0',
          releaseTimestamp: asTimestamp('2026-03-30T00:00:00.000Z'),
        },
        {
          version: '2.55.0',
          releaseTimestamp: asTimestamp('2026-03-31T12:00:00.000Z'),
        },
      ],
      localConfig: {
        ...config,
        isLockFileMaintenance: true,
        minimumReleaseAge: '3 days',
      },
    },
    {
      description: 'no releases satisfy the constraints',
      elapsedMs: [],
      releases: [
        {
          version: '3.0.0',
          releaseTimestamp: asTimestamp('2026-03-01T00:00:00.000Z'),
        },
      ],
      localConfig: {
        ...config,
        isLockFileMaintenance: true,
        minimumReleaseAge: '3 days',
      },
    },
    {
      description:
        'release timestamp is missing and minimumReleaseAgeBehaviour=timestamp-required',
      elapsedMs: [],
      releases: [
        {
          version: '2.50.0',
          releaseTimestamp: asTimestamp('2026-03-01T00:00:00.000Z'),
        },
        {
          version: '2.56.0',
        },
      ],
      localConfig: {
        ...config,
        isLockFileMaintenance: true,
        minimumReleaseAge: '3 days',
        minimumReleaseAgeBehaviour: 'timestamp-required' as const,
      },
    },
  ])(
    'does not update lock file maintenance when $description',
    async ({ elapsedMs, releases, localConfig }) => {
      for (const elapsed of elapsedMs) {
        dateUtil.getElapsedMs.mockReturnValueOnce(elapsed);
      }

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        provider "registry.terraform.io/hashicorp/azurerm" {
          version     = "2.50.0"
          constraints = "~> 2.50"
          hashes = [
            "bar",
          ]
        }
      `);
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

      mockGetPkgReleases.mockResolvedValueOnce({ releases });

      const result = await updateArtifacts({
        packageFileName: '',
        updatedDeps: [],
        newPackageFileContent: '',
        config: localConfig,
      });

      expect(result).toBeNull();
      expect(mockHash).not.toHaveBeenCalled();
    },
  );

  it('does not rewrite the lockfile when maintenance finds no changes', async () => {
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
      isLockFileMaintenance: true,
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

  it('returns null if hashing fails during lock file maintenance', async () => {
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
      isLockFileMaintenance: true,
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

  it('returns null if hashing fails for a normal provider update', async () => {
    fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      provider "registry.terraform.io/hashicorp/aws" {
        version     = "3.0.0"
        constraints = "3.0.0"
        hashes = [
          "foo",
        ]
      }
    `);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.terraform.lock.hcl');

    mockHash.mockResolvedValueOnce(null);

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

  it('replaces the current value with the new version inside the constraint', async () => {
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

  it('replaces the current version with the new version inside the constraint', async () => {
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

  describe('getNewConstraint', () => {
    it.each([
      {
        description: 'correctly calculate new constraint on pinning',
        dep: {
          currentValue: '>= 4.3',
          newValue: '5.26.0',
          newVersion: '5.26.0',
        },
        oldConstraint: '>= 4.3.0',
        expected: '5.26.0',
      },
      {
        description: 'update constraint with multiple elements',
        dep: {
          currentValue: '2.41.0',
          newValue: '2.46.0',
          newVersion: '2.46.0',
        },
        oldConstraint: '>= 2.36.0, 2.41.0',
        expected: '>= 2.36.0, 2.46.0',
      },
      {
        description:
          'update constraint when current version is matched multiple times',
        dep: {
          currentValue: '2.41.0',
          newValue: '2.46.0',
          newVersion: '2.46.0',
        },
        oldConstraint: '>= 2.41.0, 2.41.0',
        expected: '>= 2.41.0, 2.46.0',
      },
      {
        description:
          'update constraint when current version is in a complicated constraint',
        dep: {
          currentValue: '<= 2.41.0',
          newValue: '<= 2.46.0',
          newVersion: '2.46.0',
        },
        oldConstraint: '>= 2.41.0, <= 2.41.0, >= 2.0.0',
        expected: '>= 2.41.0, <= 2.46.0, >= 2.0.0',
      },
      {
        description: 'create constraint with full version',
        dep: {
          currentValue: '>= 4.0, <4.12',
          newValue: '< 4.21',
          newVersion: '4.20.0',
        },
        oldConstraint: '>= 4.0.0, < 4.12.0',
        expected: '< 4.21.0',
      },
    ])('$description', ({ dep, oldConstraint, expected }) => {
      expect(getNewConstraint(dep, oldConstraint)).toBe(expected);
    });
  });
});
