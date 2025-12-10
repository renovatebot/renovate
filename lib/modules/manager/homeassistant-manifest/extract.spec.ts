import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

const manifestFile = 'custom_components/example/manifest.json';

describe('modules/manager/homeassistant-manifest/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid JSON', () => {
      const result = extractPackageFile('not valid json', manifestFile);
      expect(result).toBeNull();
    });

    it('returns null for non-Home Assistant manifest (missing domain)', () => {
      const content = JSON.stringify({
        name: 'My Extension',
        version: '1.0.0',
        requirements: ['some-package==1.0.0'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('returns null for non-Home Assistant manifest (missing name)', () => {
      const content = JSON.stringify({
        domain: 'test',
        version: '1.0.0',
        requirements: ['some-package==1.0.0'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('returns null for chrome extension manifest', () => {
      const content = JSON.stringify({
        manifest_version: 3,
        name: 'My Extension',
        version: '1.0.0',
        permissions: ['storage'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('returns null for empty requirements', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test Integration',
        requirements: [],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('returns null when no requirements field', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test Integration',
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('extracts single requirement with exact version', () => {
      const content = JSON.stringify({
        domain: 'hue',
        name: 'Philips Hue',
        requirements: ['aiohue==1.9.1'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
        ],
      });
    });

    it('extracts multiple requirements', () => {
      const content = JSON.stringify({
        domain: 'hue',
        name: 'Philips Hue',
        requirements: ['aiohue==1.9.1', 'aiohttp==3.8.1', 'pyyaml==6.0'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
          {
            datasource: 'pypi',
            depName: 'aiohttp',
            packageName: 'aiohttp',
            currentValue: '==3.8.1',
            currentVersion: '3.8.1',
          },
          {
            datasource: 'pypi',
            depName: 'pyyaml',
            packageName: 'pyyaml',
            currentValue: '==6.0',
            currentVersion: '6.0',
          },
        ],
      });
    });

    it('handles requirements with extras', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: ['package[extra1,extra2]==1.0.0'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'package',
            packageName: 'package',
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
          },
        ],
      });
    });

    it('extracts git+https requirements', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: [
          'pycoolmaster@git+https://github.com/issacg/pycoolmaster.git@except_connect',
          'aiohue==1.9.1',
        ],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'git-tags',
            depName: 'pycoolmaster',
            packageName: 'https://github.com/issacg/pycoolmaster.git',
            currentValue: 'except_connect',
            currentVersion: 'except_connect',
          },
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
        ],
      });
    });

    it('supports requirements with other operators', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: [
          'package>=1.0.0',
          'another<=2.0.0',
          'exact==1.5.0',
          'tilde~=1.2.3',
        ],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'package',
            packageName: 'package',
            currentValue: '>=1.0.0',
          },
          {
            datasource: 'pypi',
            depName: 'another',
            packageName: 'another',
            currentValue: '<=2.0.0',
          },
          {
            datasource: 'pypi',
            depName: 'exact',
            packageName: 'exact',
            currentValue: '==1.5.0',
            currentVersion: '1.5.0',
          },
          {
            datasource: 'pypi',
            depName: 'tilde',
            packageName: 'tilde',
            currentValue: '~=1.2.3',
          },
        ],
      });
    });

    it('handles requirements without version', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: ['package', 'aiohue==1.9.1'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'package',
            packageName: 'package',
          },
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
        ],
      });
    });

    it('extracts from real-world ASUSWRT manifest', () => {
      const content = codeBlock`
        {
          "domain": "asuswrt",
          "name": "ASUSWRT",
          "codeowners": ["@kennedyshead", "@ollo69", "@Vaskivskyi"],
          "config_flow": true,
          "documentation": "https://www.home-assistant.io/integrations/asuswrt",
          "integration_type": "hub",
          "iot_class": "local_polling",
          "loggers": ["aioasuswrt", "asusrouter", "asyncssh"],
          "requirements": ["aioasuswrt==1.5.1", "asusrouter==1.21.3"]
        }
      `;
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'aioasuswrt',
            packageName: 'aioasuswrt',
            currentValue: '==1.5.1',
            currentVersion: '1.5.1',
          },
          {
            datasource: 'pypi',
            depName: 'asusrouter',
            packageName: 'asusrouter',
            currentValue: '==1.21.3',
            currentVersion: '1.21.3',
          },
        ],
      });
    });

    it('handles invalid requirement types in array', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: ['aiohue==1.9.1', 123, null, 'valid==2.0.0'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
          {
            datasource: 'pypi',
            depName: 'valid',
            packageName: 'valid',
            currentValue: '==2.0.0',
            currentVersion: '2.0.0',
          },
        ],
      });
    });

    it('returns null when requirements is not an array', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: 'not-an-array',
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toBeNull();
    });

    it('handles unparseable requirement strings with skipReason', () => {
      const content = JSON.stringify({
        domain: 'test',
        name: 'Test',
        requirements: ['!!!invalid!!!', 'aiohue==1.9.1'],
      });
      const result = extractPackageFile(content, manifestFile);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: '!!!invalid!!!',
            skipReason: 'invalid-dependency-specification',
          },
          {
            datasource: 'pypi',
            depName: 'aiohue',
            packageName: 'aiohue',
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
          },
        ],
      });
    });
  });
});
