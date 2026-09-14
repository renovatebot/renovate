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

  it('removes a datasource prefix when the locked version is bare', () => {
    const lockFileContent = codeBlock`
      [[tools.node]]
      version = "20.11.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      packageFileContent: '[tools]\nnode = "20"\n',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'node',
      currentVersion: '20.11.0',
      newVersion: 'v20.12.0',
    };

    expect(updateLockedDependency(config)).toMatchObject({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('20.11.0', '20.12.0'),
      },
    });
  });

  it('updates the matching entry for a multi-version tool', () => {
    const lockFileContent = codeBlock`
      [[tools.python]]
      version = "3.10.17"

      [[tools.python]]
      version = "3.11.12"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'python',
      currentVersion: '3.11.12',
      newVersion: '3.11.13',
    };

    expect(updateLockedDependency(config)).toEqual({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('3.11.12', '3.11.13'),
      },
    });
  });

  it('does not update a different entry for a multi-version tool', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent: codeBlock`
        [[tools.python]]
        version = "3.10.17"

        [[tools.python]]
        version = "3.11.12"
      `,
      depName: 'python',
      currentVersion: '3.12.0',
      newVersion: '3.12.1',
    };

    expect(updateLockedDependency(config)).toEqual({ status: 'unsupported' });
  });

  it('preserves a nonnumeric replacement version', () => {
    const lockFileContent = codeBlock`
      [[tools.example]]
      version = "20.0.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'example',
      currentVersion: '20.0.0',
      newVersion: 'nightly',
    };

    expect(updateLockedDependency(config)).toMatchObject({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('20.0.0', 'nightly'),
      },
    });
  });
});
