import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../types';
import * as lockedVersion from './locked-version';
import { updateLockedDependency } from '.';

const lockFileContent = codeBlock`
  packages = [
    { name = "foo", version = "1.0.4", build_tools = ["gleam"], requirements = ["bar"], otp_app = "foo", source = "hex", outer_checksum = "5C66647D62BCB11FE327E7A6024907C4A17954EF22865FE0940B54A852446D01" },
    { name = "bar", version = "2.1.0", build_tools = ["rebar3"], requirements = [], otp_app = "bar", source = "hex", outer_checksum = "E38697EDFFD6E91BD12CEA41B155115282630075C2A727E7A6B2947F5408B86A" },
  ]

  [requirements]
  foo = { version = ">= 1.0.0 and < 2.0.0" }
`;

describe('modules/manager/gleam/update-locked', () => {
  it('detects already updated', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'gleam.toml',
      lockFile: 'manifest.toml',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('already-updated');
  });

  it('returns unsupported for empty lockfile', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'gleam.toml',
      lockFile: 'manifest.toml',
      depName: 'foo',
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported for empty depName', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'gleam.toml',
      lockFile: 'manifest.toml',
      lockFileContent,
      depName: undefined as never,
      newVersion: '1.0.4',
      currentVersion: '1.0.4',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns unsupported', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'gleam.toml',
      lockFile: 'manifest.toml',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.3',
      currentVersion: '1.0.0',
    };
    expect(updateLockedDependency(config).status).toBe('unsupported');
  });

  it('returns update-failed in case of errors', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'gleam.toml',
      lockFile: 'manifest.toml',
      lockFileContent,
      depName: 'foo',
      newVersion: '1.0.3',
      currentVersion: '1.0.0',
    };
    jest
      .spyOn(lockedVersion, 'extractLockFileContentVersions')
      .mockReturnValueOnce(new Error() as never);
    expect(updateLockedDependency(config).status).toBe('update-failed');
  });
});
