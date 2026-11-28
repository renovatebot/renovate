import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import * as gleamManager from './index.ts';

vi.mock('../../../util/fs/index.ts');

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

  it('should extract table dependencies and skip path and git ones', async () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      gleam_stdlib = { version = ">= 0.44.0 and < 2.0.0" }
      local_dep = { path = "../local_dep" }
      git_dep = { git = "https://github.com/example/git_dep.git", ref = "main" }
      odd_dep = {}

      [dev-dependencies]
      gleeunit = ">= 1.0.0 and < 2.0.0"
    `;
    const lockFileContent = codeBlock`
      packages = [
        { name = "git_dep", version = "1.0.0", build_tools = ["gleam"], requirements = [], source = "git", repo = "https://github.com/example/git_dep.git", commit = "4ee2a4c0d1b6b3ae4b0ca4e1cd8f68eadbd36a94" },
        { name = "gleam_stdlib", version = "1.2.0", build_tools = ["gleam"], requirements = [], otp_app = "gleam_stdlib", source = "hex", outer_checksum = "93D27B978967D61211E06BB1F1062BCF36B6E546F67A575EFA928605F467AF65" },
        { name = "gleeunit", version = "1.11.0", build_tools = ["gleam"], requirements = ["gleam_stdlib"], otp_app = "gleeunit", source = "hex", outer_checksum = "EC31ABA74256AEA531EDF8169931D775BBB384FED0A8A1BDC4DD9354E3E21826" },
        { name = "local_dep", version = "0.1.0", build_tools = ["gleam"], requirements = ["gleam_stdlib"], source = "local", path = "../local_dep" },
      ]

      [requirements]
      git_dep = { git = "https://github.com/example/git_dep.git", ref = "main" }
      gleam_stdlib = { version = ">= 0.44.0 and < 2.0.0" }
      gleeunit = { version = ">= 1.0.0 and < 2.0.0" }
      local_dep = { path = "../local_dep" }
    `;

    fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    fs.localPathExists.mockResolvedValueOnce(true);
    const extracted = await gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted).toEqual({
      deps: [
        {
          currentValue: '>= 0.44.0 and < 2.0.0',
          datasource: 'hex',
          depName: 'gleam_stdlib',
          depType: 'dependencies',
          lockedVersion: '1.2.0',
        },
        {
          datasource: 'hex',
          depName: 'local_dep',
          depType: 'dependencies',
          skipReason: 'path-dependency',
        },
        {
          datasource: 'hex',
          depName: 'git_dep',
          depType: 'dependencies',
          skipReason: 'git-dependency',
        },
        {
          datasource: 'hex',
          depName: 'odd_dep',
          depType: 'dependencies',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '>= 1.0.0 and < 2.0.0',
          datasource: 'hex',
          depName: 'gleeunit',
          depType: 'devDependencies',
          lockedVersion: '1.11.0',
        },
      ],
      lockFiles: ['manifest.toml'],
    });
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
