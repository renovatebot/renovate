import { Readable } from 'node:stream';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi';
import { GitPullRequestMergeStrategy } from 'azure-devops-node-api/interfaces/GitInterfaces';
import type { PolicyConfiguration } from 'azure-devops-node-api/interfaces/PolicyInterfaces';
import { partial } from '../../../../test/util';

jest.mock('./azure-got-wrapper');

describe('modules/platform/azure/azure-helper', () => {
  let azureHelper: typeof import('./azure-helper');
  let azureApi: jest.Mocked<typeof import('./azure-got-wrapper')>;

  beforeEach(async () => {
    // reset module
    jest.resetModules();
    azureHelper = await import('./azure-helper');
    azureApi = jest.requireMock('./azure-got-wrapper');
  });

  describe('getRef', () => {
    it('should get the ref with short ref name', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getRefs: jest.fn(() => [{ objectId: 132 }]),
          }) as any,
      );
      const res = await azureHelper.getRefs('123', 'branch');
      expect(res).toMatchSnapshot();
    });

    it('should not get ref', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getRefs: jest.fn(() => []),
          }) as any,
      );
      const res = await azureHelper.getRefs('123');
      expect(res).toHaveLength(0);
    });

    it('should get the ref with full ref name', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getRefs: jest.fn(() => [{ objectId: '132' }]),
          }) as any,
      );
      const res = await azureHelper.getRefs('123', 'refs/head/branch1');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getAzureBranchObj', () => {
    it('should get the branch object', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getRefs: jest.fn(() => [{ objectId: '132' }]),
          }) as any,
      );
      const res = await azureHelper.getAzureBranchObj(
        '123',
        'branchName',
        'base',
      );
      expect(res).toMatchSnapshot();
    });

    it('should get the branch object when ref missing', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getRefs: jest.fn(() => []),
          }) as any,
      );
      const res = await azureHelper.getAzureBranchObj('123', 'branchName');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getFile', () => {
    it('should return null error GitItemNotFoundException', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,

        read() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"typeKey": "GitItemNotFoundException"}');
          }
          return this.push(null);
        },
      });

      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemText: jest.fn(() => mockEventStream),
          }) as any,
      );

      const res = await azureHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
      );
      expect(res).toBeNull();
    });

    it('should return null error GitUnresolvableToCommitException', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,

        read() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"typeKey": "GitUnresolvableToCommitException"}');
          }
          return this.push(null);
        },
      });

      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemText: jest.fn(() => mockEventStream),
          }) as any,
      );

      const res = await azureHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
      );
      expect(res).toBeNull();
    });

    it('should return the file content because it is not a json', async () => {
      let eventCount = 0;
      const mockEventStream = new Readable({
        objectMode: true,

        read() {
          if (eventCount < 1) {
            eventCount += 1;
            return this.push('{"hello"= "test"}');
          }
          return this.push(null);
        },
      });

      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemText: jest.fn(() => mockEventStream),
          }) as any,
      );

      const res = await azureHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
      );
      expect(res).toMatchSnapshot();
    });

    it('should return null because the file is not readable', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemText: jest.fn(() => ({
              readable: false,
            })),
          }) as any,
      );

      const res = await azureHelper.getFile(
        '123',
        'repository',
        './myFilePath/test',
      );
      expect(res).toBeNull();
    });
  });

  describe('getCommitDetails', () => {
    it('should get commit details', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getCommit: jest.fn(() => ({
              parents: ['123456'],
            })),
          }) as any,
      );
      const res = await azureHelper.getCommitDetails('123', '123456');
      expect(res).toMatchSnapshot();
    });
  });

  describe('getMergeMethod', () => {
    it('should default to NoFastForward', async () => {
      azureApi.policyApi.mockImplementationOnce(
        () =>
          ({
            getPolicyConfigurations: jest.fn(() => []),
          }) as any,
      );
      expect(await azureHelper.getMergeMethod('', '')).toEqual(
        GitPullRequestMergeStrategy.NoFastForward,
      );
    });

    it('should return Squash', async () => {
      azureApi.policyApi.mockImplementationOnce(
        () =>
          ({
            getPolicyConfigurations: jest.fn(() => [
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      repositoryId: '',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
            ]),
          }) as any,
      );
      expect(await azureHelper.getMergeMethod('', '')).toEqual(
        GitPullRequestMergeStrategy.Squash,
      );
    });

    it('should return Squash when Project wide exact branch policy exists', async () => {
      const refMock = 'refs/heads/ding';

      azureApi.policyApi.mockResolvedValueOnce(
        partial<IPolicyApi>({
          getPolicyConfigurations: jest.fn(() =>
            Promise.resolve([
              partial<PolicyConfiguration>({
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      // null here means project wide
                      repositoryId: null,
                      matchKind: 'Exact',
                      refName: refMock,
                    },
                  ],
                },
              }),
            ]),
          ),
        }),
      );
      expect(await azureHelper.getMergeMethod('', '', refMock)).toEqual(
        GitPullRequestMergeStrategy.Squash,
      );
    });

    it('should return default branch policy', async () => {
      azureApi.policyApi.mockImplementationOnce(
        () =>
          ({
            getPolicyConfigurations: jest.fn(() => [
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      repositoryId: 'doo-dee-doo-repository-id',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowRebase: true,
                  scope: [
                    {
                      matchKind: 'DefaultBranch',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
            ]),
          }) as any,
      );
      expect(await azureHelper.getMergeMethod('', '')).toEqual(
        GitPullRequestMergeStrategy.Rebase,
      );
    });

    it('should return most specific exact branch policy', async () => {
      const refMock = 'refs/heads/ding';
      const defaultBranchMock = 'dong';
      azureApi.policyApi.mockImplementationOnce(
        () =>
          ({
            getPolicyConfigurations: jest.fn(() => [
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      repositoryId: 'doo-dee-doo-repository-id',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      repositoryId: '',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      matchKind: 'DefaultBranch',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowRebase: true,
                  scope: [
                    {
                      matchKind: 'Exact',
                      refName: refMock,
                      repositoryId: '',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
            ]),
          }) as any,
      );
      expect(
        await azureHelper.getMergeMethod('', '', refMock, defaultBranchMock),
      ).toEqual(GitPullRequestMergeStrategy.Rebase);
    });

    it('should return most specific prefix branch policy', async () => {
      const refMock = 'refs/heads/ding-wow';
      const defaultBranchMock = 'dong-wow';
      azureApi.policyApi.mockImplementationOnce(
        () =>
          ({
            getPolicyConfigurations: jest.fn(() => [
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      repositoryId: '',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowSquash: true,
                  scope: [
                    {
                      matchKind: 'DefaultBranch',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
              {
                settings: {
                  allowRebase: true,
                  scope: [
                    {
                      matchKind: 'Prefix',
                      refName: 'refs/heads/ding',
                      repositoryId: '',
                    },
                  ],
                },
                type: {
                  id: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
                },
              },
            ]),
          }) as any,
      );
      expect(
        await azureHelper.getMergeMethod('', '', refMock, defaultBranchMock),
      ).toEqual(GitPullRequestMergeStrategy.Rebase);
    });
  });
});
