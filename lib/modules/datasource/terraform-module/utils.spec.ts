import { createSDBackendURL, getRegistryRepository } from './utils.ts';

describe('modules/datasource/terraform-module/utils', () => {
  describe('createSDBackendURL', () => {
    const defaultRegistryURL = 'https://registry.example.com';

    it('returns URL with relative SD for modules', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'modules.v1',
        {
          'modules.v1': '/v1/modules/',
        },
        'hashicorp/consul/aws',
      );
      expect(result).toBe(
        'https://registry.example.com/v1/modules/hashicorp/consul/aws',
      );
    });

    it('returns URL with relative SD for providers', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'providers.v1',
        {
          'providers.v1': '/v1/providers/',
        },
        'hashicorp/azure',
      );
      expect(result).toBe(
        'https://registry.example.com/v1/providers/hashicorp/azure',
      );
    });

    it('returns URL with absolute SD  for modules', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'modules.v1',
        {
          'modules.v1': 'https://other.example.com/v1/modules/',
        },
        'hashicorp/consul/aws',
      );
      expect(result).toBe(
        'https://other.example.com/v1/modules/hashicorp/consul/aws',
      );
    });

    it('returns URL with absolute SD for providers and missing trailing slash', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'providers.v1',
        {
          'providers.v1': 'https://other.example.com/providers',
        },
        'hashicorp/azure',
      );
      expect(result).toBe(
        'https://other.example.com/providers/hashicorp/azure',
      );
    });

    it('returns URL with with empty SD', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'providers.v1',
        {
          'providers.v1': '',
        },
        'hashicorp/azure',
      );
      expect(result).toBe('https://registry.example.com/hashicorp/azure');
    });

    it('returns URL with with missing SD', () => {
      const result = createSDBackendURL(
        defaultRegistryURL,
        'providers.v1',
        {},
        'hashicorp/azure',
      );
      expect(result).toBe('https://registry.example.com/hashicorp/azure');
    });
  });

  describe('getRegistryRepository', () => {
    it('uses the configured registry URL for standard package names', () => {
      expect(
        getRegistryRepository(
          'hashicorp/consul/aws',
          'https://registry.terraform.io',
        ),
      ).toEqual({
        registry: 'https://registry.terraform.io',
        repository: 'hashicorp/consul/aws',
      });
    });

    it('extracts the registry from packageName when it is embedded', () => {
      expect(
        getRegistryRepository(
          'registry.terraform.io/hashicorp/consul/aws',
          undefined,
        ),
      ).toEqual({
        registry: 'https://registry.terraform.io',
        repository: 'hashicorp/consul/aws',
      });
    });

    it('normalizes an embedded registry without a scheme', () => {
      expect(
        getRegistryRepository('terraform.company.com/hashicorp/consul/aws', ''),
      ).toEqual({
        registry: 'https://terraform.company.com',
        repository: 'hashicorp/consul/aws',
      });
    });
  });
});
