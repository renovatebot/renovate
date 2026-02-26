import { Fixtures } from '~test/fixtures.ts';
import { fs, scm } from '~test/util.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import * as datasource from '../../datasource/index.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts', async () => {
  const actual = await vi.importActual<typeof datasource>(
    '../../datasource/index.ts',
  );
  return {
    ...actual,
    getDigest: vi.fn(),
  };
});

const v2Fixture = Fixtures.get('Package.resolved.v2.json');
const v3Fixture = Fixtures.get('Package.resolved.v3.json');

describe('modules/manager/swift/artifacts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when no Package.resolved files exist', async () => {
    scm.getFileList.mockResolvedValue(['Package.swift', 'Sources/main.swift']);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [{ depName: 'Alamofire/Alamofire', newVersion: '5.10.0' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('returns null when updatedDeps is empty', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('returns null for lockFileMaintenance', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [{ depName: 'Alamofire/Alamofire', newVersion: '5.10.0' }],
      newPackageFileContent: '',
      config: { isLockFileMaintenance: true },
    });

    expect(result).toBeNull();
  });

  it('returns null for unparseable JSON', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue('not valid json{{{');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [{ depName: 'Alamofire/Alamofire', newVersion: '5.10.0' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('returns null for unsupported v1 format', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(
      JSON.stringify({
        object: { pins: [] },
        version: 1,
      }),
    );

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [{ depName: 'Alamofire/Alamofire', newVersion: '5.10.0' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('updates a single pin version and revision', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newrevisionsha123');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version" : "5.10.0"');
    expect(contents).toContain('"revision" : "newrevisionsha123"');
    // Other pin unchanged
    expect(contents).toContain('"version" : "1.4.0"');
    expect(contents).toContain(
      '"revision" : "c8ed701b513cf5177118a175d85c4c06d8f9f97c"',
    );
  });

  it('updates multiple pins in one call', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest)
      .mockResolvedValueOnce('alamofiresha')
      .mockResolvedValueOnce('argparsersha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
        {
          depName: 'apple/swift-argument-parser',
          datasource: GithubTagsDatasource.id,
          newVersion: '1.5.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version" : "5.10.0"');
    expect(contents).toContain('"revision" : "alamofiresha"');
    expect(contents).toContain('"version" : "1.5.0"');
    expect(contents).toContain('"revision" : "argparsersha"');
  });

  it('skips dep with no matching pin', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'nonexistent/package',
          datasource: GithubTagsDatasource.id,
          newVersion: '1.0.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('handles getDigest failure — updates version, keeps old revision', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue(null);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version" : "5.10.0"');
    // Revision unchanged since getDigest returned null
    expect(contents).toContain(
      '"revision" : "f455c2975872ccd2d9c81594c658af65716e9b9a"',
    );
  });

  it('updates multiple Package.resolved files', async () => {
    scm.getFileList.mockResolvedValue([
      'Package.resolved',
      'App.xcworkspace/xcshareddata/swiftpm/Package.resolved',
    ]);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(2);
    expect(result![0].file!.path).toBe('Package.resolved');
    expect(result![1].file!.path).toBe(
      'App.xcworkspace/xcshareddata/swiftpm/Package.resolved',
    );
  });

  it('matches URL with .git suffix normalization', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    // swift-argument-parser has .git in the fixture location
    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'apple/swift-argument-parser',
          datasource: GithubTagsDatasource.id,
          newVersion: '1.5.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version" : "1.5.0"');
  });

  it('matches URL with trailing slash normalization', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    // Fixture with trailing slash in location
    const fixtureWithSlash = v2Fixture.replace(
      '"https://github.com/Alamofire/Alamofire"',
      '"https://github.com/Alamofire/Alamofire/"',
    );
    fs.readLocalFile.mockResolvedValue(fixtureWithSlash);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
  });

  it('matches URL case-insensitively', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'alamofire/alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
  });

  it('handles git-tags datasource (full URL as depName)', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'https://github.com/Alamofire/Alamofire.git',
          datasource: GitTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version" : "5.10.0"');
  });

  it('handles gitlab-tags with custom registryUrls', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    const gitlabFixture = JSON.stringify(
      {
        pins: [
          {
            identity: 'my-lib',
            kind: 'remoteSourceControl',
            location: 'https://gitlab.example.com/org/my-lib',
            state: {
              revision: 'oldsha',
              version: '1.0.0',
            },
          },
        ],
        version: 2,
      },
      null,
      2,
    );
    fs.readLocalFile.mockResolvedValue(gitlabFixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'org/my-lib',
          datasource: GitlabTagsDatasource.id,
          registryUrls: ['https://gitlab.example.com'],
          newVersion: '2.0.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"version": "2.0.0"');
    expect(contents).toContain('"revision": "newsha"');
  });

  it('uses dep.newDigest when already present', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
          newDigest: 'precomputedsha456',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"revision" : "precomputedsha456"');
    // getDigest should not have been called
    expect(datasource.getDigest).not.toHaveBeenCalled();
  });

  it('preserves v3 originHash', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v3Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    expect(contents).toContain('"originHash" : "abc123def456"');
    expect(contents).toContain('"version" : "5.10.0"');
  });

  it('returns null when pin is already up-to-date', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.9.1', // same as fixture
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('preserves Xcode formatting with spaces before colons', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);
    vi.mocked(datasource.getDigest).mockResolvedValue('newsha');

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toHaveLength(1);
    const { contents } = result![0].file as { contents: string };
    // Xcode uses "key" : "value" format (space before colon)
    expect(contents).toContain('"version" : "5.10.0"');
    expect(contents).toContain('"revision" : "newsha"');
    // Verify overall structure is preserved
    expect(contents).toContain('"identity" : "alamofire"');
    expect(contents).toContain('"version" : 2');
  });

  it('returns null when Package.resolved cannot be read', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(null);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          newVersion: '5.10.0',
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });

  it('skips dep with no newVersion', async () => {
    scm.getFileList.mockResolvedValue(['Package.resolved']);
    fs.readLocalFile.mockResolvedValue(v2Fixture);

    const result = await updateArtifacts({
      packageFileName: 'Package.swift',
      updatedDeps: [
        {
          depName: 'Alamofire/Alamofire',
          datasource: GithubTagsDatasource.id,
          // no newVersion
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
  });
});
