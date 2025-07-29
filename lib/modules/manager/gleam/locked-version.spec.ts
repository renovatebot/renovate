import { codeBlock } from 'common-tags';
import { extractLockFileVersions, parseLockFile } from './locked-version';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

const lockFileContent = codeBlock`
  packages = [
    { name = "foo", version = "1.0.4", build_tools = ["gleam"], requirements = ["bar"], otp_app = "foo", source = "hex", outer_checksum = "5C66647D62BCB11FE327E7A6024907C4A17954EF22865FE0940B54A852446D01" },
    { name = "bar", version = "2.1.0", build_tools = ["rebar3"], requirements = [], otp_app = "bar", source = "hex", outer_checksum = "E38697EDFFD6E91BD12CEA41B155115282630075C2A727E7A6B2947F5408B86A" },
  ]

  [requirements]
  foo = { version = ">= 1.0.0 and < 2.0.0" }
`;

describe('modules/manager/gleam/locked-version', () => {
  describe('extractLockFileVersions()', () => {
    it('returns null for missing lock file', async () => {
      expect(await extractLockFileVersions('manifest.toml')).toBeNull();
    });

    it('returns null for invalid lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce('foo');
      expect(await extractLockFileVersions('manifest.toml')).toBeNull();
    });

    it('returns empty map for lock file without packages', async () => {
      fs.readLocalFile.mockResolvedValueOnce('[requirements]');
      expect(await extractLockFileVersions('manifest.toml')).toEqual(new Map());
    });

    it('returns a map of package versions', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
      expect(await extractLockFileVersions('manifest.toml')).toEqual(
        new Map([
          ['foo', ['1.0.4']],
          ['bar', ['2.1.0']],
        ]),
      );
    });
  });

  describe('parseLockFile', () => {
    it('parses lockfile string into an object', () => {
      const parseLockFileResult = parseLockFile(lockFileContent);
      expect(parseLockFileResult).toStrictEqual({
        packages: [
          {
            name: 'foo',
            version: '1.0.4',
            requirements: ['bar'],
          },
          {
            name: 'bar',
            version: '2.1.0',
            requirements: [],
          },
        ],
      });
    });

    it('can deal with invalid lockfiles', () => {
      const lockFile = 'foo';
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toBeNull();
    });
  });
});
