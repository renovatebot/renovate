import { logger, partial } from '~test/util.ts';
import type { ProviderLock } from '../../lockfile/types.ts';
import { RequiredProviderExtractor } from './required-provider.ts';

describe('modules/manager/terraform/extractors/terraform-block/required-provider', () => {
  const extractor = new RequiredProviderExtractor();

  it('return empty array if no terraform block is found', () => {
    const res = extractor.extract({}, []);
    expect(res).toBeArrayOfSize(0);
  });

  it('return empty array if no required_providers block is found', () => {
    const res = extractor.extract({ terraform: [{}] }, []);
    expect(res).toBeArrayOfSize(0);
  });

  it('extract provider with version and registry url', () => {
    const res = extractor.extract(
      {
        terraform: [
          {
            required_providers: [
              {
                kubernetes: {
                  source: 'hashicorp/kubernetes',
                  version: '3.0.1',
                },
                sops: {
                  source: 'registry.terraform.io/carlpett/sops',
                  version: '1.3.0',
                },
              },
              {
                sops: {
                  source: 'carlpett/sops',
                  version: '1.3.0',
                },
              },
            ],
          },
        ],
      },
      partial<ProviderLock>([
        {
          packageName: 'hashicorp/kubernetes',
          registryUrl: 'https://registry.opentofu.org',
          version: '3.0.1',
          constraints: '3.0.1',
        },
        {
          packageName: 'carlpett/sops',
          registryUrl: 'https://registry.terraform.io',
          version: '1.3.0',
          constraints: '1.3.0',
        },
        {
          packageName: 'carlpett/sops',
          registryUrl: 'https://registry.opentofu.org',
          version: '1.3.0',
          constraints: '1.3.0',
        },
      ]),
    );
    expect(res).toEqual([
      {
        currentValue: '3.0.1',
        datasource: 'terraform-provider',
        depName: 'kubernetes',
        packageName: 'hashicorp/kubernetes',
        depType: 'required_provider',
        lockedVersion: '3.0.1',
        managerData: {
          moduleName: 'kubernetes',
          source: 'hashicorp/kubernetes',
        },
        registryUrls: ['https://registry.opentofu.org'],
      },
      {
        currentValue: '1.3.0',
        datasource: 'terraform-provider',
        depName: 'sops',
        packageName: 'carlpett/sops',
        depType: 'required_provider',
        lockedVersion: '1.3.0',
        managerData: {
          moduleName: 'sops',
          source: 'registry.terraform.io/carlpett/sops',
        },
        registryUrls: ['https://registry.terraform.io'],
      },
      {
        currentValue: '1.3.0',
        datasource: 'terraform-provider',
        depName: 'sops',
        packageName: 'carlpett/sops',
        depType: 'required_provider',
        lockedVersion: '1.3.0',
        managerData: {
          moduleName: 'sops',
          source: 'carlpett/sops',
        },
      },
    ]);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        dep: {
          currentValue: '3.0.1',
          lockedVersion: '3.0.1',
          datasource: 'terraform-provider',
          depName: 'kubernetes',
          packageName: 'hashicorp/kubernetes',
          depType: 'required_provider',
          managerData: {
            moduleName: 'kubernetes',
            source: 'hashicorp/kubernetes',
          },
          registryUrls: ['https://registry.opentofu.org'],
        },
        foundLocks: [
          {
            packageName: 'hashicorp/kubernetes',
            registryUrl: 'https://registry.opentofu.org',
            version: '3.0.1',
            constraints: '3.0.1',
          },
        ],
      },
      'Terraform: Single lock found for provider with non-default registry URL',
    );
    expect(logger.logger.debug).toHaveBeenCalledWith(
      {
        dep: {
          currentValue: '1.3.0',
          lockedVersion: '1.3.0',
          datasource: 'terraform-provider',
          depName: 'sops',
          packageName: 'carlpett/sops',
          depType: 'required_provider',
          managerData: {
            moduleName: 'sops',
            source: 'carlpett/sops',
          },
        },
        foundLocks: [
          {
            packageName: 'carlpett/sops',
            registryUrl: 'https://registry.terraform.io',
            version: '1.3.0',
            constraints: '1.3.0',
          },
          {
            packageName: 'carlpett/sops',
            registryUrl: 'https://registry.opentofu.org',
            version: '1.3.0',
            constraints: '1.3.0',
          },
        ],
      },
      'Terraform: Multiple locks found for provider unable to determine registry URL',
    );
  });
});
