describe('platform/vsts/helpers', () => {
  let vstsHelper;
  beforeEach(() => {
    // clean up env
    delete process.env.VSTS_TOKEN;
    delete process.env.VSTS_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/vsts/vsts-got-wrapper');
    vstsHelper = require('../../../lib/platform/vsts/vsts-helper');
  });

  describe('getRepos', () => {
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await vstsHelper.setTokenAndEndpoint();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('No token found for vsts');
    });
    it('should throw an error if no endpoint is provided', async () => {
      let err;
      try {
        await vstsHelper.setTokenAndEndpoint('myToken');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
      );
    });
    it('should set token and endpoint', async () => {
      await vstsHelper.setTokenAndEndpoint('myToken', 'myEndpoint');
      expect(process.env.VSTS_TOKEN).toBe(`myToken`);
      expect(process.env.VSTS_ENDPOINT).toBe(`myEndpoint`);
    });
  });

  describe('getNewBranchName', () => {
    it('should getNewBranchName', () => {
      const res = vstsHelper.getNewBranchName('testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
  });

  describe('getBranchNameWithoutRefsheadsPrefix', () => {
    it('should be renamed', () => {
      const res = vstsHelper.getBranchNameWithoutRefsheadsPrefix(
        'refs/heads/testBB'
      );
      expect(res).toBe(`testBB`);
    });
    it('should log error and return null', () => {
      const res = vstsHelper.getBranchNameWithoutRefsheadsPrefix();
      expect(res).toBeNull();
    });
    it('should return the input', () => {
      const res = vstsHelper.getBranchNameWithoutRefsheadsPrefix('testBB');
      expect(res).toBe('testBB');
    });
  });
});
