import type { WebApi } from 'azure-devops-node-api';
import type { ClientApiBase } from 'azure-devops-node-api/ClientApiBases.js';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi.js';
import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import type { DeploymentFlags } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi.js';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { buildTestJwt } from '~test/jwt-util.ts';
import { logger, partial } from '~test/util.ts';
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

      await expect(azure.isHosted()).resolves.toBe(true);
    });

    it('returns true when deployment type is the serialized enum name', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({
        deploymentType: 'hosted' as unknown as DeploymentFlags,
      });

      await expect(azure.isHosted()).resolves.toBe(true);
    });

    it('returns false when deployment type is OnPremises', async () => {
      // DeploymentFlags.OnPremises === 2
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({
        deploymentType: 2,
      });

      await expect(azure.isHosted()).resolves.toBe(false);
    });

    it('returns false when deployment type is the on-premises enum name', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({
        deploymentType: 'onPremises' as unknown as DeploymentFlags,
      });

      await expect(azure.isHosted()).resolves.toBe(false);
    });

    it('returns false when connectionData cannot be read', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockRejectedValue(
        new Error('boom'),
      );

      await expect(azure.isHosted()).resolves.toBe(false);
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

      await expect(
        azure.getAuthenticatedUserId({ token: '123test' }),
      ).resolves.toBe('user-id');
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

      await expect(azure.getAuthenticatedUserId({ token })).resolves.toBe(
        'user-id',
      );
      const context = connect.mock.contexts[0] as WebApi;
      expect(context.authHandler.constructor.name).toBe(
        'BearerCredentialHandler',
      );
    });

    it('returns the authenticated user ID using username and password', async () => {
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ authenticatedUser: { id: 'user-id' } });

      await expect(
        azure.getAuthenticatedUserId({
          username: 'user',
          password: 'pass',
        }),
      ).resolves.toBe('user-id');
      const context = connect.mock.contexts[0] as WebApi;
      expect(context.authHandler).toMatchObject({
        username: 'user',
        password: 'pass',
      });
    });

    it('returns undefined when the authenticated user ID is unavailable', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockResolvedValue({});

      await expect(
        azure.getAuthenticatedUserId({ token: '123test' }),
      ).resolves.toBeUndefined();
    });

    it('returns undefined when connection data cannot be read', async () => {
      vi.spyOn(sdk.WebApi.prototype, 'connect').mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        azure.getAuthenticatedUserId({ token: '123test' }),
      ).resolves.toBeUndefined();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { err: new Error('boom') },
        'Azure: could not determine authenticated user ID',
      );
    });
  });

  describe('keep-alive', () => {
    const endpoint = 'https://dev.azure.com/renovate9';
    let sdk: typeof import('azure-devops-node-api');

    function addRule(token: string, keepAlive?: boolean): void {
      hostRules.add({
        hostType: 'azure',
        token,
        matchHost: endpoint,
        keepAlive,
      });
    }

    function createApi(): ClientApiBase {
      return partial<ClientApiBase>({
        http: partial<ClientApiBase['http']>({ dispose: vi.fn() }),
        rest: partial<ClientApiBase['rest']>({
          client: partial<ClientApiBase['rest']['client']>({
            dispose: vi.fn(),
          }),
        }),
      });
    }

    function spyGitApi() {
      return vi
        .spyOn(sdk.WebApi.prototype, 'getGitApi')
        .mockImplementation(() =>
          Promise.resolve(partial<IGitApi>(createApi())),
        );
    }

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      sdk = await vi.importActual('azure-devops-node-api');
      azure.setEndpoint(endpoint);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates new clients per call without keep-alive', async () => {
      addRule('123test');
      const getGitApi = spyGitApi();

      const webApi = azure.azureObj();
      const otherWebApi = azure.azureObj();
      const api = await azure.gitApi();
      const otherApi = await azure.gitApi();

      expect(webApi.options).toEqual({
        allowRetries: true,
        maxRetries: 2,
        ignoreSslError: false,
      });
      expect(otherWebApi).not.toBe(webApi);
      expect(otherApi).not.toBe(api);
      expect(getGitApi).toHaveBeenCalledTimes(2);
    });

    it('enables keep-alive with bounded sockets', () => {
      addRule('123test', true);

      const webApi = azure.azureObj();

      expect(webApi.options).toEqual({
        allowRetries: true,
        maxRetries: 2,
        keepAlive: true,
        maxSockets: 16,
        ignoreSslError: false,
      });
    });

    it('reuses the WebApi and the API clients', async () => {
      addRule('123test', true);
      const getGitApi = spyGitApi();
      const getCoreApi = vi
        .spyOn(sdk.WebApi.prototype, 'getCoreApi')
        .mockImplementation(() =>
          Promise.resolve(partial<ICoreApi>(createApi())),
        );
      const getPolicyApi = vi
        .spyOn(sdk.WebApi.prototype, 'getPolicyApi')
        .mockImplementation(() =>
          Promise.resolve(partial<IPolicyApi>(createApi())),
        );
      const getWorkItemTrackingApi = vi
        .spyOn(sdk.WebApi.prototype, 'getWorkItemTrackingApi')
        .mockImplementation(() =>
          Promise.resolve(partial<IWorkItemTrackingApi>(createApi())),
        );

      const webApi = azure.azureObj();

      expect(azure.azureObj()).toBe(webApi);
      await expect(azure.gitApi()).resolves.toBe(await azure.gitApi());
      await expect(azure.coreApi()).resolves.toBe(await azure.coreApi());
      await expect(azure.policyApi()).resolves.toBe(await azure.policyApi());
      await expect(azure.workItemTrackingApi()).resolves.toBe(
        await azure.workItemTrackingApi(),
      );
      expect(getGitApi).toHaveBeenCalledOnce();
      expect(getCoreApi).toHaveBeenCalledOnce();
      expect(getPolicyApi).toHaveBeenCalledOnce();
      expect(getWorkItemTrackingApi).toHaveBeenCalledOnce();
      expect(getGitApi.mock.contexts[0]).toBe(webApi);
    });

    it('reuses the WebApi for isHosted', async () => {
      addRule('123test', true);
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ deploymentType: 1 });
      const webApi = azure.azureObj();

      await expect(azure.isHosted()).resolves.toBe(true);

      expect(connect.mock.contexts[0]).toBe(webApi);
    });

    it('creates new clients when the credentials change', async () => {
      addRule('123test', true);
      spyGitApi();
      const webApi = azure.azureObj();
      const api = await azure.gitApi();
      hostRules.clear();
      addRule('456test', true);

      const otherWebApi = azure.azureObj();
      const otherApi = await azure.gitApi();

      expect(otherWebApi).not.toBe(webApi);
      expect(otherWebApi.authHandler).toHaveProperty('token', '456test');
      expect(otherApi).not.toBe(api);
    });

    it('creates new clients per call for explicit credentials', async () => {
      addRule('123test', true);
      const getGitApi = spyGitApi();
      const connect = vi
        .spyOn(sdk.WebApi.prototype, 'connect')
        .mockResolvedValue({ authenticatedUser: { id: 'user-id' } });
      const credentials = { token: '123test', keepAlive: true };

      await azure.gitApi(credentials);
      await azure.gitApi(credentials);
      await azure.getAuthenticatedUserId(credentials);
      await azure.getAuthenticatedUserId(credentials);

      const webApi = azure.azureObj();
      expect(getGitApi.mock.contexts[0]).not.toBe(getGitApi.mock.contexts[1]);
      expect(getGitApi.mock.contexts).not.toContain(webApi);
      expect(connect.mock.contexts[0]).not.toBe(connect.mock.contexts[1]);
      expect(connect.mock.contexts).not.toContain(webApi);
      expect(azure.azureObj(credentials)).not.toBe(webApi);
    });

    it('clears the clients in setEndpoint', async () => {
      addRule('123test', true);
      spyGitApi();
      const webApi = azure.azureObj();
      const api = await azure.gitApi();

      azure.setEndpoint(endpoint);

      expect(azure.azureObj()).not.toBe(webApi);
      await expect(azure.gitApi()).resolves.not.toBe(api);
    });

    it('shares the in-flight promise of concurrent calls', async () => {
      addRule('123test', true);
      const getGitApi = spyGitApi();

      const first = azure.gitApi();
      const second = azure.gitApi();

      expect(second).toBe(first);
      await expect(second).resolves.toBe(await first);
      expect(getGitApi).toHaveBeenCalledOnce();
    });

    it('does not cache a rejected API client', async () => {
      addRule('123test', true);
      const getGitApi = spyGitApi().mockRejectedValueOnce(new Error('boom'));

      await expect(azure.gitApi()).rejects.toThrow('boom');
      const api = await azure.gitApi();

      await expect(azure.gitApi()).resolves.toBe(api);
      expect(getGitApi).toHaveBeenCalledTimes(2);
    });

    it('keeps the newer client when an old request rejects late', async () => {
      addRule('123test', true);
      const { promise, reject } = Promise.withResolvers<IGitApi>();
      const getGitApi = spyGitApi().mockReturnValueOnce(promise);
      const first = azure.gitApi();
      azure.setEndpoint(endpoint);
      const api = await azure.gitApi();

      reject(new Error('boom'));
      const result = await Promise.allSettled([first, azure.gitApi()]);

      expect(result).toEqual([
        { status: 'rejected', reason: new Error('boom') },
        { status: 'fulfilled', value: api },
      ]);
      expect(getGitApi).toHaveBeenCalledTimes(2);
    });

    it('rebuilds the clients after being idle', async () => {
      addRule('123test', true);
      spyGitApi();
      const webApi = azure.azureObj();
      const api = await azure.gitApi();

      vi.setSystemTime(1_030_000);
      const withinIdle = azure.azureObj();
      vi.setSystemTime(1_060_000);
      const refreshed = await azure.gitApi();
      vi.setSystemTime(1_090_001);
      const afterIdle = azure.azureObj();

      expect(withinIdle).toBe(webApi);
      expect(refreshed).toBe(api);
      expect(afterIdle).not.toBe(webApi);
      await expect(azure.gitApi()).resolves.not.toBe(api);
    });

    it.each`
      reason                 | retire
      ${'idle rebuild'}      | ${() => vi.setSystemTime(1_030_001)}
      ${'credential change'} | ${() => addRule('456test', true)}
      ${'endpoint reset'}    | ${() => azure.setEndpoint(endpoint)}
    `(
      'disposes retired clients after the grace period ($reason)',
      async ({ retire }: { retire: () => void }) => {
        addRule('123test', true);
        spyGitApi();
        const webApi = azure.azureObj();
        const dispose = vi.spyOn(webApi.rest.client, 'dispose');
        const apiPromise = azure.gitApi();
        const api = await apiPromise;
        retire();
        azure.azureObj();
        const retiredAt = Date.now();

        vi.setSystemTime(retiredAt + 299_999);
        azure.azureObj();
        await apiPromise;

        expect(dispose).not.toHaveBeenCalled();
        expect(api.http.dispose).not.toHaveBeenCalled();
        expect(api.rest.client.dispose).not.toHaveBeenCalled();

        vi.setSystemTime(retiredAt + 300_000);
        azure.azureObj();
        await apiPromise;

        expect(dispose).toHaveBeenCalledOnce();
        expect(api.http.dispose).toHaveBeenCalledOnce();
        expect(api.rest.client.dispose).toHaveBeenCalledOnce();
      },
    );

    it('skips rejected API clients when disposing', async () => {
      addRule('123test', true);
      const { promise, reject } = Promise.withResolvers<IGitApi>();
      spyGitApi().mockReturnValueOnce(promise);
      const webApi = azure.azureObj();
      const dispose = vi.spyOn(webApi.rest.client, 'dispose');
      const first = azure.gitApi();
      azure.setEndpoint(endpoint);
      vi.setSystemTime(1_300_000);

      azure.azureObj();
      reject(new Error('boom'));
      const result = await Promise.allSettled([first]);

      expect(result).toEqual([
        { status: 'rejected', reason: new Error('boom') },
      ]);
      expect(dispose).toHaveBeenCalledOnce();
    });
  });
});
