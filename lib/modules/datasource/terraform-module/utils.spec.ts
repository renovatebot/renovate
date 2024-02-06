import { createSDBackendURL } from './utils';

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
});
