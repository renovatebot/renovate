import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../types.ts';
import { updateLockedDependency } from './update-locked.ts';

describe('modules/manager/mise/update-locked', () => {
  it('updates only the lockfile version for a major selector', () => {
    const packageFileContent = codeBlock`
      [tools]
      golangci-lint = "2"
    `;
    const lockFileContent = codeBlock`
      [[tools.golangci-lint]]
      version = "2.12.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      packageFileContent,
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'golangci-lint',
      currentVersion: '2.12.0',
      newVersion: '2.13.1',
    };

    expect(updateLockedDependency(config)).toEqual({
      status: 'updated',
      files: {
        'mise.toml': packageFileContent,
        'mise.lock': lockFileContent.replace('2.12.0', '2.13.1'),
      },
    });
  });
});
