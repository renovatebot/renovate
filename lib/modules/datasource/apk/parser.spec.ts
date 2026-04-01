import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import { GlobalConfig } from '../../../config/global.ts';
import * as memFs from '../../../util/fs/index.ts';
import { parseApkIndex, parseApkIndexFile } from './parser.ts';

describe('modules/datasource/apk/parser', () => {
  describe('parseApkIndex', () => {
    it('should parse valid APK index content', () => {
      const indexContent = codeBlock`
        P:bash
        V:5.2.15-r0
        U:https://alpinelinux.org/packages/bash
        t:1700000000

        P:nginx
        V:1.24.0-r0
        U:https://alpinelinux.org/packages/nginx
        t:1700000001
      `;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'bash',
        version: '5.2.15-r0',
        url: 'https://alpinelinux.org/packages/bash',
        buildDate: 1700000000,
      });
      expect(result[1]).toEqual({
        name: 'nginx',
        version: '1.24.0-r0',
        url: 'https://alpinelinux.org/packages/nginx',
        buildDate: 1700000001,
      });
    });

    it('should handle lines without colons', () => {
      const indexContent = codeBlock`
        P:bash
        V:5.2.15-r0
        U:https://alpinelinux.org/packages/bash
        t:1700000000

        This line has no colon
        Another line without colon

        P:nginx
        V:1.24.0-r0
      `;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('bash');
      expect(result[1].name).toBe('nginx');
    });

    it('should skip packages missing required fields', () => {
      const indexContent = codeBlock`
        P:bash
        V:5.2.15-r0
        U:https://alpinelinux.org/packages/bash
        t:1700000000

        P:incomplete-package
        U:https://alpinelinux.org/packages/incomplete
        t:1700000000

        P:another-incomplete
        V:1.0.0

        P:nginx
        V:1.24.0-r0
        U:https://alpinelinux.org/packages/nginx
        t:1700000001
      `;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('bash');
      expect(result[1].name).toBe('another-incomplete');
      expect(result[2].name).toBe('nginx');
    });

    it('should handle parsing errors gracefully', () => {
      const indexContent = null as any;

      const result = parseApkIndex(indexContent);

      expect(result).toEqual([]);
    });

    it('should handle empty content', () => {
      const result = parseApkIndex('');

      expect(result).toEqual([]);
    });

    it('should handle content with only whitespace', () => {
      const result = parseApkIndex('   \n\n  \t  \n  ');

      expect(result).toEqual([]);
    });

    it('should handle packages with only name and version', () => {
      const indexContent = codeBlock`
        P:minimal-package
        V:1.0.0

        P:another-minimal
        V:2.0.0
      `;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'minimal-package',
        version: '1.0.0',
      });
      expect(result[1]).toEqual({
        name: 'another-minimal',
        version: '2.0.0',
      });
    });

    it('should handle packages with different field orders', () => {
      const indexContent = codeBlock`
        t:1700000000
        U:https://alpinelinux.org/packages/bash
        V:5.2.15-r0
        P:bash

        P:nginx
        t:1700000001
        V:1.24.0-r0
        U:https://alpinelinux.org/packages/nginx
      `;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'bash',
        version: '5.2.15-r0',
        url: 'https://alpinelinux.org/packages/bash',
        buildDate: 1700000000,
      });
      expect(result[1]).toEqual({
        name: 'nginx',
        version: '1.24.0-r0',
        url: 'https://alpinelinux.org/packages/nginx',
        buildDate: 1700000001,
      });
    });
  });

  describe('parseApkIndexFile', () => {
    let cacheDir: DirectoryResult | null;

    beforeEach(async () => {
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      await cacheDir?.cleanup();
      cacheDir = null;
    });

    it('should match parseApkIndex for the same content', async () => {
      const indexContent = codeBlock`
        P:bash
        V:5.2.15-r0
        U:https://alpinelinux.org/packages/bash
        t:1700000000

        P:nginx
        V:1.24.0-r0
      `;

      await memFs.outputCacheFile('APKINDEX', indexContent);

      const fromFile = await parseApkIndexFile('APKINDEX');
      const fromString = parseApkIndex(indexContent);

      expect(fromFile).toEqual(fromString);
    });

    it('should not push when a blank line ends an incomplete package', async () => {
      const indexContent = codeBlock`
        P:only-name
        U:https://example.test/pkg

        P:ok
        V:1.0.0
      `;

      await memFs.outputCacheFile('APKINDEX', indexContent);

      const result = await parseApkIndexFile('APKINDEX');

      expect(result).toEqual([{ name: 'ok', version: '1.0.0' }]);
    });

    it('should not push trailing empty record when file ends with extra blank lines', async () => {
      const indexContent = 'P:a\nV:1\n\n\n';

      await memFs.outputCacheFile('APKINDEX', indexContent);

      const result = await parseApkIndexFile('APKINDEX');

      expect(result).toEqual([{ name: 'a', version: '1' }]);
    });
  });
});
