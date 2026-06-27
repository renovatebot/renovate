import { fs } from '~test/util.ts';
import {
  discoverRegistryUrls,
  parseRegistriesJson,
} from './registries-json.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/swift/registries-json', () => {
  describe('parseRegistriesJson', () => {
    it('returns empty for non-JSON input', () => {
      expect(parseRegistriesJson('not json')).toEqual({ named: {} });
    });

    it('returns empty for JSON that does not match the schema', () => {
      // version must be a number per the schema — passing a string forces
      // a zod safeParse failure.
      expect(
        parseRegistriesJson(JSON.stringify({ version: 'not-a-number' })),
      ).toEqual({ named: {} });
    });

    it('returns empty for unrecognized version', () => {
      const content = JSON.stringify({
        registries: { '[default]': { url: 'https://r.example.com' } },
        version: 99,
      });
      expect(parseRegistriesJson(content)).toEqual({ named: {} });
    });

    it('extracts the default registry', () => {
      const content = JSON.stringify({
        registries: { '[default]': { url: 'https://r.example.com' } },
        version: 1,
      });
      expect(parseRegistriesJson(content)).toEqual({
        defaultUrl: 'https://r.example.com',
        named: {},
      });
    });

    it('extracts named registries', () => {
      const content = JSON.stringify({
        registries: {
          internal: { url: 'https://internal.example.org' },
          public: { url: 'https://public.example.com' },
        },
        version: 1,
      });
      expect(parseRegistriesJson(content)).toEqual({
        named: {
          internal: 'https://internal.example.org',
          public: 'https://public.example.com',
        },
      });
    });

    it('returns empty when the registries field is omitted', () => {
      expect(parseRegistriesJson(JSON.stringify({ version: 1 }))).toEqual({
        named: {},
      });
    });

    it('extracts default + named together', () => {
      const content = JSON.stringify({
        registries: {
          '[default]': { url: 'https://r.example.com' },
          mirror: { url: 'https://mirror.example.com' },
        },
        version: 1,
      });
      expect(parseRegistriesJson(content)).toEqual({
        defaultUrl: 'https://r.example.com',
        named: { mirror: 'https://mirror.example.com' },
      });
    });
  });

  describe('discoverRegistryUrls', () => {
    it('returns an empty list when no registries.json file exists', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const urls = await discoverRegistryUrls('Package.swift');
      expect(urls).toEqual([]);
      expect(fs.readLocalFile).toHaveBeenCalledWith(
        '.swiftpm/configuration/registries.json',
        'utf8',
      );
    });

    it('emits the default URL first, then named registries sorted by key', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          registries: {
            zeta: { url: 'https://zeta.example.com' },
            '[default]': { url: 'https://default.example.com' },
            alpha: { url: 'https://alpha.example.com' },
          },
          version: 1,
        }),
      );

      const urls = await discoverRegistryUrls('Package.swift');
      expect(urls).toEqual([
        'https://default.example.com',
        'https://alpha.example.com',
        'https://zeta.example.com',
      ]);
    });

    it('deduplicates URLs that appear under multiple keys', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          registries: {
            '[default]': { url: 'https://r.example.com' },
            mirror: { url: 'https://r.example.com' },
          },
          version: 1,
        }),
      );

      const urls = await discoverRegistryUrls('Package.swift');
      expect(urls).toEqual(['https://r.example.com']);
    });

    it('looks beside the Package.swift in nested directories', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          registries: { '[default]': { url: 'https://r.example.com' } },
          version: 1,
        }),
      );

      const urls = await discoverRegistryUrls('SubPackage/Package.swift');
      expect(urls).toEqual(['https://r.example.com']);
      expect(fs.readLocalFile).toHaveBeenCalledWith(
        'SubPackage/.swiftpm/configuration/registries.json',
        'utf8',
      );
    });
  });
});
