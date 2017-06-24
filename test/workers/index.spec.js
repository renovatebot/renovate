const indexWorker = require('../../lib/workers/index');
const repositoryWorker = require('../../lib/workers/repository');
const configParser = require('../../lib/config');

describe('lib/workers/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    configParser.parseConfigs = jest.fn();
    configParser.getRepoConfig = jest.fn();
    repositoryWorker.processRepo = jest.fn();
  });
  it('handles zero repos', async () => {
    configParser.parseConfigs.mockReturnValueOnce({
      repositories: [],
    });
    await indexWorker.start();
  });
  it('processes repositories', async () => {
    configParser.parseConfigs.mockReturnValueOnce({
      foo: 1,
      repositories: ['a', 'b'],
    });
    configParser.getRepoConfig.mockReturnValue({
      repository: 'foo',
    });
    await indexWorker.start();
    expect(configParser.parseConfigs.mock.calls.length).toBe(1);
    expect(configParser.getRepoConfig.mock.calls).toMatchSnapshot();
    expect(repositoryWorker.processRepo.mock.calls.length).toBe(2);
  });
  it('catches errors', async () => {
    configParser.parseConfigs.mockImplementationOnce(() => {
      throw new Error('a');
    });
    await indexWorker.start();
  });
});
