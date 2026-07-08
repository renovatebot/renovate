import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/gemspec/extract', () => {
  it('returns null when there are no dependencies', () => {
    expect(extractPackageFile('')).toBeNull();
    expect(
      extractPackageFile('Gem::Specification.new { |s| s.name = "x" }'),
    ).toBeNull();
  });

  it('extracts runtime, development and bare dependencies', () => {
    const content = codeBlock`
      Gem::Specification.new do |gem|
        gem.add_runtime_dependency "semantic_logger", "~> 4.11"
        gem.add_development_dependency 'pstore', '~> 0.1'
        gem.add_dependency "rack", "~> 3.0"
      end
    `;
    expect(extractPackageFile(content)).toEqual({
      deps: [
        {
          depName: 'semantic_logger',
          depType: 'runtime',
          datasource: 'rubygems',
          currentValue: '"~> 4.11"',
        },
        {
          depName: 'pstore',
          depType: 'development',
          datasource: 'rubygems',
          currentValue: "'~> 0.1'",
        },
        {
          depName: 'rack',
          depType: 'runtime',
          datasource: 'rubygems',
          currentValue: '"~> 3.0"',
        },
      ],
    });
  });

  it('captures multi-part restriction constraints in full', () => {
    const content =
      'spec.add_runtime_dependency "activesupport", "~> 4.2", "!= 4.2.5", ">= 4.2.1"';
    expect(extractPackageFile(content)?.deps[0]).toEqual({
      depName: 'activesupport',
      depType: 'runtime',
      datasource: 'rubygems',
      currentValue: '"~> 4.2", "!= 4.2.5", ">= 4.2.1"',
    });
  });

  it('handles parentheses and trailing comments', () => {
    const content = codeBlock`
      spec.add_dependency("graphql", "~> 1.9.19") # pinned intentionally
    `;
    expect(extractPackageFile(content)?.deps[0]).toEqual({
      depName: 'graphql',
      depType: 'runtime',
      datasource: 'rubygems',
      currentValue: '"~> 1.9.19"',
    });
  });

  it('skips dependencies without a literal version', () => {
    const content = codeBlock`
      spec.add_dependency "rake"
      spec.add_runtime_dependency "foo", Foo::VERSION
      spec.add_dependency "bar", "~> 1.0", Bar::VERSION
    `;
    expect(extractPackageFile(content)?.deps).toEqual([
      {
        depName: 'rake',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
      {
        depName: 'foo',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
    ]);
  });

  it('skips interpolated version strings', () => {
    const content = codeBlock`
      spec.add_dependency "foo", "~> #{Foo::VERSION}"
      spec.add_runtime_dependency 'bar', "= #{version}"
    `;
    expect(extractPackageFile(content)?.deps).toEqual([
      {
        depName: 'foo',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
    ]);
  });

  it('ignores commented-out dependency declarations', () => {
    const content = codeBlock`
      Gem::Specification.new do |spec|
        # spec.add_dependency "foo", "~> 1.0"
        spec.add_dependency "bar", "~> 2.0"
      end
    `;
    expect(extractPackageFile(content)?.deps).toEqual([
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 2.0"',
      },
    ]);
  });
});
