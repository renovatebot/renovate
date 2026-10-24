import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import type { ExtractConfig } from '../types.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

const config: ExtractConfig = {};

const shWrapper = codeBlock`
  #!/bin/sh

  kotlin_cli_version=0.12.0
  kotlin_cli_sha256=442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42
`;

const batWrapper = codeBlock`
  @echo off

  set kotlin_cli_version=0.12.0
  set kotlin_cli_sha256=442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42
`;

function mockFiles(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation((file) =>
    Promise.resolve(files[file] ?? null),
  );
}

describe('modules/manager/kotlin-toolchain-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts the Kotlin CLI version', () => {
      expect(extractPackageFile(shWrapper)).toEqual({
        deps: [
          {
            depName: 'org.jetbrains.kotlin:kotlin-cli',
            depType: 'toolchain',
            currentValue: '0.12.0',
            replaceString: 'kotlin_cli_version=0.12.0',
            datasource: 'maven',
            registryUrls: [
              'https://packages.jetbrains.team/maven/p/amper/amper',
            ],
          },
        ],
      });
    });

    it('returns null for a file that is not a wrapper', () => {
      const content = codeBlock`
        #!/bin/sh
        exec kotlinc "$@"
      `;

      expect(extractPackageFile(content)).toBeNull();
    });

    it('uses a custom download root as registry', () => {
      const content = codeBlock`
        kotlin_cli_version=0.12.0
        KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-https://maven.example.com/mirror}"
      `;

      expect(extractPackageFile(content)?.deps[0].registryUrls).toEqual([
        'https://maven.example.com/mirror',
      ]);
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('reports one dependency for a wrapper pair, on the shell script', async () => {
      mockFiles({ kotlin: shWrapper, 'kotlin.bat': batWrapper });

      const res = await extractAllPackageFiles(config, [
        'kotlin',
        'kotlin.bat',
      ]);

      expect(res).toMatchObject([
        {
          packageFile: 'kotlin',
          deps: [{ currentValue: '0.12.0' }],
        },
      ]);
    });

    it.each`
      packageFile
      ${'kotlin'}
      ${'kotlin.bat'}
    `(
      'keeps $packageFile as primary when its consistent sibling is excluded',
      async ({ packageFile }: { packageFile: string }) => {
        mockFiles({ kotlin: shWrapper, 'kotlin.bat': batWrapper });

        const res = await extractAllPackageFiles(config, [packageFile]);

        expect(res).toMatchObject([
          { packageFile, deps: [{ currentValue: '0.12.0' }] },
        ]);
      },
    );

    it('does not extract an excluded wrapper when the matched file is not a wrapper', async () => {
      mockFiles({ kotlin: shWrapper, 'kotlin.bat': '@echo off' });

      await expect(
        extractAllPackageFiles(config, ['kotlin.bat']),
      ).resolves.toBeNull();
    });

    it('falls back to the batch script when it is alone', async () => {
      mockFiles({ 'kotlin.bat': batWrapper });

      const res = await extractAllPackageFiles(config, ['kotlin.bat']);

      expect(res).toMatchObject([
        {
          packageFile: 'kotlin.bat',
          deps: [{ replaceString: 'set kotlin_cli_version=0.12.0' }],
        },
      ]);
    });

    it('reports each directory separately', async () => {
      mockFiles({
        'a/kotlin': shWrapper,
        'a/kotlin.bat': batWrapper,
        'b/kotlin': shWrapper.replace('0.12.0', '0.11.1'),
        'b/kotlin.bat': batWrapper.replace('0.12.0', '0.11.1'),
      });

      const res = await extractAllPackageFiles(config, [
        'a/kotlin',
        'a/kotlin.bat',
        'b/kotlin',
        'b/kotlin.bat',
      ]);

      expect(res).toMatchObject([
        { packageFile: 'a/kotlin', deps: [{ currentValue: '0.12.0' }] },
        { packageFile: 'b/kotlin', deps: [{ currentValue: '0.11.1' }] },
      ]);
    });

    it('ignores sibling scripts with another name', async () => {
      mockFiles({
        'a/kotlin': shWrapper,
        'a/kotlin-from-sources': shWrapper,
      });

      const res = await extractAllPackageFiles(config, [
        'a/kotlin-from-sources',
        'a/kotlin',
      ]);

      expect(res).toMatchObject([{ packageFile: 'a/kotlin' }]);
    });

    it('falls back to the batch script when the shell script is not a wrapper', async () => {
      mockFiles({
        kotlin: '#!/bin/sh\nexec kotlinc "$@"\n',
        'kotlin.bat': batWrapper,
      });

      const res = await extractAllPackageFiles(config, [
        'kotlin',
        'kotlin.bat',
      ]);

      expect(res).toMatchObject([{ packageFile: 'kotlin.bat' }]);
    });

    it('falls back to the batch script when the shell script is unreadable', async () => {
      mockFiles({ 'kotlin.bat': batWrapper });

      const res = await extractAllPackageFiles(config, [
        'kotlin',
        'kotlin.bat',
      ]);

      expect(res).toMatchObject([{ packageFile: 'kotlin.bat' }]);
    });

    it('skips a directory without a wrapper script', async () => {
      mockFiles({ 'a/kotlin-from-sources': shWrapper });

      await expect(
        extractAllPackageFiles(config, ['a/kotlin-from-sources']),
      ).resolves.toBeNull();
    });

    it('skips an unreadable wrapper script', async () => {
      mockFiles({});

      await expect(
        extractAllPackageFiles(config, ['kotlin']),
      ).resolves.toBeNull();
    });

    it('skips a file that is not a wrapper', async () => {
      mockFiles({ kotlin: '#!/bin/sh\nexec kotlinc "$@"\n' });

      await expect(
        extractAllPackageFiles(config, ['kotlin']),
      ).resolves.toBeNull();
    });

    it.each`
      packageFiles
      ${['kotlin', 'kotlin.bat']}
      ${['kotlin']}
      ${['kotlin.bat']}
    `(
      'skips a pair that declares different versions when matching $packageFiles',
      async ({ packageFiles }: { packageFiles: string[] }) => {
        mockFiles({
          kotlin: shWrapper,
          'kotlin.bat': batWrapper.replace('0.12.0', '0.11.1'),
        });

        await expect(
          extractAllPackageFiles(config, packageFiles),
        ).resolves.toBeNull();
      },
    );

    it.each`
      packageFiles
      ${['kotlin', 'kotlin.bat']}
      ${['kotlin']}
      ${['kotlin.bat']}
    `(
      'skips a pair that declares different checksums when matching $packageFiles',
      async ({ packageFiles }: { packageFiles: string[] }) => {
        mockFiles({
          kotlin: shWrapper,
          'kotlin.bat': batWrapper.replace(
            '442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42',
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          ),
        });

        await expect(
          extractAllPackageFiles(config, packageFiles),
        ).resolves.toBeNull();
      },
    );

    it.each`
      packageFiles
      ${['kotlin', 'kotlin.bat']}
      ${['kotlin']}
      ${['kotlin.bat']}
    `(
      'skips a pair where only the batch script lacks a checksum when matching $packageFiles',
      async ({ packageFiles }: { packageFiles: string[] }) => {
        mockFiles({
          kotlin: shWrapper,
          'kotlin.bat': '@echo off\r\nset kotlin_cli_version=0.12.0\r\n',
        });

        await expect(
          extractAllPackageFiles(config, packageFiles),
        ).resolves.toBeNull();
      },
    );

    it.each`
      packageFiles
      ${['kotlin', 'kotlin.bat']}
      ${['kotlin']}
      ${['kotlin.bat']}
    `(
      'skips a pair where only the shell script lacks a checksum when matching $packageFiles',
      async ({ packageFiles }: { packageFiles: string[] }) => {
        mockFiles({
          kotlin: '#!/bin/sh\nkotlin_cli_version=0.12.0\n',
          'kotlin.bat': batWrapper,
        });

        await expect(
          extractAllPackageFiles(config, packageFiles),
        ).resolves.toBeNull();
      },
    );

    it.each`
      packageFiles
      ${['kotlin', 'kotlin.bat']}
      ${['kotlin']}
      ${['kotlin.bat']}
    `(
      'skips a pair that declares different download roots when matching $packageFiles',
      async ({ packageFiles }: { packageFiles: string[] }) => {
        mockFiles({
          kotlin: codeBlock`
          ${shWrapper}
          KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-https://maven.example.com/mirror}"
        `,
          'kotlin.bat': batWrapper,
        });

        await expect(
          extractAllPackageFiles(config, packageFiles),
        ).resolves.toBeNull();
      },
    );

    it('accepts a pair whose checksums differ only in case', async () => {
      mockFiles({
        kotlin: shWrapper,
        'kotlin.bat': batWrapper.replace(
          '442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42',
          '442CF2EA77C4C3C2228C3D256D6BD48FB7A319DF4A16ABBD57DBC2FC9A944D42',
        ),
      });

      const res = await extractAllPackageFiles(config, [
        'kotlin',
        'kotlin.bat',
      ]);

      expect(res).toMatchObject([{ packageFile: 'kotlin' }]);
    });
  });
});
