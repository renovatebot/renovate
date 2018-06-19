const endpoints = require('../../../lib/util/endpoints');

describe('platform/vsts/vsts-got-wrapper', () => {
  let vsts;
  beforeEach(() => {
    // clean up endpoints
    endpoints.clear();

    // reset module
    jest.resetModules();
    vsts = require('../../../lib/platform/vsts/vsts-got-wrapper');
  });

  describe('gitApi', () => {
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await vsts.gitApi();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('No token found for vsts');
    });
    it('should throw an error if no endpoint is provided', async () => {
      let err;
      try {
        endpoints.update({
          platform: 'vsts',
          token: 'myToken',
        });
        await vsts.getCoreApi();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
      );
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
