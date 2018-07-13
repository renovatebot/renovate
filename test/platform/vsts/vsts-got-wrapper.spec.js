describe('platform/vsts/vsts-got-wrapper', () => {
  let endpoints;
  let vsts;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    endpoints = require('../../../lib/util/endpoints');
    vsts = require('../../../lib/platform/vsts/vsts-got-wrapper');
  });

  describe('gitApi', () => {
    it('should throw an error if no token is provided', () => {
      expect(vsts.gitApi).toThrow('No token found for vsts');
      expect(vsts.getCoreApi).toThrow('No token found for vsts');
    });
    it('should set token and endpoint', async () => {
      endpoints.update({
        platform: 'vsts',
        token: 'myToken',
        endpoint: 'myEndpoint',
      });
      const res = await vsts.vstsObj();

      // We will track if the lib vso-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
