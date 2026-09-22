import { logger } from '../../../logger/index.ts';
import { generateLoginCmd } from './common.ts';
import type { RepositoryRule } from './types.ts';

describe('modules/manager/helmv3/common', () => {
  it('should generate a login command with username and password', async () => {
    const repositoryRule: RepositoryRule = {
      name: 'test-repo',
      repository: 'example.com/repo',
      hostRule: {
        hostType: 'docker',
        username: 'testuser',
        password: 'testpass',
      },
    };
    await expect(generateLoginCmd(repositoryRule)).resolves.toEqual(
      'helm registry login --username testuser --password testpass example.com',
    );
  });

  it('does not log the login command', async () => {
    const repositoryRule: RepositoryRule = {
      name: 'test-repo',
      repository: 'example.com/repo',
      hostRule: {
        hostType: 'docker',
        username: 'testuser',
        password: 'testpass',
      },
    };
    await generateLoginCmd(repositoryRule);
    expect(logger.trace).toHaveBeenCalledWith(
      { host: 'example.com' },
      'Generated Helm registry login command',
    );
    expect(logger.trace).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: expect.stringContaining('testpass') }),
      expect.anything(),
    );
  });

  it('should generate a login command with a token as the password', async () => {
    const repositoryRule: RepositoryRule = {
      name: 'test-repo',
      repository: 'example.com/repo',
      hostRule: {
        hostType: 'docker',
        token: 'testtoken',
      },
    };
    await expect(generateLoginCmd(repositoryRule)).resolves.toEqual(
      "helm registry login --username '' --password testtoken example.com",
    );
  });
});
