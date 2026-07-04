import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractPackageFile } from './index.ts';
import { protoTooling } from './upgradeable-tooling.ts';

vi.mock('../../../util/fs/index.ts');

const protoFilename = '.prototools';

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
      const content = codeBlock`
        node = "22.14.0"
        bun = "1.2.2"
        npm = "11.6.2"
        go = "~1.22"
        proto = "0.56.0"

        [settings]
        auto-install = true
        detect-strategy = "prefer-prototools"

        [plugins.tools]
        my-tool = "https://raw.githubusercontent.com/my/tool/master/proto-plugin.toml"

        [tools.node]
        bundled-npm = true

        [env]
        DEBUG = "*"
      `;
      const result = extractPackageFile(content, protoFilename);
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

    it('maps every built-in tool to its datasource', () => {
      const content = Object.keys(protoTooling)
        .map((tool) => `${tool} = "1.0.0"`)
        .join('\n');
      const result = extractPackageFile(content, protoFilename);

      const mapped = Object.fromEntries(
        result!.deps.map((dep) => [dep.depName, dep.datasource]),
      );
      const expected = Object.fromEntries(
        Object.entries(protoTooling).map(([tool, def]) => [
          tool,
          def.config.datasource,
        ]),
      );
      expect(mapped).toEqual(expected);
      expect(result!.deps.every((dep) => !dep.skipReason)).toBe(true);
    });
  });

  describe('custom plugin tools', () => {
    it('points a remote plugin tool at the proto-plugin datasource', () => {
      const content = codeBlock`
        buf = "1.71.0"
        moon = "1.30.0"

        [plugins.tools]
        buf = "https://raw.githubusercontent.com/acme/proto-plugins/main/buf/plugin.toml"
      `;

      const result = extractPackageFile(content, protoFilename);
      expect(result!.deps).toEqual([
        {
          depName: 'buf',
          currentValue: '1.71.0',
          datasource: 'proto-plugin',
          packageName:
            'https://raw.githubusercontent.com/acme/proto-plugins/main/buf/plugin.toml',
          extractVersion: '^v?(?<version>.+)',
        },
        {
          depName: 'moon',
          currentValue: '1.30.0',
          datasource: 'github-releases',
          packageName: 'moonrepo/moon',
          extractVersion: '^v(?<version>\\S+)',
        },
      ]);
    });

    it('resolves a file plugin locator to a repository-relative path', () => {
      fs.getSiblingFileName.mockReturnValue('sub/.proto/plugins/direnv.toml');
      const content = codeBlock`
        direnv = "2.37.1"

        [plugins]
        direnv = "file://./.proto/plugins/direnv.toml"
      `;

      const result = extractPackageFile(content, 'sub/.prototools');
      expect(fs.getSiblingFileName).toHaveBeenCalledWith(
        'sub/.prototools',
        './.proto/plugins/direnv.toml',
      );
      expect(result!.deps).toEqual([
        {
          depName: 'direnv',
          currentValue: '2.37.1',
          datasource: 'proto-plugin',
          packageName: 'sub/.proto/plugins/direnv.toml',
          extractVersion: '^v?(?<version>.+)',
        },
      ]);
    });

    it('prefers the built-in datasource over a plugin locator', () => {
      const content = codeBlock`
        moon = "1.30.0"

        [plugins.tools]
        moon = "https://example.com/moon.toml"
      `;

      const result = extractPackageFile(content, protoFilename);
      expect(result!.deps).toMatchObject([
        { depName: 'moon', datasource: 'github-releases' },
      ]);
    });

    it('skips a wasm plugin locator', () => {
      const content = codeBlock`
        my-tool = "1.0.0"

        [plugins.tools]
        my-tool = "https://example.com/plugin.wasm"
      `;

      const result = extractPackageFile(content, protoFilename);
      expect(result!.deps).toMatchObject([
        { depName: 'my-tool', skipReason: 'unsupported-datasource' },
      ]);
    });

    it('skips an unsupported (github://) plugin locator', () => {
      const content = codeBlock`
        my-tool = "1.0.0"

        [plugins.tools]
        my-tool = "github://moonrepo/tools"
      `;

      const result = extractPackageFile(content, protoFilename);
      expect(result!.deps).toMatchObject([
        { depName: 'my-tool', skipReason: 'unsupported-datasource' },
      ]);
    });

    it('skips a non-built-in tool with no plugin locator', () => {
      const content = codeBlock`
        unknown-tool = "1.0.0"
      `;

      const result = extractPackageFile(content, protoFilename);
      expect(result!.deps).toMatchObject([
        { depName: 'unknown-tool', skipReason: 'unsupported-datasource' },
      ]);
    });
  });
});
