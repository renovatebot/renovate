import type { Stats } from 'node:fs';
import os from 'node:os';
import { codeBlock } from 'common-tags';
import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global.ts';
import * as withCacheModule from '../../../util/cache/package/with-cache.ts';
import { resetPrefetchedImages } from '../../../util/exec/docker/index.ts';
import { getPkgReleases } from '../../datasource/index.ts';
import { updateArtifacts } from './index.ts';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import * as httpMock from '~test/http-mock.ts';
import { env, fs, git, partial } from '~test/util.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/exec/env.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());

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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
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
        cmd: 'docker pull ghcr.io/renovatebot/base-image',
        options: {},
      },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "./":"./" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "../.." ' +
          'ghcr.io/renovatebot/base-image' +
          ' bash -l -c "' +
          'install-tool java 17.0.0 ' +
          '&& ' +
          './mvnw wrapper:wrapper -Dtype=script"',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
        cmd: './mvnw wrapper:wrapper -Dtype=script',
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
    const propertiesWithDistributionChecksumOnly = codeBlock`
      distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
      distributionSha256Sum=oldhash123
    `;

    it('should not delete wrapper jar when only maven distribution checksum is updated', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .reply(200, Buffer.from('fake-maven-distribution-content'));
      mockMavenFileChangedInGit();
      fs.readLocalFile.mockResolvedValueOnce(
        propertiesWithDistributionChecksumOnly,
      );

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    });

    it('should update distribution checksum when maven version changes', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .reply(200, Buffer.from('fake-maven-distribution-content'));
      mockMavenFileChangedInGit();
      // Mock readLocalFile to return content after first write (simulates reading back)
      fs.readLocalFile.mockResolvedValueOnce(
        propertiesWithDistributionChecksumOnly,
      );

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      // Verify writeLocalFile was called twice (initial write, then checksum update)
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      // Check the second (final) write contains updated checksum
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain('distributionSha256Sum=');
      // Should not contain the old hash
      expect(finalWrittenContent).not.toContain('oldhash123');
    });

    it('should use cached distribution checksum when available', async () => {
      mockMavenFileChangedInGit();
      fs.readLocalFile.mockResolvedValueOnce(
        propertiesWithDistributionChecksumOnly,
      );
      const withCacheSpy = vi
        .spyOn(withCacheModule, 'withCache')
        .mockResolvedValueOnce('cachedhash123');

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      expect(withCacheSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: 'url-sha256',
          key: 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
          ttlMinutes: 3 * 24 * 60,
        }),
        expect.any(Function),
      );
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain(
        'distributionSha256Sum=cachedhash123',
      );
    });

    it('should skip checksum update when current content is missing', async () => {
      mockMavenFileChangedInGit();
      fs.readLocalFile.mockResolvedValueOnce(null);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(1);
    });

    it('should update both checksums when wrapper version changes', async () => {
      const propertiesWithChecksums = codeBlock`
        distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
        distributionSha256Sum=oldhash123
        wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
        wrapperSha256Sum=oldwrapperhash456
      `;

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
      // Mock readLocalFile to return content after wrapper:wrapper runs
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithChecksums);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithChecksums,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      // writeLocalFile called twice: initial write, then after checksum update
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).not.toContain('oldhash123');
      expect(finalWrittenContent).not.toContain('oldwrapperhash456');
    });

    it('should preserve old checksum when fetch fails', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .replyWithError('Network error');
      mockMavenFileChangedInGit();
      // Mock readLocalFile to return content for checksum update
      fs.readLocalFile.mockResolvedValueOnce(
        propertiesWithDistributionChecksumOnly,
      );

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      // writeLocalFile called twice: initial write, then checksum update (even if fetch fails, it still writes)
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      // On fetch failure, checksum is not updated (original value preserved)
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain('distributionSha256Sum=oldhash123');
    });

    it('should restore distribution checksum when fetch fails after stripping', async () => {
      const propertiesWithoutDistChecksum = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip`;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .replyWithError('Network error');
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutDistChecksum);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithDistributionChecksumOnly,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain('distributionSha256Sum=oldhash123');
    });

    it('should skip HTTP when no checksums in properties file', async () => {
      const propertiesWithoutChecksums = codeBlock`
        distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
        wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
      `;

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
      const propertiesWithWrapperVersion = codeBlock`
        distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
        wrapperVersion=3.3.2
        wrapperSha256Sum=oldwrapperhash456
      `;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .reply(200, Buffer.from('fake-wrapper-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      // Mock readLocalFile to return content after wrapper:wrapper runs
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithWrapperVersion);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithWrapperVersion,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      // writeLocalFile called twice: initial write, then after checksum update
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).not.toContain('oldwrapperhash456');
    });

    it('should add distribution checksum when it does not exist', async () => {
      const propertiesWithoutDistChecksum = `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip`;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip',
        )
        .reply(200, Buffer.from('fake-maven-distribution-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      // Mock readLocalFile to return content after wrapper:wrapper runs
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutDistChecksum);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: codeBlock`
          distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
          distributionSha256Sum=oldhash123
        `,
        updatedDeps: [{ depName: 'maven-wrapper' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      // writeLocalFile called twice: initial write (stripped), then after checksum update
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      // Should have added the checksum after distributionUrl
      expect(finalWrittenContent).toContain('distributionSha256Sum=');
    });

    it('should add wrapper checksum when it does not exist', async () => {
      const propertiesWithoutWrapperChecksum = codeBlock`
        distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
        wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
      `;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .reply(200, Buffer.from('fake-wrapper-content'));
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      // Mock readLocalFile to return content after wrapper:wrapper runs
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutWrapperChecksum);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: codeBlock`
          distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
          wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
          wrapperSha256Sum=oldwrapperhash456
        `,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      // writeLocalFile called twice: initial write (stripped), then after checksum update
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      // Should have added the checksum after wrapperUrl
      expect(finalWrittenContent).toContain('wrapperSha256Sum=');
    });

    it('should preserve wrapper checksum when fetch fails', async () => {
      const propertiesWithWrapperChecksumOnly = codeBlock`
        wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
        wrapperSha256Sum=oldwrapperhash456
      `;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .replyWithError('Network error');
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithWrapperChecksumOnly);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithWrapperChecksumOnly,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain(
        'wrapperSha256Sum=oldwrapperhash456',
      );
    });

    it('should restore wrapper checksum when fetch fails after stripping', async () => {
      const propertiesWithoutWrapperChecksum = `wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar`;
      const propertiesWithWrapperChecksumOnly = codeBlock`
        wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
        wrapperSha256Sum=oldwrapperhash456
      `;

      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar',
        )
        .replyWithError('Network error');
      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutWrapperChecksum);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithWrapperChecksumOnly,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain(
        'wrapperSha256Sum=oldwrapperhash456',
      );
    });

    it('should unescape distributionUrl, honor wrapperVersion, and keep distributionType', async () => {
      const propertiesWithEscapedUrlsAndType = codeBlock`
        distributionUrl=https\\://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
        distributionSha256Sum=oldhash123
        distributionType=bin
        wrapperVersion=3.3.2
        wrapperSha256Sum=oldwrapperhash456
      `;

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
      const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithEscapedUrlsAndType);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithEscapedUrlsAndType,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(execSnapshots[0].cmd).toContain('-Dtype=bin');
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).not.toContain('oldhash123');
      expect(finalWrittenContent).not.toContain('oldwrapperhash456');
    });

    it('should skip distribution checksum update when distributionUrl is missing', async () => {
      const propertiesWithoutDistributionUrl = `distributionSha256Sum=oldhash123`;

      mockMavenFileChangedInGit();
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutDistributionUrl);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithoutDistributionUrl,
        updatedDeps: [{ depName: 'maven' }],
        config: { currentValue: '3.9.8', newValue: '3.9.9' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain('distributionSha256Sum=oldhash123');
    });

    it('should skip wrapper checksum update when wrapperVersion is missing', async () => {
      const propertiesWithoutWrapperInfo = `wrapperSha256Sum=oldwrapperhash456`;

      mockMavenFileChangedInGit();
      mockExecAll({ stdout: '', stderr: '' });
      fs.readLocalFile.mockResolvedValueOnce(propertiesWithoutWrapperInfo);

      await updateArtifacts({
        packageFileName: '.mvn/wrapper/maven-wrapper.properties',
        newPackageFileContent: propertiesWithoutWrapperInfo,
        updatedDeps: [{ depName: 'maven-wrapper', newValue: '3.3.2' }],
        config: { currentValue: '3.3.1', newValue: '3.3.2' },
      });

      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      const finalWrittenContent = vi.mocked(fs.writeLocalFile).mock.calls[1][1];
      expect(finalWrittenContent).toContain(
        'wrapperSha256Sum=oldwrapperhash456',
      );
    });
  });
});
