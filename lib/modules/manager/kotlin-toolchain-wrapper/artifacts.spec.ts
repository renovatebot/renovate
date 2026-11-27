import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { fs, git } from '~test/util.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const shWrapper = Fixtures.get('kotlin');
const batWrapper = Fixtures.get('kotlin.bat');

const version = '0.12.0-dev-4139';
const sha256 =
  '442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42';

const newVersion = '0.12.0';
const newSha256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const bumpedWrapper = shWrapper
  .replace(`kotlin_cli_version=${version}`, `kotlin_cli_version=${newVersion}`)
  .replace(`kotlin_cli_sha256=${sha256}`, `kotlin_cli_sha256=${newSha256}`);
const bumpedBatWrapper = batWrapper
  .replace(`kotlin_cli_version=${version}`, `kotlin_cli_version=${newVersion}`)
  .replace(`kotlin_cli_sha256=${sha256}`, `kotlin_cli_sha256=${newSha256}`);

function withNewVersion(content: string): string {
  return content.replace(
    `kotlin_cli_version=${version}`,
    `kotlin_cli_version=${newVersion}`,
  );
}

const autoReplacedWrapper = withNewVersion(shWrapper);

const defaultRootHost = 'https://packages.jetbrains.team';
const defaultRootPath = '/maven/p/amper/amper';

const mirrorHost = 'https://maven.example.com';
const mirrorPath = '/mirror';

function artifactPath(
  rootPath: string,
  suffix: string,
  forVersion = version,
): string {
  return `${rootPath}/org/jetbrains/kotlin/kotlin-cli/${forVersion}/kotlin-cli-${forVersion}${suffix}`;
}

function mockExistingFiles(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation((file) =>
    Promise.resolve(files[file] ?? null),
  );
}

function mockWrapperPair(paths: string[]): void {
  const files: Record<string, string> = {};
  for (const path of paths) {
    files[path] = path.endsWith('.bat') ? batWrapper : shWrapper;
  }
  mockExistingFiles(files);
}

function artifact(overrides: Partial<UpdateArtifact> = {}): UpdateArtifact {
  return {
    packageFileName: 'kotlin',
    updatedDeps: [],
    newPackageFileContent: shWrapper,
    config: {},
    ...overrides,
  };
}

function mockAutoReplacedPackageFile(
  siblings: Record<string, string> = {},
): void {
  mockExistingFiles({ kotlin: autoReplacedWrapper, ...siblings });
  git.getFile.mockResolvedValue(shWrapper);
}

function bumpedArtifact(
  overrides: Partial<UpdateArtifact> = {},
): UpdateArtifact {
  return artifact({
    newPackageFileContent: autoReplacedWrapper,
    ...overrides,
  });
}

function contentsOf(res: Awaited<ReturnType<typeof updateArtifacts>>): string {
  const addition = res![0].file as FileAddition;
  return addition.contents as string;
}

const restoredShWrapper = {
  file: {
    type: 'addition',
    path: 'kotlin',
    contents: shWrapper,
  },
};

describe('modules/manager/kotlin-toolchain-wrapper/artifacts', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('updateArtifacts()', () => {
    it('replaces both wrapper scripts and keeps the shell script executable', async () => {
      mockWrapperPair(['kotlin', 'kotlin.bat']);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper'))
        .reply(200, shWrapper)
        .get(artifactPath(defaultRootPath, '-wrapper.bat'))
        .reply(200, batWrapper);

      const res = await updateArtifacts(artifact());

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'kotlin',
            contents: shWrapper,
            isExecutable: true,
          },
        },
        {
          file: {
            type: 'addition',
            path: 'kotlin.bat',
            contents: batWrapper,
            isExecutable: false,
          },
        },
      ]);
    });

    it('writes the checksum of the new version into the wrapper', async () => {
      mockWrapperPair(['kotlin']);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, bumpedWrapper);

      const res = await updateArtifacts(
        artifact({
          newPackageFileContent: shWrapper.replace(
            `kotlin_cli_version=${version}`,
            `kotlin_cli_version=${newVersion}`,
          ),
        }),
      );

      const contents = contentsOf(res);
      expect(contents).toInclude(`kotlin_cli_version=${newVersion}`);
      expect(contents).toInclude(`kotlin_cli_sha256=${newSha256}`);
      expect(contents).not.toInclude(sha256);
    });

    it('returns only the wrapper scripts that exist on disk', async () => {
      mockWrapperPair(['sub/kotlin']);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper'))
        .reply(200, shWrapper);

      const res = await updateArtifacts(
        artifact({ packageFileName: 'sub/kotlin' }),
      );

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'sub/kotlin',
            contents: shWrapper,
            isExecutable: true,
          },
        },
      ]);
    });

    it('updates a batch script that has no shell sibling', async () => {
      mockWrapperPair(['sub/kotlin.bat']);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper.bat'))
        .reply(200, batWrapper);

      const res = await updateArtifacts(
        artifact({
          packageFileName: 'sub/kotlin.bat',
          newPackageFileContent: batWrapper,
        }),
      );

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'sub/kotlin.bat',
            contents: batWrapper,
            isExecutable: false,
          },
        },
      ]);
    });

    it('leaves a same-named file that is not a wrapper alone', async () => {
      mockExistingFiles({
        kotlin: shWrapper,
        'kotlin.bat': '@echo off\r\nkotlinc %*\r\n',
      });
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper'))
        .reply(200, shWrapper);

      const res = await updateArtifacts(artifact());

      expect(res).toMatchObject([{ file: { path: 'kotlin' } }]);
    });

    it('returns null when no wrapper script is on disk', async () => {
      mockExistingFiles({});

      await expect(updateArtifacts(artifact())).resolves.toBeNull();
    });

    it('sends the maven host rule credentials of the download root', async () => {
      hostRules.add({
        hostType: 'maven',
        matchHost: 'maven.example.com',
        token: 'some-token',
      });
      const newPackageFileContent = codeBlock`
        kotlin_cli_version=${version}
        KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${mirrorHost}${mirrorPath}}"
      `;
      mockWrapperPair(['kotlin']);
      httpMock
        .scope(mirrorHost)
        .get(artifactPath(mirrorPath, '-wrapper'))
        .matchHeader('authorization', 'Bearer some-token')
        .reply(200, shWrapper);

      const res = await updateArtifacts(artifact({ newPackageFileContent }));

      expect(res).toMatchObject([{ file: { path: 'kotlin' } }]);
    });

    it('downloads from a custom root and writes it back into the script', async () => {
      const newPackageFileContent = codeBlock`
        kotlin_cli_version=${version}
        KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${mirrorHost}${mirrorPath}}"
      `;
      mockWrapperPair(['kotlin']);
      httpMock
        .scope(mirrorHost)
        .get(artifactPath(mirrorPath, '-wrapper'))
        .reply(200, shWrapper);

      const res = await updateArtifacts(artifact({ newPackageFileContent }));

      const contents = contentsOf(res);
      expect(contents).toInclude(
        `KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${mirrorHost}${mirrorPath}}"`,
      );
      expect(contents).not.toInclude(
        `KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${defaultRootHost}`,
      );
    });

    it('reports an error when the downloaded script has another version', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(
          200,
          shWrapper.replace(
            `kotlin_cli_version=${version}`,
            'kotlin_cli_version=0.13.0',
          ),
        );

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded ${defaultRootHost}${artifactPath(defaultRootPath, '-wrapper', newVersion)} is not a Kotlin Toolchain ${newVersion} wrapper script`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('reports an error when the download is not a wrapper script', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, '<html>login</html>');

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded ${defaultRootHost}${artifactPath(defaultRootPath, '-wrapper', newVersion)} is not a Kotlin Toolchain ${newVersion} wrapper script`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('reports an error when the downloaded script has no checksum', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, `#!/bin/sh\nkotlin_cli_version=${newVersion}\n`);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded ${defaultRootHost}${artifactPath(defaultRootPath, '-wrapper', newVersion)} is not a Kotlin Toolchain ${newVersion} wrapper script`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('reports an error when the download fails', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(404);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toMatchObject([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: expect.stringContaining('404'),
          },
        },
        restoredShWrapper,
      ]);
    });

    it('restores the base script even though the bumped one is on disk', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(404);

      const res = await updateArtifacts(bumpedArtifact());

      const restored = (res![1].file as FileAddition).contents as string;
      expect(restored).not.toBe(autoReplacedWrapper);
      expect(restored).toInclude(`\nkotlin_cli_version=${version}\n`);
      expect(restored).not.toInclude(`\nkotlin_cli_version=${newVersion}\n`);
      expect(git.getFile).toHaveBeenCalledWith('kotlin');
    });

    it('restores the base script without an executable flag', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(404);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res![1].file).not.toHaveProperty('isExecutable');
    });

    it('reports the error alone when the wrapper is not on the base branch', async () => {
      mockExistingFiles({ kotlin: autoReplacedWrapper });
      git.getFile.mockResolvedValue(null);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(404);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toMatchObject([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: expect.stringContaining('404'),
          },
        },
      ]);
      expect(res).toHaveLength(1);
    });

    it('reports an error when a download for a custom root has no download root line', async () => {
      const packageFileContent = codeBlock`
        kotlin_cli_version=${version}
        KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${mirrorHost}${mirrorPath}}"
      `;
      const newPackageFileContent = withNewVersion(packageFileContent);
      mockExistingFiles({ kotlin: newPackageFileContent });
      git.getFile.mockResolvedValue(packageFileContent);
      httpMock
        .scope(mirrorHost)
        .get(artifactPath(mirrorPath, '-wrapper', newVersion))
        .reply(
          200,
          codeBlock`
            #!/bin/sh
            kotlin_cli_version=${newVersion}
            kotlin_cli_sha256=${newSha256}
          `,
        );

      const res = await updateArtifacts(artifact({ newPackageFileContent }));

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded ${mirrorHost}${artifactPath(mirrorPath, '-wrapper', newVersion)} has no KOTLIN_CLI_DOWNLOAD_ROOT line to point at ${mirrorHost}${mirrorPath}`,
          },
        },
        {
          file: {
            type: 'addition',
            path: 'kotlin',
            contents: packageFileContent,
          },
        },
      ]);
    });

    it('reports an error when a download for the default root has no download root line', async () => {
      mockAutoReplacedPackageFile();
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(
          200,
          codeBlock`
            #!/bin/sh
            kotlin_cli_version=${newVersion}
            kotlin_cli_sha256=${newSha256}
          `,
        );

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded ${defaultRootHost}${artifactPath(defaultRootPath, '-wrapper', newVersion)} has no KOTLIN_CLI_DOWNLOAD_ROOT line to point at ${defaultRootHost}${defaultRootPath}`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('writes the root of the local script into a download that declares another one', async () => {
      mockWrapperPair(['kotlin']);
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper'))
        .reply(
          200,
          codeBlock`
            #!/bin/sh
            kotlin_cli_version=${version}
            kotlin_cli_sha256=${sha256}
            KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${mirrorHost}${mirrorPath}}"
          `,
        );

      const res = await updateArtifacts(artifact());

      const contents = contentsOf(res);
      expect(contents).toInclude(
        `KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${defaultRootHost}${defaultRootPath}}"`,
      );
      expect(contents).not.toInclude(mirrorHost);
    });

    it('reports an error when the package file has no version line', async () => {
      mockExistingFiles({});

      const res = await updateArtifacts(
        artifact({ newPackageFileContent: '#!/bin/sh\nexec kotlinc "$@"\n' }),
      );

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: 'No kotlin_cli_version line in kotlin',
          },
        },
      ]);
    });

    it('keeps both scripts unchanged when the downloaded pair disagrees', async () => {
      mockAutoReplacedPackageFile({ 'kotlin.bat': batWrapper });
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, bumpedWrapper)
        .get(artifactPath(defaultRootPath, '-wrapper.bat', newVersion))
        .reply(
          200,
          bumpedBatWrapper.replace(
            `kotlin_cli_sha256=${newSha256}`,
            `kotlin_cli_sha256=${sha256}`,
          ),
        );

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin',
            stderr: `Downloaded Kotlin Toolchain wrapper scripts kotlin and kotlin.bat declare different checksums ${newSha256} and ${sha256}`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('rejects a download that has the form of the other wrapper script', async () => {
      mockAutoReplacedPackageFile({ 'kotlin.bat': batWrapper });
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, bumpedWrapper)
        .get(artifactPath(defaultRootPath, '-wrapper.bat', newVersion))
        .reply(200, bumpedWrapper);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'kotlin.bat',
            stderr: `Downloaded ${defaultRootHost}${artifactPath(defaultRootPath, '-wrapper.bat', newVersion)} is a shell script but kotlin.bat must be a batch script`,
          },
        },
        restoredShWrapper,
      ]);
    });

    it('keeps both scripts unchanged when only one of them can be updated', async () => {
      mockAutoReplacedPackageFile({ 'kotlin.bat': batWrapper });
      httpMock
        .scope(defaultRootHost)
        .get(artifactPath(defaultRootPath, '-wrapper', newVersion))
        .reply(200, bumpedWrapper)
        .get(artifactPath(defaultRootPath, '-wrapper.bat', newVersion))
        .reply(404);

      const res = await updateArtifacts(bumpedArtifact());

      expect(res).toMatchObject([
        {
          artifactError: {
            fileName: 'kotlin.bat',
            stderr: expect.stringContaining('404'),
          },
        },
        restoredShWrapper,
      ]);
    });
  });
});
