import { generateLoginCmd } from './common';
import { RepositoryRule } from './types';

describe('generateLoginCmd', () => {
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
    expect(await generateLoginCmd(repositoryRule)).toEqual(
      'helm registry login --username testuser --password testpass example.com',
    );
  });
});
