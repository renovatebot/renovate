import { parseAsync } from '@ast-grep/napi';
import { loadRuby } from './common';
import { gemDefPattern } from './gem';
import {
  aliasRubygemsSource,
  extractGlobalRegistries,
  extractParentBlockData,
} from './scope';

describe('modules/manager/bundler/parser/scope', () => {
  beforeAll(() => {
    loadRuby();
  });

  describe('aliasRubygemsSource', () => {
    it('converts rubygems to full URL', () => {
      const result = aliasRubygemsSource('rubygems');
      expect(result).toBe('https://rubygems.org');
    });

    it('passes through other URLs unchanged', () => {
      const input = 'https://example.com';
      const result = aliasRubygemsSource(input);
      expect(result).toBe(input);
    });

    it('passes through other strings unchanged', () => {
      const input = 'custom-source';
      const result = aliasRubygemsSource(input);
      expect(result).toBe(input);
    });
  });

  describe('extractGlobalRegistries', () => {
    it('parses gem-level source parameter', async () => {
      const content = 'source "https://example.com"';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://example.com']);
    });

    it('parses global source statement', async () => {
      const content = `
        source "https://rubygems.org"
        gem "rails"
      `;
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://rubygems.org']);
    });

    it('parses :rubygems in global source statement', async () => {
      const content = 'source :rubygems';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://rubygems.org']);
    });

    it('parses multiple source statements', async () => {
      const content = `
        source "https://rubygems.org"
        source "https://example.com"
        gem "rails"
      `;
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://example.com', 'https://rubygems.org']);
    });

    it('handles no source statements', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual([]);
    });

    it('resolves variables', async () => {
      const content = `
        registry_url = "https://example.com"
        source registry_url
        gem "rails"
      `;
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://example.com']);
    });

    it('ignores source blocks', async () => {
      const content = `
        source "https://rubygems.org"
        source "https://example.com" do
          gem "private-gem"
        end
        gem "rails"
      `;
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual(['https://rubygems.org']);
    });

    it('handles string interpolation in source', async () => {
      const content = 'source "https://#{domain}.com"';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual([]);
    });

    it('handles empty string source', async () => {
      const content = 'source ""';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual([]);
    });

    it('handles unresolved identifier', async () => {
      const content = 'source unknown_var';
      const ast = await parseAsync('ruby', content);
      const result = extractGlobalRegistries(ast.root());

      expect(result).toEqual([]);
    });
  });

  describe('extractParentBlockData', () => {
    it('handles single group with single gem', async () => {
      const content = `
        group :development do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual(['development']);
      expect(registryUrls).toEqual([]);
    });

    it('handles single group with multiple gems', async () => {
      const content = `
        group :development do
          gem "rails"
          gem "puma"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNodes = ast.root().findAll(gemDefPattern);

      for (const gemNode of gemNodes) {
        const [depTypes, registryUrls] = extractParentBlockData(gemNode);
        expect(depTypes).toEqual(['development']);
        expect(registryUrls).toEqual([]);
      }
    });

    it('handles multiple groups', async () => {
      const content = `
        group :development, :test do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual(['development', 'test']);
      expect(registryUrls).toEqual([]);
    });

    it('handles nested group blocks', async () => {
      const content = `
        group :development do
          group :test do
            gem "rails"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual(['development', 'test']);
      expect(registryUrls).toEqual([]);
    });

    it('handles many groups with multiple gems', async () => {
      const content = `
        group :development do
          gem "rails"
        end

        group :test do
          gem "rspec"
        end

        group :production do
          gem "puma"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNodes = ast.root().findAll(gemDefPattern);

      expect(gemNodes).toHaveLength(3);

      const railsNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('rails'),
      );
      const [railsDepTypes] = extractParentBlockData(railsNode!);
      expect(railsDepTypes).toEqual(['development']);

      const rspecNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('rspec'),
      );
      const [rspecDepTypes] = extractParentBlockData(rspecNode!);
      expect(rspecDepTypes).toEqual(['test']);

      const pumaNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('puma'),
      );
      const [pumaDepTypes] = extractParentBlockData(pumaNode!);
      expect(pumaDepTypes).toEqual(['production']);
    });

    it('handles source blocks', async () => {
      const content = `
        source "https://example.com" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual(['https://example.com']);
    });

    it('handles nested source blocks', async () => {
      const content = `
        source "https://rubygems.org" do
          source "https://example.com" do
            gem "rails"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual([
        'https://example.com',
        'https://rubygems.org',
      ]);
    });

    it('prioritizes inner sources', async () => {
      const content = `
        source "https://outer.com" do
          source "https://inner.com" do
            gem "rails"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual(['https://inner.com', 'https://outer.com']);
    });

    it('handles mixed group and source blocks', async () => {
      const content = `
        group :development do
          source "https://example.com" do
            gem "rails"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual(['development']);
      expect(registryUrls).toEqual(['https://example.com']);
    });

    it('handles rubygems source alias', async () => {
      const content = `
        source "rubygems" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual(['https://rubygems.org']);
    });

    it('handles gems outside of any groups', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual([]);
    });

    it('resolves variables in source blocks', async () => {
      const content = `
        registry_url = "https://example.com"
        source registry_url do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual([]);
      expect(registryUrls).toEqual(['https://example.com']);
    });

    it('handles complex nested structure', async () => {
      const content = `
        group :development do
          source "https://dev.com" do
            group :test do
              gem "rails"
            end
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const [depTypes, registryUrls] = extractParentBlockData(gemNode!);
      expect(depTypes).toEqual(['development', 'test']);
      expect(registryUrls).toEqual(['https://dev.com']);
    });
  });
});
