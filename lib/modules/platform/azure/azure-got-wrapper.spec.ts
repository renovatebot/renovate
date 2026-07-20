import { buildTestJwt } from '~test/jwt-util.ts';
import type * as _hostRules from '../../../util/host-rules.ts';

describe('modules/platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('./azure-got-wrapper.ts');
  let hostRules: typeof _hostRules;

  beforeEach(async () => {
    // reset module
    vi.resetModules();
    hostRules = await vi.importActual('../../../util/host-rules.ts');
    azure = await vi.importActual('./azure-got-wrapper.ts');
  });

  describe('gitApi', () => {
    it('should throw an error if no config found', () => {
      expect(azure.gitApi).toThrow('No config found for azure');
      expect(azure.coreApi).toThrow('No config found for azure');
      expect(azure.policyApi).toThrow('No config found for azure');
      expect(azure.workItemTrackingApi).toThrow('No config found for azure');
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
      const token = buildTestJwt(
        { typ: 'JWT', alg: 'RS256' },
        { aud: '499b84ac', sub: 'test', exp: 9999999999 },
        'fake-sig',
      );
      hostRules.add({
        hostType: 'azure',
        token,
        matchHost: 'https://dev.azure.com/renovate2',
      });
      azure.setEndpoint('https://dev.azure.com/renovate2');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      expect(res).toMatchObject({
        serverUrl: 'https://dev.azure.com/renovate2',
        authHandler: {
          token,
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

    it('should use BearerCredentialHandler for JWT tokens', () => {
      const jwt = buildTestJwt(
        { typ: 'JWT', alg: 'RS256' },
        { aud: '499b84ac', sub: 'test', exp: 9999999999 },
        'fake-sig',
      );
      hostRules.add({
        hostType: 'azure',
        token: jwt,
        matchHost: 'https://dev.azure.com/renovate4',
      });
      azure.setEndpoint('https://dev.azure.com/renovate4');

      const res = azure.azureObj();

      expect(res.authHandler).toHaveProperty('token', jwt);
      expect(res.authHandler.constructor.name).toBe('BearerCredentialHandler');
    });

    it('should use PersonalAccessTokenHandler for PAT tokens', () => {
      const pat = 'a'.repeat(52);
      hostRules.add({
        hostType: 'azure',
        token: pat,
        matchHost: 'https://dev.azure.com/renovate5',
      });
      azure.setEndpoint('https://dev.azure.com/renovate5');

      const res = azure.azureObj();

      expect(res.authHandler).toHaveProperty('token', pat);
      expect(res.authHandler.constructor.name).toBe(
        'PersonalAccessTokenCredentialHandler',
      );
    });

    it('should use PersonalAccessTokenHandler for short opaque tokens', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'shorttoken',
        matchHost: 'https://dev.azure.com/renovate6',
      });
      azure.setEndpoint('https://dev.azure.com/renovate6');

      const res = azure.azureObj();

      expect(res.authHandler).toHaveProperty('token', 'shorttoken');
      expect(res.authHandler.constructor.name).toBe(
        'PersonalAccessTokenCredentialHandler',
      );
    });
  });
});
