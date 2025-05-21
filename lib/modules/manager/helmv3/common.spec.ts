import { generateLoginCmd } from './common';
import type { RepositoryRule } from './types';

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
    const command = 'helm registry login';
    expect(await generateLoginCmd(repositoryRule, command)).toEqual(
      'helm registry login --username testuser --password testpass example.com',
    );
  });
});
