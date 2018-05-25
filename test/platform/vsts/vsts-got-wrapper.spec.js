describe('platform/vsts/vsts-got-wrapper', () => {
  let vsts;
  beforeEach(() => {
    // clean up env
    delete process.env.VSTS_TOKEN;
    delete process.env.VSTS_ENDPOINT;

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
        process.env.VSTS_TOKEN = 'myToken';
        await vsts.getCoreApi();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
      );
    });
    it('should set token and endpoint', async () => {
      process.env.VSTS_TOKEN = 'myToken';
      process.env.VSTS_ENDPOINT = 'myEndpoint';
      const res = await vsts.vstsObj();

      // We will track if the lib vso-node-api change
      expect(res).toMatchSnapshot();
      expect(process.env.VSTS_TOKEN).toBe(`myToken`);
      expect(process.env.VSTS_ENDPOINT).toBe(`myEndpoint`);
    });
  });
});
