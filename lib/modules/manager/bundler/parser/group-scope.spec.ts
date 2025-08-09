import { parseAsync } from '@ast-grep/napi';
import { loadRuby } from './common';
import { gemDefPattern } from './gem';
import { extractScopedGroups } from './group-scope';

describe('modules/manager/bundler/parser/group-scope', () => {
  beforeAll(() => {
    loadRuby();
  });

  describe('extractScopedGroups', () => {
    it('handles single group with single gem', async () => {
      const content = `
        group :development do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development']);
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
        const result = extractScopedGroups(gemNode);
        expect(result).toEqual(['development']);
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

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'test']);
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

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'test']);
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
      const railsResult = extractScopedGroups(railsNode!);
      expect(railsResult).toEqual(['development']);

      const rspecNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('rspec'),
      );
      const rspecResult = extractScopedGroups(rspecNode!);
      expect(rspecResult).toEqual(['test']);

      const pumaNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('puma'),
      );
      const pumaResult = extractScopedGroups(pumaNode!);
      expect(pumaResult).toEqual(['production']);
    });

    it('handles gems outside of any groups', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual([]);
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

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development']);
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

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'test']);
    });

    it('handles string groups', async () => {
      const content = `
        group "development" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development']);
    });

    it('handles mixed symbol and string groups', async () => {
      const content = `
        group :development, "test" do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'test']);
    });

    it('filters out null values from group names', async () => {
      const content = `
        group :development, nil do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development']);
    });

    it('handles groups inside platforms blocks', async () => {
      const content = `
        platforms :ruby, :mswin do
          group :db do
            gem "pg", ">= 0.18.0"
            gem "mysql2", ">= 0.4.10"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNodes = ast.root().findAll(gemDefPattern);

      expect(gemNodes).toHaveLength(2);

      const pgNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('pg'),
      );
      const pgResult = extractScopedGroups(pgNode!);
      expect(pgResult).toEqual(['db']);

      const mysqlNode = gemNodes.find((node) =>
        node.getMatch('DEP_NAME')?.text().includes('mysql2'),
      );
      const mysqlResult = extractScopedGroups(mysqlNode!);
      expect(mysqlResult).toEqual(['db']);
    });

    it('handles optional groups', async () => {
      const content = `
        group :development, optional: true do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'optional']);
    });

    it('handles optional groups with false value', async () => {
      const content = `
        group :development, optional: false do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development']);
    });

    it('handles simple optional without group', async () => {
      const content = `
        group optional: true do
          gem "rails"
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toBeEmpty();
    });

    it('handles nested optional groups', async () => {
      const content = `
        group :development do
          group :test, optional: true do
            gem "rails"
          end
        end
      `;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractScopedGroups(gemNode!);
      expect(result).toEqual(['development', 'test', 'optional']);
    });
  });
});
