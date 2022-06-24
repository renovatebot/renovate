import { PlatformId } from '../../../constants';
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
        hostType: PlatformId.Azure,
        token: '123test',
        matchHost: 'https://dev.azure.com/renovate1',
      });
      azure.setEndpoint('https://dev.azure.com/renovate1');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });

    it('should set bearer token and endpoint', () => {
      hostRules.add({
        hostType: PlatformId.Azure,
        token: 'testtoken',
        matchHost: 'https://dev.azure.com/renovate2',
      });
      azure.setEndpoint('https://dev.azure.com/renovate2');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });

    it('should set password and endpoint', () => {
      hostRules.add({
        hostType: PlatformId.Azure,
        username: 'user',
        password: 'pass',
        matchHost: 'https://dev.azure.com/renovate3',
      });
      azure.setEndpoint('https://dev.azure.com/renovate3');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
