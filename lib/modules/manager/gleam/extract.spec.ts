import { codeBlock } from 'common-tags';
import * as gleamManager from '.';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

describe('modules/manager/gleam/extract', () => {
  it('should extract dev and prod dependencies', async () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      gleam_json = "~> 0.6.0"

      [dev-dependencies]
      gleeunit = "~> 1.0"
    `;

    fs.readLocalFile.mockResolvedValueOnce(gleamTomlString);
    const extracted = await gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted?.deps).toEqual([
      {
        currentValue: '~> 0.6.0',
        datasource: 'hex',
        depName: 'gleam_json',
        depType: 'dependencies',
      },
      {
        currentValue: '~> 1.0',
        datasource: 'hex',
        depName: 'gleeunit',
        depType: 'devDependencies',
      },
    ]);
  });

  it('should extract dev only dependencies', async () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dev-dependencies]
      gleeunit = "~> 1.0"
    `;

    fs.readLocalFile.mockResolvedValueOnce(gleamTomlString);
    const extracted = await gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted?.deps).toEqual([
      {
        currentValue: '~> 1.0',
        datasource: 'hex',
        depName: 'gleeunit',
        depType: 'devDependencies',
      },
    ]);
  });

  it('should return null when no dependencies are found', async () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [unknown]
      gleam_http = "~> 3.6.0"
    `;

    fs.readLocalFile.mockResolvedValueOnce(gleamTomlString);
    const extracted = await gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted).toBeNull();
  });

  it('should return null when gleam.toml is invalid', async () => {
    fs.readLocalFile.mockResolvedValueOnce('foo');
    const extracted = await gleamManager.extractPackageFile(
      'foo',
      'gleam.toml',
    );
    expect(extracted).toBeNull();
  });

  it('should return locked versions', async () => {
    const packageFileContent = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      foo = ">= 1.0.0 and < 2.0.0"
    `;
    const lockFileContent = codeBlock`
      packages = [
        { name = "foo", version = "1.0.4", build_tools = ["gleam"], requirements = ["bar"], otp_app = "foo", source = "hex", outer_checksum = "5C66647D62BCB11FE327E7A6024907C4A17954EF22865FE0940B54A852446D01" },
        { name = "bar", version = "2.1.0", build_tools = ["rebar3"], requirements = [], otp_app = "bar", source = "hex", outer_checksum = "E38697EDFFD6E91BD12CEA41B155115282630075C2A727E7A6B2947F5408B86A" },
      ]

      [requirements]
      foo = { version = ">= 1.0.0 and < 2.0.0" }
    `;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      packageFileContent,
      'gleam.toml',
    );
    expect(extracted!.deps.every((dep) => 'lockedVersion' in dep)).toBe(true);
  });

  it('should fail to extract locked version', async () => {
    const packageFileContent = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      foo = ">= 1.0.0 and < 2.0.0"
    `;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      packageFileContent,
      'gleam.toml',
    );
    expect(extracted!.deps.every((dep) => 'lockedVersion' in dep)).toBe(false);
  });

  it('should fail to find locked version in range', async () => {
    const packageFileContent = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      foo = ">= 1.0.0 and < 2.0.0"
    `;
    const lockFileContent = codeBlock`
      packages = [
        { name = "foo", version = "2.0.1", build_tools = ["gleam"], requirements = ["bar"], otp_app = "foo", source = "hex", outer_checksum = "5C66647D62BCB11FE327E7A6024907C4A17954EF22865FE0940B54A852446D01" },
        { name = "bar", version = "2.1.0", build_tools = ["rebar3"], requirements = [], otp_app = "bar", source = "hex", outer_checksum = "E38697EDFFD6E91BD12CEA41B155115282630075C2A727E7A6B2947F5408B86A" },
      ]

      [requirements]
      foo = { version = ">= 1.0.0 and < 2.0.0" }
    `;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      packageFileContent,
      'gleam.toml',
    );
    expect(extracted!.deps.every((dep) => 'lockedVersion' in dep)).toBe(false);
  });

  it('should handle invalid versions in lock file', async () => {
    const packageFileContent = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      foo = ">= 1.0.0 and < 2.0.0"
    `;
    const lockFileContent = codeBlock`
      packages = [
        { name = "foo", version = "fooey", build_tools = ["gleam"], requirements = [], otp_app = "foo", source = "hex", outer_checksum = "5C66647D62BCB11FE327E7A6024907C4A17954EF22865FE0940B54A852446D01" },
      ]

      [requirements]
      foo = { version = ">= 1.0.0 and < 2.0.0" }
    `;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      packageFileContent,
      'gleam.toml',
    );
    expect(extracted!.deps).not.toHaveProperty('lockedVersion');
  });

  it('should handle lock file parsing and extracting errors', async () => {
    const packageFileContent = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      foo = ">= 1.0.0 and < 2.0.0"
    `;
    const lockFileContent = codeBlock`invalid`;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      packageFileContent,
      'gleam.toml',
    );
    expect(extracted!.deps).not.toHaveProperty('lockedVersion');
  });
});
