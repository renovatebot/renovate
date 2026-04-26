import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const protoFilename = '.prototools';

const prototools1 = Fixtures.get('Prototools.1.toml');

describe('modules/manager/proto/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile('', protoFilename)).toBeNull();
    });

    it('returns null for invalid TOML', () => {
      expect(extractPackageFile('{{invalid', protoFilename)).toBeNull();
    });

    it('returns null when only config sections exist', () => {
      const content = codeBlock`
        [settings]
        auto-install = true

        [env]
        DEBUG = "*"
      `;
      expect(extractPackageFile(content, protoFilename)).toBeNull();
    });

    it('extracts a single tool version', () => {
      const content = codeBlock`
        node = "22.14.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'node',
            currentValue: '22.14.0',
            datasource: 'node-version',
            packageName: 'node',
          },
        ],
      });
    });

    it('extracts multiple tool versions', () => {
      const content = codeBlock`
        node = "22.14.0"
        bun = "1.2.2"
        npm = "11.6.2"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'node',
            currentValue: '22.14.0',
            datasource: 'node-version',
          },
          {
            depName: 'bun',
            currentValue: '1.2.2',
            datasource: 'github-releases',
            packageName: 'oven-sh/bun',
          },
          {
            depName: 'npm',
            currentValue: '11.6.2',
            datasource: 'npm',
            packageName: 'npm',
          },
        ],
      });
    });

    it('skips non-version sections', () => {
      const content = codeBlock`
        node = "22.14.0"

        [settings]
        auto-install = true

        [plugins.tools]
        my-tool = "https://example.com/plugin.toml"

        [tools.node]
        bundled-npm = true

        [env]
        DEBUG = "*"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'node',
            currentValue: '22.14.0',
            datasource: 'node-version',
          },
        ],
      });
      expect(result!.deps).toHaveLength(1);
    });

    it('handles proto self-versioning', () => {
      const content = codeBlock`
        proto = "0.56.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'proto',
            currentValue: '0.56.0',
            datasource: 'github-releases',
            packageName: 'moonrepo/proto',
          },
        ],
      });
    });

    it('handles moon tool', () => {
      const content = codeBlock`
        moon = "1.30.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'moon',
            currentValue: '1.30.0',
            datasource: 'github-releases',
            packageName: 'moonrepo/moon',
          },
        ],
      });
    });

    it('handles uv tool', () => {
      const content = codeBlock`
        uv = "0.6.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'uv',
            currentValue: '0.6.0',
            datasource: 'github-releases',
            packageName: 'astral-sh/uv',
          },
        ],
      });
    });

    it('marks unknown tools as unsupported-datasource', () => {
      const content = codeBlock`
        unknown-tool = "1.0.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'unknown-tool',
            currentValue: '1.0.0',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('skips alias values like latest', () => {
      const content = codeBlock`
        node = "latest"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'node',
            currentValue: 'latest',
            skipReason: 'unsupported-version',
          },
        ],
      });
    });

    it('skips alias value stable', () => {
      const content = codeBlock`
        rust = "stable"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'rust',
            currentValue: 'stable',
            skipReason: 'unsupported-version',
          },
        ],
      });
    });

    it('handles partial versions', () => {
      const content = codeBlock`
        go = "~1.22"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'go',
            currentValue: '~1.22',
            datasource: 'github-tags',
            packageName: 'golang/go',
          },
        ],
      });
    });

    it('extracts all supported tools from fixture', () => {
      const result = extractPackageFile(prototools1, protoFilename);
      expect(result).not.toBeNull();
      expect(result!.deps).toHaveLength(5);
      expect(result!.deps).toMatchObject([
        {
          depName: 'node',
          currentValue: '22.14.0',
          datasource: 'node-version',
        },
        {
          depName: 'bun',
          currentValue: '1.2.2',
          datasource: 'github-releases',
          packageName: 'oven-sh/bun',
        },
        {
          depName: 'npm',
          currentValue: '11.6.2',
          datasource: 'npm',
          packageName: 'npm',
        },
        {
          depName: 'go',
          currentValue: '~1.22',
          datasource: 'github-tags',
          packageName: 'golang/go',
        },
        {
          depName: 'proto',
          currentValue: '0.56.0',
          datasource: 'github-releases',
          packageName: 'moonrepo/proto',
        },
      ]);
    });

    it('extracts all supported built-in tools', () => {
      const content = codeBlock`
        bun = "1.2.2"
        deno = "2.0.0"
        go = "1.22.0"
        moon = "1.30.0"
        node = "22.14.0"
        npm = "11.6.2"
        pnpm = "9.0.0"
        yarn = "4.0.0"
        python = "3.12.0"
        ruby = "3.3.0"
        rust = "1.80.0"
        proto = "0.56.0"
        gh = "2.60.0"
        poetry = "1.8.0"
        uv = "0.6.0"
      `;
      const result = extractPackageFile(content, protoFilename);
      expect(result).not.toBeNull();
      expect(result!.deps).toHaveLength(15);
      // Verify no deps have skipReason
      for (const dep of result!.deps) {
        expect(dep.skipReason).toBeUndefined();
      }
    });
  });
});
