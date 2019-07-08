import * as _hostRules from '../../../lib/util/host-rules';

describe('platform/azure/azure-got-wrapper', () => {
  let azure: typeof import('../../../lib/platform/azure/azure-got-wrapper');
  let hostRules: typeof _hostRules;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    hostRules = require('../../../lib/util/host-rules');
    azure = require('../../../lib/platform/azure/azure-got-wrapper');
  });

  describe('gitApi', () => {
    it('should throw an error if no token is provided', () => {
      expect(azure.gitApi).toThrow('No token found for azure');
      expect(azure.getCoreApi).toThrow('No token found for azure');
    });
    it('should set token and endpoint', async () => {
      hostRules.add({
        hostType: 'azure',
        token: 'token',
        baseUrl: 'https://dev.azure.com/renovate12345',
      });
      azure.setEndpoint('https://dev.azure.com/renovate12345');

      const res = await azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
