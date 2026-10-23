import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/dprint/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts versioned npm plugins', () => {
      const dprintJson = codeBlock`
        {
          "plugins": [
            "npm:@dprint/typescript@0.96.1",
            "npm:dprint-plugin-malva@0.16.0",
            "npm:@dprint/example@1.0.0/json/plugin.wasm"
          ]
        }
      `;
      expect(extractPackageFile(dprintJson, 'dprint.json')).toEqual({
        deps: [
          {
            depName: '@dprint/typescript',
            datasource: 'npm',
            currentValue: '0.96.1',
            depType: 'plugin',
          },
          {
            depName: 'dprint-plugin-malva',
            datasource: 'npm',
            currentValue: '0.16.0',
            depType: 'plugin',
          },
          {
            depName: '@dprint/example',
            datasource: 'npm',
            currentValue: '1.0.0',
            depType: 'plugin',
          },
        ],
      });
    });

    it('skips plugins with a tarball checksum', () => {
      const dprintJson = codeBlock`
        {
          "plugins": [
            "npm:@dprint/prettier@0.50.0/plugin.json@704701df449dd7e942a71144773778ac529d68c2e4657bfc236d393b898b9a67"
          ]
        }
      `;
      expect(extractPackageFile(dprintJson, 'dprint.json')).toEqual({
        deps: [
          {
            depName: '@dprint/prettier',
            datasource: 'npm',
            currentValue: '0.50.0',
            depType: 'plugin',
            skipReason: 'unsupported',
          },
        ],
      });
    });

    it('skips unversioned plugins', () => {
      const dprintJson = codeBlock`
        {
          "plugins": ["npm:@dprint/json"]
        }
      `;
      expect(extractPackageFile(dprintJson, 'dprint.json')).toEqual({
        deps: [
          {
            depName: '@dprint/json',
            depType: 'plugin',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('ignores URL-based plugins', () => {
      const dprintJson = codeBlock`
        {
          "plugins": ["https://plugins.dprint.dev/typescript-0.91.1.wasm"]
        }
      `;
      expect(extractPackageFile(dprintJson, 'dprint.json')).toBeNull();
    });

    it('handles mixed plugin forms', () => {
      const dprintJson = codeBlock`
        {
          "plugins": [
            "https://plugins.dprint.dev/json-0.19.4.wasm",
            "npm:@dprint/typescript@0.96.1",
            "npm:@dprint/prettier@0.50.0/plugin.json@704701df449dd7e942a71144773778ac529d68c2e4657bfc236d393b898b9a67",
            "npm:@dprint/json"
          ]
        }
      `;
      expect(extractPackageFile(dprintJson, 'dprint.json')).toEqual({
        deps: [
          {
            depName: '@dprint/typescript',
            datasource: 'npm',
            currentValue: '0.96.1',
            depType: 'plugin',
          },
          {
            depName: '@dprint/prettier',
            datasource: 'npm',
            currentValue: '0.50.0',
            depType: 'plugin',
            skipReason: 'unsupported',
          },
          {
            depName: '@dprint/json',
            depType: 'plugin',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('supports jsonc comments', () => {
      const dprintJsonc = codeBlock`
        {
          // comment
          "plugins": [
            "npm:@dprint/json@0.23.0", // trailing comment
          ],
        }
      `;
      expect(extractPackageFile(dprintJsonc, 'dprint.jsonc')).toEqual({
        deps: [
          {
            depName: '@dprint/json',
            datasource: 'npm',
            currentValue: '0.23.0',
            depType: 'plugin',
          },
        ],
      });
    });

    it('returns null for invalid json', () => {
      expect(extractPackageFile('{ "plugins": [', 'dprint.json')).toBeNull();
    });

    it('returns null for unparseable npm specifiers', () => {
      expect(
        extractPackageFile(
          '{ "plugins": ["npm:foo@1.0.0/plugin.json@sha256-abc"] }',
          'dprint.json',
        ),
      ).toBeNull();
    });

    it('returns null if there are no plugins', () => {
      expect(
        extractPackageFile('{ "lineWidth": 120 }', 'dprint.json'),
      ).toBeNull();
      expect(extractPackageFile('{ "plugins": [] }', 'dprint.json')).toBeNull();
    });
  });
});
