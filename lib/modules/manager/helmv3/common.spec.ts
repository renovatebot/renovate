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
    expect(await generateLoginCmd(repositoryRule)).toEqual(
      'helm registry login --username testuser --password testpass example.com',
    );
  });
});
