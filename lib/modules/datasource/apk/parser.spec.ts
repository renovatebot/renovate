import { vi } from 'vitest';
import { logger } from '../../../logger';
import { parseApkIndex } from './parser';

describe('modules/datasource/apk/parser', () => {
  describe('parseApkIndex', () => {
    it('should parse valid APK index content', () => {
      const indexContent = `P:bash
V:5.2.15-r0
U:https://alpinelinux.org/packages/bash
t:1700000000

P:nginx
V:1.24.0-r0
U:https://alpinelinux.org/packages/nginx
t:1700000001`;

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
      const indexContent = `P:bash
V:5.2.15-r0
U:https://alpinelinux.org/packages/bash
t:1700000000

This line has no colon
Another line without colon

P:nginx
V:1.24.0-r0`;

      const result = parseApkIndex(indexContent);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('bash');
      expect(result[1].name).toBe('nginx');
    });

    it('should skip packages missing required fields', () => {
      const loggerWarnSpy = vi
        .spyOn(logger, 'warn')
        .mockImplementation(() => {});

      const indexContent = `P:bash
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
t:1700000001`;

      const result = parseApkIndex(indexContent);

      // Should have 3 packages: bash, another-incomplete (valid), and nginx
      // incomplete-package should be skipped (missing version)
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('bash');
      expect(result[1].name).toBe('another-incomplete');
      expect(result[2].name).toBe('nginx');

      // Should have warned about incomplete package (missing version)
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          packageInfo: expect.objectContaining({
            name: 'incomplete-package',
            url: 'https://alpinelinux.org/packages/incomplete',
            buildDate: 1700000000,
          }),
        }),
        'Skipping package entry due to missing required fields',
      );

      loggerWarnSpy.mockRestore();
    });

    it('should handle parsing errors gracefully', () => {
      const loggerWarnSpy = vi
        .spyOn(logger, 'warn')
        .mockImplementation(() => {});

      // Mock an error by providing invalid content that would cause parsing to fail
      const indexContent = null as any;

      const result = parseApkIndex(indexContent);

      expect(result).toEqual([]);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
        }),
        'Error parsing APK index',
      );

      loggerWarnSpy.mockRestore();
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
      const indexContent = `P:minimal-package
V:1.0.0

P:another-minimal
V:2.0.0`;

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
      const indexContent = `t:1700000000
U:https://alpinelinux.org/packages/bash
V:5.2.15-r0
P:bash

P:nginx
t:1700000001
V:1.24.0-r0
U:https://alpinelinux.org/packages/nginx`;

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
});
