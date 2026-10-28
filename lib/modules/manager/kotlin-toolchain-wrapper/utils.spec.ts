import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import {
  defaultDownloadRoot,
  parseWrapper,
  withDownloadRoot,
} from './utils.ts';

const sha256 =
  '442cf2ea77c4c3c2228c3d256d6bd48fb7a319df4a16abbd57dbc2fc9a944d42';
const downloadRoot = 'https://maven.example.com/mirror';

const shWrapper = codeBlock`
  #!/bin/sh

  set -e -u

  kotlin_cli_version=0.12.0-dev-4139
  kotlin_cli_sha256=${sha256}

  KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${downloadRoot}}"
`;

const batWrapper = codeBlock`
  @echo off

  setlocal

  set kotlin_cli_version=0.12.0-dev-4139
  set kotlin_cli_sha256=${sha256}

  if not defined KOTLIN_CLI_DOWNLOAD_ROOT set KOTLIN_CLI_DOWNLOAD_ROOT=${downloadRoot}
`.replaceAll('\n', '\r\n');

describe('modules/manager/kotlin-toolchain-wrapper/utils', () => {
  describe('parseWrapper()', () => {
    it('parses the shell wrapper', () => {
      expect(parseWrapper(shWrapper)).toEqual({
        version: '0.12.0-dev-4139',
        versionLine: 'kotlin_cli_version=0.12.0-dev-4139',
        sha256,
        downloadRoot,
        form: 'shell',
      });
    });

    it('parses the batch wrapper', () => {
      expect(parseWrapper(batWrapper)).toEqual({
        version: '0.12.0-dev-4139',
        versionLine: 'set kotlin_cli_version=0.12.0-dev-4139',
        sha256,
        downloadRoot,
        form: 'batch',
      });
    });

    it('returns null without a version line', () => {
      const content = codeBlock`
        #!/bin/sh
        echo "not a Kotlin Toolchain wrapper"
      `;
      expect(parseWrapper(content)).toBeNull();
    });

    it('returns null for a version with unsupported characters', () => {
      expect(
        parseWrapper('kotlin_cli_version=$KOTLIN_CLI_VERSION\n'),
      ).toBeNull();
    });

    it('falls back to the default download root', () => {
      const content = codeBlock`
        kotlin_cli_version=0.12.0
        kotlin_cli_sha256=${sha256}
      `;
      expect(parseWrapper(content)).toEqual({
        version: '0.12.0',
        versionLine: 'kotlin_cli_version=0.12.0',
        sha256,
        downloadRoot: defaultDownloadRoot,
        form: 'shell',
      });
    });

    it('stops the download root at the end of the line', () => {
      const content = codeBlock`
        kotlin_cli_version=0.12.0
        KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${downloadRoot}
        echo "next line"
      `;

      expect(parseWrapper(content)?.downloadRoot).toBe(downloadRoot);
    });

    it('returns null checksum when it is missing', () => {
      expect(parseWrapper('kotlin_cli_version=0.12.0\n')).toEqual({
        version: '0.12.0',
        versionLine: 'kotlin_cli_version=0.12.0',
        sha256: null,
        downloadRoot: defaultDownloadRoot,
        form: 'shell',
      });
    });
  });

  describe('withDownloadRoot()', () => {
    const newRoot = 'https://maven.example.com/other';

    it('replaces the download root of the shell wrapper', () => {
      expect(withDownloadRoot(shWrapper, 'shell', newRoot)).toBe(
        shWrapper.replace(downloadRoot, newRoot),
      );
    });

    it('replaces the download root of the batch wrapper', () => {
      expect(withDownloadRoot(batWrapper, 'batch', newRoot)).toBe(
        batWrapper.replace(downloadRoot, newRoot),
      );
    });

    it('rewrites only the assignment of the real wrapper', () => {
      const fixture = Fixtures.get('kotlin');

      const res = withDownloadRoot(fixture, 'shell', newRoot);

      expect(res).toInclude(
        `KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${newRoot}}"`,
      );
      expect(res).toInclude(`default: ${defaultDownloadRoot}`);
      expect(res).not.toInclude(
        `KOTLIN_CLI_DOWNLOAD_ROOT="\${KOTLIN_CLI_DOWNLOAD_ROOT:-${defaultDownloadRoot}}"`,
      );
    });

    it('returns null without a download root line', () => {
      expect(
        withDownloadRoot('kotlin_cli_version=0.12.0\n', 'shell', newRoot),
      ).toBeNull();
    });

    it('returns null when only the other form declares the download root', () => {
      expect(withDownloadRoot(shWrapper, 'batch', newRoot)).toBeNull();
    });
  });
});
