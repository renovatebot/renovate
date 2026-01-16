import type { Stats } from 'node:fs';
import os from 'node:os';
import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import { getPkgReleases } from '../../datasource';
import { updateArtifacts } from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import * as httpMock from '~test/http-mock';
import { env, fs, git, partial } from '~test/util';

vi.mock('../../../util/fs');
vi.mock('../../../util/exec/env');
vi.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const osPlatformSpy = vi.spyOn(os, 'platform');

function mockMavenFileChangedInGit(fileName = 'maven-wrapper.properties') {
  git.getRepoStatus.mockResolvedValueOnce(
    partial<StatusResult>({
      modified: [`maven.mvn/wrapper/${fileName}`],
    }),
  );
}

describe('modules/manager/maven-wrapper/artifacts', () => {
  beforeEach(() => {
    osPlatformSpy.mockImplementation(() => 'linux');
    GlobalConfig.set({ localDir: upath.join('/tmp/github/some/repo') });
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      }),
    );

    resetPrefetchedImages();

    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });
  });

  it('Should not update if there is no dep with maven:wrapper', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'not-mavenwrapper' }],
      config: {},
    });
    expect(updatedDeps).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('Docker should use java 8 if version is lower then 2.0.0', async () => {
    mockMavenFileChangedInGit();
    const execSnapshots = mockExecAll();
    GlobalConfig.set({ localDir: './', binarySource: 'docker' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: {
        currentValue: '2.0.0',
        newValue: '3.3.1',
        constraints: undefined,
      },
    });

    const expected = [
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];

    expect(execSnapshots[2].cmd).toContain('java 8.0.1');
    expect(updatedDeps).toEqual(expected);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('Should update when it is maven wrapper', async () => {
    mockMavenFileChangedInGit();
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { currentValue: '3.3.1', newValue: '3.3.1' },
    });

    const expected = [
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];
    expect(updatedDeps).toEqual(expected);
    expect(execSnapshots).toEqual([
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('Should not update deps when maven-wrapper.properties is not in git change', async () => {
    mockMavenFileChangedInGit('not-maven-wrapper.properties');
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(updatedDeps).toEqual([]);
    expect(execSnapshots).toEqual([
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('updates with docker', async () => {
    mockMavenFileChangedInGit();
    GlobalConfig.set({
      localDir: './',
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const result = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { currentValue: '3.3.0', newValue: '3.3.1' },
    });
    expect(result).toEqual([
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'docker pull ghcr.io/containerbase/sidecar',
        options: {},
      },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "./":"./" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "../.." ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool java 17.0.0 ' +
          '&& ' +
          './mvnw wrapper:wrapper"',
        options: {
          cwd: '../..',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('Should return null when cmd is not found', async () => {
    osPlatformSpy.mockImplementation(() => 'win32');
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    fs.statLocalFile.mockResolvedValue(null);
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(updatedDeps).toBeNull();
    expect(execSnapshots).toMatchObject([]);
    expect(git.getRepoStatus).not.toHaveBeenCalled();
  });

  it('Should throw an error when it cant execute', async () => {
    mockExecAll(new Error('temporary-error'));
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(updatedDeps).toEqual([
      {
        artifactError: {
          lockFile: 'maven',
          stderr: 'temporary-error',
        },
      },
    ]);
    expect(git.getRepoStatus).not.toHaveBeenCalled();
  });

  it('updates with binarySource install', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    mockMavenFileChangedInGit();
    GlobalConfig.set({
      localDir: upath.join('/tmp/github/some/repo'),
      binarySource: 'install',
    });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool java 17.0.0' },
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);

    expect(updatedDeps).toEqual([
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('updates with binarySource install after detecting wrapper version from mvnw script', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    mockMavenFileChangedInGit();
    GlobalConfig.set({
      localDir: upath.join('/tmp/github/some/repo'),
      binarySource: 'install',
    });
    const updatedDeps = await updateArtifacts({
      packageFileName: './mvnw',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool java 17.0.0' },
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);

    expect(updatedDeps).toEqual([]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('should run wrapper:wrapper with MVNW_REPOURL if it is a custom artifactory', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    mockMavenFileChangedInGit();
    await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [
        {
          depName: 'maven-wrapper',
          replaceString:
            'https://internal.local/maven-public/org/apache/maven/wrapper/maven-wrapper/3.0.0/maven-wrapper-3.0.0.jar',
        },
      ],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
            MVNW_REPOURL: 'https://internal.local/maven-public',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('should run not include MVNW_REPOURL when run with default maven repo url', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    mockMavenFileChangedInGit();
    await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [
        {
          depName: 'maven-wrapper',
          replaceString:
            'https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.1/maven-wrapper-3.1.1.jar',
        },
      ],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
    expect(execSnapshots[0].options!.env).not.toHaveProperty('MVNW_REPOURL');
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  it('should run not include MVNW_REPOURL when run with a malformed replaceString', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    mockMavenFileChangedInGit();
    await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [
        {
          depName: 'maven-wrapper',
          replaceString: 'not a good url',
        },
      ],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: './mvnw wrapper:wrapper',
        options: {
          cwd: '/tmp/github',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);

    expect(execSnapshots[0].options!.env).not.toHaveProperty('MVNW_REPOURL');
    expect(git.getRepoStatus).toHaveBeenCalledExactlyOnceWith();
  });

  describe('checksum updates', () => {
    const propertiesWithChecksums = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
distributionSha256Sum=oldhash123
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
wrapperSha256Sum=oldwrapperhash456`;

    const propertiesWithDistributionChecksumOnly = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
distributionSha256Sum=oldhash123`;

    it('should update distribution checksum when maven version changes', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .reply(200, Buffer.from('fake-maven-distribution-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      // Verify writeLocalFile was called with updated checksum
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        '.mvn/wrapper/maven-wrapper.properties',
        expect.stringContaining('distributionSha256Sum='),
      );
      // Should not contain the old hash
      const writtenContent = vi.mocked(fs.writeLocalFile).mock.calls[0][1];
      expect(writtenContent).not.toContain('oldhash123');
    });

    it('should update both checksums when wrapper version changes', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .reply(200, Buffer.from('fake-maven-content'))
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .reply(200, Buffer.from('fake-wrapper-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithChecksums,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeLocalFile).mock.calls[0][1];
      expect(writtenContent).not.toContain('oldhash123');
      expect(writtenContent).not.toContain('oldwrapperhash456');
    });

    it('should preserve old checksum when fetch fails', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .replyWithError('Network error');
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      // Should still write file but with old checksum preserved
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        '.mvn/wrapper/maven-wrapper.properties',
        expect.stringContaining('distributionSha256Sum=oldhash123'),
      );
    });

    it('should skip HTTP when no checksums in properties file', async () => {
      const propertiesWithoutChecksums = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar`;

      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithoutChecksums,
        updatedDeps: [{ depName: 'maven-wrapper' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      // File should still be written (for wrapper update)
      expect(fs.writeLocalFile).toHaveBeenCalled();
      // No HTTP calls should have been made (no mocked endpoints were hit)
    });

    it('should return null when only maven is updated without checksums', async () => {
      const propertiesWithoutChecksums = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip`;

      const result = await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithoutChecksums,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      expect(result).toBeNull();
    });

    it('should construct wrapper URL from version when wrapperUrl is missing', async () => {
      const propertiesWithWrapperVersion = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
wrapperVersion=3.3.2
wrapperSha256Sum=oldwrapperhash456`;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .reply(200, Buffer.from('fake-wrapper-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithWrapperVersion,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeLocalFile).mock.calls[0][1];
      expect(writtenContent).not.toContain('oldwrapperhash456');
    });
  });
});
