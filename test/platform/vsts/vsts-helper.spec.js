const { Readable } = require('stream');

describe('platform/vsts/helpers', () => {
  let vstsHelper;
  let vstsApi;

  beforeEach(() => {
    // clean up env
    delete process.env.VSTS_TOKEN;
    delete process.env.VSTS_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/vsts/vsts-got-wrapper');
    vstsHelper = require('../../../lib/platform/vsts/vsts-helper');
    vstsApi = require('../../../lib/platform/vsts/vsts-got-wrapper');
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
    it('should throw an error if no endpoint provided (with env variable on token)', async () => {
      let err;
      process.env.VSTS_TOKEN = 'token123';
      try {
        await vstsHelper.setTokenAndEndpoint();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)'
      );
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
    it('should add refs/heads', () => {
      const res = vstsHelper.getNewBranchName('testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
    it('should be the same', () => {
      const res = vstsHelper.getNewBranchName('refs/heads/testBB');
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

  describe('getRef', () => {
    it('should get the ref', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: 132 }]),
      }));
      const res = await vstsHelper.getRefs('123', 'branch');
      expect(res).toMatchSnapshot();
    });
    it('should get 0 ref', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => []),
      }));
      const res = await vstsHelper.getRefs('123');
      expect(res.length).toBe(0);
    });
    it('should get the ref', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: '132' }]),
      }));
      const res = await vstsHelper.getRefs('123', 'refs/head/branch1');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getVSTSBranchObj', () => {
    it('should be the branch object formated', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: '132' }]),
      }));
      const res = await vstsHelper.getVSTSBranchObj(
        '123',
        'branchName',
        'base'
      );
      expect(res).toMatchSnapshot();
    });
    it('should be the branch object formated', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => []),
      }));
      const res = await vstsHelper.getVSTSBranchObj('123', 'branchName');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getChanges', () => {
    it('should be get the commit obj formated (file to update)', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,
        /* eslint-disable func-names */
        /* eslint-disable object-shorthand */
        read: function() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"hello": "test"}');
          }
          return this.push(null);
        },
      });

      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await vstsHelper.getChanges(
        [
          {
            name: './myFilePath/test',
            contents: 'Hello world!',
          },
        ],
        '123',
        'repository',
        'branchName'
      );
      expect(res).toMatchSnapshot();
    });
    it('should be get the commit obj formated (file to create)', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => null),
      }));

      const res = await vstsHelper.getChanges(
        [
          {
            name: './myFilePath/test',
            contents: 'Hello world!',
          },
        ],
        '123',
        'repository',
        'branchName'
      );
      expect(res).toMatchSnapshot();
    });
  });

  describe('getFile', () => {
    it('should return null error GitItemNotFoundException', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,
        /* eslint-disable func-names */
        /* eslint-disable object-shorthand */
        read: function() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"typeKey": "GitItemNotFoundException"}');
          }
          return this.push(null);
        },
      });

      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await vstsHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
        'branchName'
      );
      expect(res).toBeNull();
    });

    it('should return null error GitUnresolvableToCommitException', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,
        /* eslint-disable func-names */
        /* eslint-disable object-shorthand */
        read: function() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"typeKey": "GitUnresolvableToCommitException"}');
          }
          return this.push(null);
        },
      });

      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await vstsHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
        'branchName'
      );
      expect(res).toBeNull();
    });

    it('should return the file content because it is not a json', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,
        /* eslint-disable func-names */
        /* eslint-disable object-shorthand */
        read: function() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"hello"= "test"}');
          }
          return this.push(null);
        },
      });

      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await vstsHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
        'branchName'
      );
      expect(res).toMatchSnapshot();
    });

    it('should return null because the file is not readable', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => ({
          readable: false,
        })),
      }));

      const res = await vstsHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
        'branchName'
      );
      expect(res).toBeNull();
    });
  });

  describe('max4000Chars', () => {
    it('should be the same', () => {
      const res = vstsHelper.max4000Chars('Hello');
      expect(res).toMatchSnapshot();
    });
    it('should be truncated', () => {
      let str = '';
      for (let i = 0; i < 5000; i += 1) {
        str += 'a';
      }
      const res = vstsHelper.max4000Chars(str);
      expect(res.length).toBe(3999);
    });
  });

  describe('getRenovatePRFormat', () => {
    it('should be formated (closed)', () => {
      const res = vstsHelper.getRenovatePRFormat({ status: 2 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (closed v2)', () => {
      const res = vstsHelper.getRenovatePRFormat({ status: 3 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (not closed)', () => {
      const res = vstsHelper.getRenovatePRFormat({ status: 1 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (isUnmergeable)', () => {
      const res = vstsHelper.getRenovatePRFormat({ mergeStatus: 2 });
      expect(res).toMatchSnapshot();
    });
  });

  describe('getCommitDetails', () => {
    it('should get commit details', async () => {
      vstsApi.gitApi.mockImplementationOnce(() => ({
        getCommit: jest.fn(() => ({
          parents: ['123456'],
        })),
      }));
      const res = await vstsHelper.getCommitDetails('123', '123456');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getProjectAndRepo', () => {
    it('should return the object with same strings', async () => {
      const res = await vstsHelper.getProjectAndRepo('myRepoName');
      expect(res).toMatchSnapshot();
    });
    it('should return the object with project and repo', async () => {
      const res = await vstsHelper.getProjectAndRepo('prjName/myRepoName');
      expect(res).toMatchSnapshot();
    });
    it('should return an error', async () => {
      let err;
      try {
        await vstsHelper.getProjectAndRepo('prjName/myRepoName/blalba');
      } catch (error) {
        err = error;
      }
      expect(err.message).toBe(
        `prjName/myRepoName/blalba can be only structured this way : 'repository' or 'projectName/repository'!`
      );
    });
  });
});
