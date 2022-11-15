import type * as _hostRules from '../../../util/host-rules';

describe('modules/platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('./azure-got-wrapper');
  let hostRules: typeof _hostRules;

  beforeEach(() => {
    // reset module
    jest.resetModules();
    hostRules = require('../../../util/host-rules');
    azure = require('./azure-got-wrapper');
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
  });
});
