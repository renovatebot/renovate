const { Readable } = require('stream');

describe('platform/azure/helpers', () => {
  let azureHelper;
  let azureApi;

  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/azure/azure-got-wrapper');
    azureHelper = require('../../../lib/platform/azure/azure-helper');
    azureApi = require('../../../lib/platform/azure/azure-got-wrapper');
  });

  describe('getNewBranchName', () => {
    it('should add refs/heads', () => {
      const res = azureHelper.getNewBranchName('testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
    it('should be the same', () => {
      const res = azureHelper.getNewBranchName('refs/heads/testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
  });

  describe('getBranchNameWithoutRefsheadsPrefix', () => {
    it('should be renamed', () => {
      const res = azureHelper.getBranchNameWithoutRefsheadsPrefix(
        'refs/heads/testBB'
      );
      expect(res).toBe(`testBB`);
    });
    it('should log error and return null', () => {
      const res = azureHelper.getBranchNameWithoutRefsheadsPrefix();
      expect(res).toBeNull();
    });
    it('should return the input', () => {
      const res = azureHelper.getBranchNameWithoutRefsheadsPrefix('testBB');
      expect(res).toBe('testBB');
    });
  });

  describe('getRef', () => {
    it('should get the ref', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: 132 }]),
      }));
      const res = await azureHelper.getRefs('123', 'branch');
      expect(res).toMatchSnapshot();
    });
    it('should get 0 ref', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => []),
      }));
      const res = await azureHelper.getRefs('123');
      expect(res.length).toBe(0);
    });
    it('should get the ref', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: '132' }]),
      }));
      const res = await azureHelper.getRefs('123', 'refs/head/branch1');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getAzureBranchObj', () => {
    it('should be the branch object formated', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => [{ objectId: '132' }]),
      }));
      const res = await azureHelper.getAzureBranchObj(
        '123',
        'branchName',
        'base'
      );
      expect(res).toMatchSnapshot();
    });
    it('should be the branch object formated', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getRefs: jest.fn(() => []),
      }));
      const res = await azureHelper.getAzureBranchObj('123', 'branchName');
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

      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await azureHelper.getChanges(
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
      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => null),
      }));

      const res = await azureHelper.getChanges(
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

      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await azureHelper.getFile(
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

      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await azureHelper.getFile(
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

      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => mockEventStream),
      }));

      const res = await azureHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
        'branchName'
      );
      expect(res).toMatchSnapshot();
    });

    it('should return null because the file is not readable', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getItemText: jest.fn(() => ({
          readable: false,
        })),
      }));

      const res = await azureHelper.getFile(
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
      const res = azureHelper.max4000Chars('Hello');
      expect(res).toMatchSnapshot();
    });
    it('should be truncated', () => {
      let str = '';
      for (let i = 0; i < 5000; i += 1) {
        str += 'a';
      }
      const res = azureHelper.max4000Chars(str);
      expect(res.length).toBe(3999);
    });
  });

  describe('getRenovatePRFormat', () => {
    it('should be formated (closed)', () => {
      const res = azureHelper.getRenovatePRFormat({ status: 2 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (closed v2)', () => {
      const res = azureHelper.getRenovatePRFormat({ status: 3 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (not closed)', () => {
      const res = azureHelper.getRenovatePRFormat({ status: 1 });
      expect(res).toMatchSnapshot();
    });

    it('should be formated (isConflicted)', () => {
      const res = azureHelper.getRenovatePRFormat({ mergeStatus: 2 });
      expect(res).toMatchSnapshot();
    });
  });

  describe('getCommitDetails', () => {
    it('should get commit details', async () => {
      azureApi.gitApi.mockImplementationOnce(() => ({
        getCommit: jest.fn(() => ({
          parents: ['123456'],
        })),
      }));
      const res = await azureHelper.getCommitDetails('123', '123456');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getProjectAndRepo', () => {
    it('should return the object with same strings', async () => {
      const res = await azureHelper.getProjectAndRepo('myRepoName');
      expect(res).toMatchSnapshot();
    });
    it('should return the object with project and repo', async () => {
      const res = await azureHelper.getProjectAndRepo('prjName/myRepoName');
      expect(res).toMatchSnapshot();
    });
    it('should return an error', async () => {
      let err;
      try {
        await azureHelper.getProjectAndRepo('prjName/myRepoName/blalba');
      } catch (error) {
        err = error;
      }
      expect(err.message).toBe(
        `prjName/myRepoName/blalba can be only structured this way : 'repository' or 'projectName/repository'!`
      );
    });
  });
});
