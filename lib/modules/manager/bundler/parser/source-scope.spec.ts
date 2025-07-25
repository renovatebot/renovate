import { parseAsync } from '@ast-grep/napi';
import { loadRuby } from './common';
import { gemDefPattern } from './gem';
import {
  aliasRubygemsSource,
  extractGlobalRegistries,
  extractScopedSources,
} from './source-scope';

describe('modules/manager/bundler/parser/source-scope', () => {
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

  describe('extractScopedSources', () => {
    it('handles source blocks', async () => {
      const content = `
        source "https://example.com" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://example.com']);
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

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://example.com', 'https://rubygems.org']);
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

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://inner.com', 'https://outer.com']);
    });

    it('handles rubygems source alias', async () => {
      const content = `
        source "rubygems" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://rubygems.org']);
    });

    it('handles gems outside of any source blocks', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual([]);
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

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://example.com']);
    });

    it('handles multiple source blocks', async () => {
      const content = `
        source "https://first.com" do
          gem "first-gem"
        end
        source "https://second.com" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNodes = ast.root().findAll(gemDefPattern);
      const railsNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('rails'),
      );

      const result = extractScopedSources(railsNode!);
      expect(result).toEqual(['https://second.com']);
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

      const result = extractScopedSources(gemNode!);
      expect(result).toEqual(['https://example.com']);
    });
  });
});
