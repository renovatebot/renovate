import { parseAsync } from '@ast-grep/napi';
import * as astGrep from '../../../../util/ast-grep';
import { loadRuby } from './common';
import { extractDepNameData, extractVersionData, gemDefPattern } from './gem';

const callPattern = astGrep.rule`
  rule:
    kind: call
`;

describe('modules/manager/bundler/parser/gem', () => {
  beforeAll(() => {
    loadRuby();
  });

  describe('gemDefPattern', () => {
    it('matches simple gem instruction', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const matches = ast.root().findAll(gemDefPattern);

      expect(matches).toHaveLength(1);
    });

    it('matches gem with symbol name', async () => {
      const content = 'gem :rails';
      const ast = await parseAsync('ruby', content);
      const matches = ast.root().findAll(gemDefPattern);

      expect(matches).toHaveLength(1);
    });

    it('does not match non-gem calls', async () => {
      const content = 'source "https://rubygems.org"';
      const ast = await parseAsync('ruby', content);
      const matches = ast.root().findAll(gemDefPattern);

      expect(matches).toHaveLength(0);
    });
  });

  describe('extractDepNameData', () => {
    it('parses simplest gem instruction', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractDepNameData(gemNode!);
      expect(result).toEqual({
        depName: 'rails',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles gem with symbol name', async () => {
      const content = 'gem :rails';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractDepNameData(gemNode!);
      expect(result).toEqual({
        depName: 'rails',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles missing dep name', async () => {
      const content = 'gem';
      const ast = await parseAsync('ruby', content);
      const callNode = ast.root().find(callPattern);

      if (callNode) {
        const result = extractDepNameData(callNode);
        expect(result).toEqual({
          skipReason: 'missing-depname',
        });
      }
    });

    it('handles invalid string name with interpolation', async () => {
      const content = 'gem "rails-#{version}"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractDepNameData(gemNode!);
      expect(result).toEqual({
        depName: 'rails-#{version}',
        skipReason: 'invalid-name',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles empty string name', async () => {
      const content = 'gem ""';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractDepNameData(gemNode!);
      expect(result).toEqual({
        depName: '',
        skipReason: 'invalid-name',
        managerData: { lineNumber: expect.any(Number) },
      });
    });
  });

  describe('extractVersionData', () => {
    it('handles gem without version', async () => {
      const content = 'gem "rails"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        skipReason: 'unspecified-version',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('extracts simple version string', async () => {
      const content = 'gem "rails", "~> 7.0"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '~> 7.0',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('extracts version with float', async () => {
      const content = 'gem "rails", 7.0';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '7.0',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('extracts version with integer', async () => {
      const content = 'gem "rails", 7';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '7',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles empty version string', async () => {
      const content = 'gem "rails", ""';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '',
        skipReason: 'empty',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles version with interpolation', async () => {
      const content = 'gem "rails", "#{RAILS_VERSION}"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '#{RAILS_VERSION}',
        skipReason: 'version-placeholder',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('handles version with multiple string parts', async () => {
      const content = 'gem "rails", "~> #{version}"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: '~> #{version}',
        skipReason: 'version-placeholder',
        managerData: { lineNumber: expect.any(Number) },
      });
    });

    it('extracts weird version', async () => {
      const content = 'gem "rails", ">= 6.0", "< 8.0"';
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const result = extractVersionData(gemNode!);
      expect(result).toEqual({
        currentValue: expect.stringContaining('>= 6.0'),
        managerData: { lineNumber: expect.any(Number) },
      });
    });
  });

  describe('multiline gem instructions', () => {
    it('handles multiline gem instructions', async () => {
      const content = `gem "rails",
        "~> 7.0"`;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const depNameData = extractDepNameData(gemNode!);
      const versionData = extractVersionData(gemNode!);

      expect(depNameData.depName).toBe('rails');
      expect(versionData.currentValue).toBe('~> 7.0');
    });

    it('handles gem with multiple options', async () => {
      const content = `gem "rails",
        "~> 7.0",
        group: :development`;
      const ast = await parseAsync('ruby', content);
      const gemNode = ast.root().find(gemDefPattern);

      const depNameData = extractDepNameData(gemNode!);
      const versionData = extractVersionData(gemNode!);

      expect(depNameData.depName).toBe('rails');
      expect(versionData.currentValue).toBe('~> 7.0');
    });
  });
});
