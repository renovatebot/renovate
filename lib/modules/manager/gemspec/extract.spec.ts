import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/gemspec/extract', () => {
  it('returns null when there are no dependencies', async () => {
    await expect(extractPackageFile('')).resolves.toBeNull();
    await expect(
      extractPackageFile('Gem::Specification.new { |s| s.name = "x" }'),
    ).resolves.toBeNull();
  });

  it('extracts runtime, development and bare dependencies', async () => {
    const content = codeBlock`
      Gem::Specification.new do |gem|
        gem.add_runtime_dependency "semantic_logger", "~> 4.11"
        gem.add_development_dependency 'pstore', '~> 0.1'
        gem.add_dependency "rack", "~> 3.0"
      end
    `;

    const res = await extractPackageFile(content);

    expect(res).toEqual({
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

  it('captures multi-part restriction constraints in full', async () => {
    const content =
      'spec.add_runtime_dependency "activesupport", "~> 4.2", "!= 4.2.5", ">= 4.2.1"';

    const res = await extractPackageFile(content);

    expect(res?.deps[0]).toEqual({
      depName: 'activesupport',
      depType: 'runtime',
      datasource: 'rubygems',
      currentValue: '"~> 4.2", "!= 4.2.5", ">= 4.2.1"',
    });
  });

  it('captures constraints given as an array', async () => {
    const content = codeBlock`
      spec.add_dependency "rails", [">= 7.0", "< 8.0"]
      spec.add_dependency("rack", [ '~> 3.1' ]) # pinned
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'rails',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '">= 7.0", "< 8.0"',
      },
      {
        depName: 'rack',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: "'~> 3.1'",
      },
    ]);
  });

  it.each`
    declaration
    ${'spec.add_dependency "rails", []'}
    ${'spec.add_dependency "rails", [Rails::VERSION]'}
    ${'spec.add_dependency "rails", ["~> 7.0"], "< 8.0"'}
  `(
    'skips the array form `$declaration` without literal constraints only',
    async ({ declaration }: { declaration: string }) => {
      const res = await extractPackageFile(declaration);

      expect(res?.deps[0].skipReason).toBe('unspecified-version');
    },
  );

  it('captures declarations that wrap over several lines', async () => {
    const content = codeBlock`
      Gem::Specification.new do |spec|
        spec.add_dependency(
          "rails",
          "~> 7.0",
        )
        spec.add_runtime_dependency "activesupport", ">= 7.0",
                                    "< 8.0" # upper bound
        spec.add_development_dependency 'rspec', [
          '~> 3.13',
          '!= 3.13.1',
        ]
      end
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'rails',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 7.0"',
      },
      {
        depName: 'activesupport',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '">= 7.0",\n                              "< 8.0"',
      },
      {
        depName: 'rspec',
        depType: 'development',
        datasource: 'rubygems',
        currentValue: "'~> 3.13',\n    '!= 3.13.1'",
      },
    ]);
  });

  it('keeps the line endings of a wrapped declaration', async () => {
    const content =
      'spec.add_dependency "rails", ">= 7.0",\r\n  "< 8.0"\r\nspec.add_dependency "rack", "~> 3.1"\r\n';

    const res = await extractPackageFile(content);

    expect(res?.deps.map((dep) => dep.currentValue)).toEqual([
      '">= 7.0",\r\n  "< 8.0"',
      '"~> 3.1"',
    ]);
  });

  it('skips a wrapped declaration with a comment between its parts', async () => {
    const content = codeBlock`
      spec.add_dependency "rails", # web framework
                          "~> 7.0"
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'rails',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
    ]);
  });

  it('stops a wrapped declaration at the next declaration', async () => {
    const content = codeBlock`
      spec.add_dependency("foo", "~> 1.0"
      spec.add_dependency "bar", "~> 2.0"
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'foo',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 1.0"',
      },
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 2.0"',
      },
    ]);
  });

  it('handles parentheses and trailing comments', async () => {
    const content = codeBlock`
      spec.add_dependency("graphql", "~> 1.9.19") # pinned intentionally
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps[0]).toEqual({
      depName: 'graphql',
      depType: 'runtime',
      datasource: 'rubygems',
      currentValue: '"~> 1.9.19"',
    });
  });

  it('skips dependencies without a literal version', async () => {
    const content = codeBlock`
      spec.add_dependency "rake"
      spec.add_runtime_dependency "foo", Foo::VERSION
      spec.add_dependency "bar", "~> 1.0", Bar::VERSION
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
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

  it('skips interpolated version strings', async () => {
    const content = codeBlock`
      spec.add_dependency "foo", "~> #{Foo::VERSION}"
      spec.add_runtime_dependency 'bar', "= #{version}"
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
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

  it('skips interpolated dependency names', async () => {
    const content = codeBlock`
      %w[core model controller].each do |variant|
        spec.add_dependency "my-framework-#{variant}", '~> 1.0'
      end
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'my-framework-#{variant}',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'contains-variable',
      },
    ]);
  });

  it('ignores declarations whose name is not a string literal', async () => {
    const content = codeBlock`
      spec.add_dependency gem_name, "~> 1.0"
      spec.add_dependency "bar", "~> 2.0"
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 2.0"',
      },
    ]);
  });

  it('ignores commented-out dependency declarations', async () => {
    const content = codeBlock`
      Gem::Specification.new do |spec|
        # spec.add_dependency "foo", "~> 1.0"
        spec.add_dependency "bar", "~> 2.0"
      end
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'bar',
        depType: 'runtime',
        datasource: 'rubygems',
        currentValue: '"~> 2.0"',
      },
    ]);
  });

  it('skips semicolon-joined declarations without updating either', async () => {
    const content = codeBlock`
      Gem::Specification.new do |spec|
        spec.add_dependency "foo", "~> 1.0"; spec.add_dependency "bar", "~> 2.0"
      end
    `;

    const res = await extractPackageFile(content);

    expect(res?.deps).toEqual([
      {
        depName: 'foo',
        depType: 'runtime',
        datasource: 'rubygems',
        skipReason: 'unspecified-version',
      },
    ]);
  });

  describe('with a sibling Gemfile.lock', () => {
    const gemspec = codeBlock`
      Gem::Specification.new do |spec|
        spec.name = "foo"
        spec.add_dependency "rack", "~> 3.1"
        spec.add_development_dependency "rspec", "~> 3.13"
      end
    `;

    function lockFile(remote: string): string {
      return codeBlock`
        PATH
          remote: ${remote}
          specs:
            foo (1.0.0)
              rack (~> 3.1)

        GEM
          remote: https://rubygems.org/
          specs:
            rack (3.1.8)

        PLATFORMS
          ruby
      `;
    }

    beforeEach(() => {
      fs.getSiblingFileName.mockImplementation(
        (_packageFile, otherFile) => `sub/${otherFile}`,
      );
    });

    it('sets lockFiles and lockedVersion when the lock file locks the gemspec', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockFile('.'));

      const res = await extractPackageFile(gemspec, 'sub/foo.gemspec');

      expect(res).toEqual({
        lockFiles: ['sub/Gemfile.lock'],
        deps: [
          {
            depName: 'rack',
            depType: 'runtime',
            datasource: 'rubygems',
            currentValue: '"~> 3.1"',
            lockedVersion: '3.1.8',
          },
          {
            depName: 'rspec',
            depType: 'development',
            datasource: 'rubygems',
            currentValue: '"~> 3.13"',
          },
        ],
      });
    });

    it('ignores a lock file that does not lock the gemspec', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockFile('engines/foo'));

      const res = await extractPackageFile(gemspec, 'sub/foo.gemspec');

      expect(res?.lockFiles).toBeUndefined();
      expect(res?.deps[0].lockedVersion).toBeUndefined();
    });
  });
});
