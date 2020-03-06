import * as _hostRules from '../../util/host-rules';
import { PLATFORM_TYPE_AZURE } from '../../constants/platforms';

describe('platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('./azure-got-wrapper');
  let hostRules: typeof _hostRules;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    hostRules = require('../../util/host-rules');
    azure = require('./azure-got-wrapper');
  });

  describe('gitApi', () => {
    it('should throw an error if no token is provided', () => {
      expect(azure.gitApi).toThrow('No token found for azure');
      expect(azure.coreApi).toThrow('No token found for azure');
      expect(azure.policyApi).toThrow('No token found for azure');
    });
    it('should set token and endpoint', () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_AZURE,
        token: 'token',
        baseUrl: 'https://dev.azure.com/renovate12345',
      });
      azure.setEndpoint('https://dev.azure.com/renovate12345');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
