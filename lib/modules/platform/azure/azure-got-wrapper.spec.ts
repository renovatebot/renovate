import type { WebApi } from 'azure-devops-node-api';
import type { MockedObject } from 'vitest';
import { buildTestJwt } from '~test/jwt-util.ts';
import type { logger as _logger } from '../../../logger/index.ts';
import type * as _hostRules from '../../../util/host-rules.ts';

describe('modules/platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('./azure-got-wrapper.ts');
  let hostRules: typeof _hostRules;
  let logger: MockedObject<typeof _logger>;

  beforeEach(async () => {
    // reset module
    vi.resetModules();
    hostRules = await vi.importActual('../../../util/host-rules.ts');
    azure = await vi.importActual('./azure-got-wrapper.ts');
    logger = (
      await vi.importMock<typeof import('../../../logger/index.ts')>(
        '../../../logger/index.ts',
      )
    ).logger;
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

  describe('getAuthenticationContext', () => {
    it('uses the most specific matching host rule', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'platform-token',
        matchHost: 'dev.azure.com',
      });
      hostRules.add({
        hostType: 'azure',
        token: 'endpoint-token',
        matchHost: 'https://dev.azure.com/renovate9',
      });
      azure.setEndpoint('https://dev.azure.com/renovate9');

      const context = azure.getAuthenticationContext();
      const client = azure.azureObj(context.credentials);

      expect(context.credentials).toMatchObject({ token: 'endpoint-token' });
      expect(client.authHandler).toHaveProperty('token', 'endpoint-token');
    });

    it('changes the key when effective credentials change', () => {
      hostRules.add({
        hostType: 'azure',
        token: 'first-token',
        matchHost: 'https://dev.azure.com/renovate10',
      });
      azure.setEndpoint('https://dev.azure.com/renovate10');
      const first = azure.getAuthenticationContext();
      hostRules.add({
        hostType: 'azure',
        token: 'second-token',
        matchHost: 'https://dev.azure.com/renovate10',
      });

      const second = azure.getAuthenticationContext();

      expect(second.credentials).toMatchObject({ token: 'second-token' });
      expect(second.key).not.toBe(first.key);
    });
  });

  describe('isHosted', () => {
    let sdk: typeof import('azure-devops-node-api');

    beforeEach(async () => {
      sdk = await vi.importActual('azure-devops-node-api');
      hostRules.add({
        hostType: 'azure',
        token: '123test',
        matchHost: 'https://dev.azure.com/renovate7',
      });
      azure.setEndpoint('https://dev.azure.com/renovate7');
    });

    it('returns true when deployment type is Hosted', async () => {
      // DeploymentFlags.Hosted === 1
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({
        deploymentType: 1,
      });

      expect(await azure.isHosted()).toBe(true);
    });

    it('returns false when deployment type is OnPremises', async () => {
      // DeploymentFlags.OnPremises === 2
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({
        deploymentType: 2,
      });

      expect(await azure.isHosted()).toBe(false);
    });

    it('returns false when connectionData cannot be read', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockRejectedValue(
        new Error('boom'),
      );

      expect(await azure.isHosted()).toBe(false);
    });
  });

  describe('getAuthenticatedUserId', () => {
    let sdk: typeof import('azure-devops-node-api');

    beforeEach(async () => {
      sdk = await vi.importActual('azure-devops-node-api');
      azure.setEndpoint('https://dev.azure.com/renovate8');
    });

    it('returns the authenticated user ID using PAT credentials', async () => {
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ authenticatedUser: { id: 'user-id' } });

      expect(await azure.getAuthenticatedUserId({ token: '123test' })).toBe(
        'user-id',
      );
      const context = connect.mock.contexts[0] as WebApi;
      expect(context.authHandler.constructor.name).toBe(
        'PersonalAccessTokenCredentialHandler',
      );
    });

    it('returns the authenticated user ID using JWT credentials', async () => {
      const token = buildTestJwt(
        { typ: 'JWT', alg: 'RS256' },
        { aud: '499b84ac', sub: 'test', exp: 9999999999 },
        'fake-sig',
      );
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ authenticatedUser: { id: 'user-id' } });

      expect(await azure.getAuthenticatedUserId({ token })).toBe('user-id');
      const context = connect.mock.contexts[0] as WebApi;
      expect(context.authHandler.constructor.name).toBe(
        'BearerCredentialHandler',
      );
    });

    it('returns the authenticated user ID using username and password', async () => {
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ authenticatedUser: { id: 'user-id' } });

      expect(
        await azure.getAuthenticatedUserId({
          username: 'user',
          password: 'pass',
        }),
      ).toBe('user-id');
      const context = connect.mock.contexts[0] as WebApi;
      expect(context.authHandler).toMatchObject({
        username: 'user',
        password: 'pass',
      });
    });

    it('returns undefined when the authenticated user ID is unavailable', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({});

      expect(
        await azure.getAuthenticatedUserId({ token: '123test' }),
      ).toBeUndefined();
    });

    it('returns undefined when connection data cannot be read', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockRejectedValue(
        new Error('boom'),
      );

      expect(
        await azure.getAuthenticatedUserId({ token: '123test' }),
      ).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        { err: new Error('boom') },
        'Azure: could not determine authenticated user ID',
      );
    });
  });
});
