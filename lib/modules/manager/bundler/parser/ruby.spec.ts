import { parseAsync } from '@ast-grep/napi';
import { loadRuby } from './common';
import { extractRubyVersion } from './ruby';

describe('modules/manager/bundler/parser/ruby', () => {
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
});
