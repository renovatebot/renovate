import { parseAsync } from '@ast-grep/napi';
import { loadRuby } from './common';
import { extractRubyVersion } from './ruby-version';

describe('modules/manager/bundler/parser/ruby-version', () => {
  beforeAll(() => {
    loadRuby();
  });

  it('extracts simple ruby version', async () => {
    const content = 'ruby "2.7.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '2.7.0',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles empty ruby version', async () => {
    const content = 'ruby ""';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '',
      skipReason: 'empty',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles ruby version with interpolation', async () => {
    const content = 'ruby "#{RUBY_VERSION}"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '#{RUBY_VERSION}',
      skipReason: 'version-placeholder',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles ruby version with multiple parts', async () => {
    const content = 'ruby "2.7.#{patch_version}"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '2.7.#{patch_version}',
      skipReason: 'version-placeholder',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles missing version', async () => {
    const content = 'gem "rails"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toBeNull();
  });

  it('handles ruby version with symbol', async () => {
    const content = 'ruby :latest';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: ':latest',
      skipReason: 'not-a-version',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('extracts ruby version with single quotes', async () => {
    const content = "ruby '2.7.0'";
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '2.7.0',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('extracts ruby version with double quotes', async () => {
    const content = 'ruby "2.7.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '2.7.0',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles unsupported ruby version format', async () => {
    const content = 'ruby "\\n"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '"\\n"',
      skipReason: 'unsupported-version',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('extracts double version range', async () => {
    const content = 'ruby ">= 2.0.0", "< 3.0.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: expect.stringContaining('>= 2.0.0'),
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('extracts double version range with different operators', async () => {
    const content = 'ruby ">= 2.7", "< 4.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: expect.stringContaining('>= 2.7'),
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('extracts double version range with precise versions', async () => {
    const content = 'ruby ">= 2.7.2", "< 3.1.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: expect.stringContaining('>= 2.7.2'),
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('does not extract double version range when first argument does not start with >', async () => {
    const content = 'ruby "2.7.0", "< 3.0.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '"2.7.0", "< 3.0.0"',
      managerData: { lineNumber: expect.any(Number) },
    });
  });

  it('handles single version when only one argument provided', async () => {
    const content = 'ruby ">= 2.7.0"';
    const ast = await parseAsync('ruby', content);
    const result = extractRubyVersion(ast.root());

    expect(result).toEqual({
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: '>= 2.7.0',
      managerData: { lineNumber: expect.any(Number) },
    });
  });
});
