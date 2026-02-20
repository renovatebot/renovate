import type { GlobalConfig as _GlobalConfig } from '../../../config/global.ts';
import type * as _hostRules from '../../../util/host-rules.ts';

describe('modules/platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('./azure-got-wrapper.ts');
  let hostRules: typeof _hostRules;
  let GlobalConfig: typeof _GlobalConfig;

  beforeEach(async () => {
    // reset module
    vi.resetModules();
    const globalConfigModule = await vi.importActual<
      typeof import('../../../config/global.ts')
    >('../../../config/global.ts');
    GlobalConfig = globalConfigModule.GlobalConfig;
    GlobalConfig.reset();
    hostRules = await vi.importActual('../../../util/host-rules.ts');
    azure = await vi.importActual('./azure-got-wrapper.ts');
  });

  describe('gitApi', () => {
    it('should throw an error if no config found', () => {
      expect(azure.gitApi).toThrow('No config found for azure');
      expect(azure.coreApi).toThrow('No config found for azure');
      expect(azure.policyApi).toThrow('No config found for azure');
    });

    it('should set personal access token and endpoint', () => {
      hostRules.add({
        hostType: 'azure',
        token: '123test',
        matchHost: 'https://dev.azure.com/renovate1',
      });
      azure.setEndpoint('https://dev.azure.com/renovate1');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      expect(res).toMatchObject({
        serverUrl: 'https://dev.azure.com/renovate1',
        authHandler: {
          token: '123test',
        },
      });
    });

    it('should set bearer token and endpoint', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'testtoken',
        matchHost: 'https://dev.azure.com/renovate2',
      });
      azure.setEndpoint('https://dev.azure.com/renovate2');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      expect(res).toMatchObject({
        serverUrl: 'https://dev.azure.com/renovate2',
        authHandler: {
          token: 'testtoken',
        },
      });
    });

    it('should set password and endpoint', () => {
      hostRules.add({
        hostType: 'azure',
        username: 'user',
        password: 'pass',
        matchHost: 'https://dev.azure.com/renovate3',
      });
      azure.setEndpoint('https://dev.azure.com/renovate3');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      expect(res).toMatchObject({
        serverUrl: 'https://dev.azure.com/renovate3',
        authHandler: {
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should use BearerCredentialHandler when azureAuthType is bearer', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'a'.repeat(52),
        matchHost: 'https://dev.azure.com/renovate4',
      });
      GlobalConfig.set({ azureAuthType: 'bearer' });
      azure.setEndpoint('https://dev.azure.com/renovate4');

      const res = azure.azureObj();

      // With azureAuthType=bearer, even a 52-char token should produce a Bearer handler
      expect(res.authHandler).toHaveProperty('token', 'a'.repeat(52));
      expect(res.authHandler.constructor.name).toBe('BearerCredentialHandler');
    });

    it('should use PersonalAccessTokenHandler when azureAuthType is pat', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'short-jwt-like-token',
        matchHost: 'https://dev.azure.com/renovate5',
      });
      GlobalConfig.set({ azureAuthType: 'pat' });
      azure.setEndpoint('https://dev.azure.com/renovate5');

      const res = azure.azureObj();

      // With azureAuthType=pat, even a non-52-char token should produce a PAT handler
      expect(res.authHandler).toHaveProperty('token', 'short-jwt-like-token');
      expect(res.authHandler.constructor.name).toBe(
        'PersonalAccessTokenCredentialHandler',
      );
    });

    it('should fall back to library heuristic when azureAuthType is auto', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'shorttoken',
        matchHost: 'https://dev.azure.com/renovate6',
      });
      GlobalConfig.set({ azureAuthType: 'auto' });
      azure.setEndpoint('https://dev.azure.com/renovate6');

      const res = azure.azureObj();

      // Non-52-char token with auto → library heuristic → BearerCredentialHandler
      expect(res.authHandler).toHaveProperty('token', 'shorttoken');
      expect(res.authHandler.constructor.name).toBe('BearerCredentialHandler');
    });
  });
});
