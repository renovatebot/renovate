describe('platform/azure/azure-got-wrapper', () => {
  let hostRules;
  let azure;
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
      hostRules.update({
        platform: 'azure',
        token: 'myToken',
        endpoint: 'myEndpoint',
      });
      const res = await azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
