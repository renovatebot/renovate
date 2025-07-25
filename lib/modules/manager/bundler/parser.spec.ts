import { codeBlock } from 'common-tags';
import { parseGemfile } from './parser';

describe('modules/manager/bundler/parser', () => {
  describe('ruby version', () => {
    it('extracts simple ruby version', async () => {
      const src = codeBlock`
        ruby '2.7.1'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '2.7.1',
        },
      ]);
    });

    it('handles empty ruby version', async () => {
      const src = codeBlock`
        ruby ''
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '',
          skipReason: 'empty',
        },
      ]);
    });

    it('handles ruby version with interpolation', async () => {
      const src = codeBlock`
        ruby "#{RUBY_VERSION}"
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '#{RUBY_VERSION}',
          skipReason: 'version-placeholder',
        },
      ]);
    });

    it('handles ruby version with multiple parts', async () => {
      const src = codeBlock`
        ruby "2.7.#{patch_version}"
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '2.7.#{patch_version}',
          skipReason: 'version-placeholder',
        },
      ]);
    });

    it('handles missing version', async () => {
      const src = codeBlock`
        gem 'rails'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'rails',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('handles ruby version with symbol', async () => {
      const src = codeBlock`
        ruby :latest
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: ':latest',
          skipReason: 'not-a-version',
        },
      ]);
    });

    it('extracts ruby version with single quotes', async () => {
      const src = codeBlock`
        ruby '3.0.0'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '3.0.0',
        },
      ]);
    });

    it('extracts ruby version with double quotes', async () => {
      const src = codeBlock`
        ruby "2.6.8"
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'ruby-version',
          depName: 'ruby',
          currentValue: '2.6.8',
        },
      ]);
    });
  });

  describe('gem instruction', () => {
    it('parses simplest gem instruction', async () => {
      const src = codeBlock`
        source :rubygems
        source :foobar
        gem 'foo'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          skipReason: 'unspecified-version',
          registryUrls: ['https://rubygems.org'],
        },
      ]);
    });

    describe('common instructions', () => {
      it.each`
        input                                                        | depName  | version    | group
        ${`gem 'foo', '1.0.0'`}                                      | ${'foo'} | ${'1.0.0'} | ${undefined}
        ${`gem 'foo', 1`}                                            | ${'foo'} | ${'1'}     | ${undefined}
        ${`gem 'foo', 1.2`}                                          | ${'foo'} | ${'1.2'}   | ${undefined}
        ${`gem 'foo', '1.0.0', group: "test"`}                       | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', :group => "test"`}                    | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', group: :test`}                        | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', :group => :test`}                     | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', foo: :foo, group: :test`}             | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', foo: :foo, group: :test, bar: "bar"`} | ${'foo'} | ${'1.0.0'} | ${'test'}
      `('$input', async ({ input, depName, version, group }) => {
        const deps = await parseGemfile(input);
        expect(deps).toEqual([
          {
            datasource: 'rubygems',
            depName,
            currentValue: version,
            depType: group,
            skipReason: 'unknown-registry',
          },
        ]);
      });
    });

    it('handles multiline gem instructions', async () => {
      const src = codeBlock`
        gem 'foo',
            '1.0.0',
            foo:   :foo,
            group: :test
            bar:   "bar"
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          depType: 'test',
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('extracts weird version', async () => {
      const src = codeBlock`
        gem 'foo', '>= 1.0.0', '< 2.0.0'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: "'>= 1.0.0', '< 2.0.0'",
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('handles multiple groups', async () => {
      const src = codeBlock`
        gem 'foo', '1.0.0', group: [:test, "development"]
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          depTypes: ['test', 'development'],
          skipReason: 'unknown-registry',
        },
      ]);
    });
  });

  describe('group blocks', () => {
    it('handles single group with single gem', async () => {
      const src = codeBlock`
        group :test do
          gem 'foo', '1.0.0'
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          depType: 'test',
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('handles single group with multiple gems', async () => {
      const src = codeBlock`
        group :test do
          gem 'foo', '1.0.0'
          gem 'bar', '2.0.0'
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          depType: 'test',
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'bar',
          currentValue: '2.0.0',
          depType: 'test',
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('handles nested group blocks', async () => {
      const src = codeBlock`
        group :foo do
          gem 'gem-1', 1

          group :bar, "baz" do
            gem 'gem-2', 2

            group "qux", :qux do
              gem 'gem-3', 3
            end

            gem 'gem-4', 4
          end

          gem 'gem-5', 5
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'gem-1',
          currentValue: '1',
          depType: 'foo',
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'gem-2',
          currentValue: '2',
          depTypes: ['foo', 'bar', 'baz'],
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'gem-3',
          currentValue: '3',
          depTypes: ['foo', 'bar', 'baz', 'qux'],
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'gem-4',
          currentValue: '4',
          depTypes: ['foo', 'bar', 'baz'],
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'gem-5',
          currentValue: '5',
          depType: 'foo',
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('handles many groups with multiple gems', async () => {
      const src = codeBlock`
        group :test, "development" do
          gem 'foo', '1.0.0', group: :foo
          gem 'bar', '2.0.0', group: [:bar, "baz"]
        end
      `;
      const res = await parseGemfile(src);
      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          depTypes: ['test', 'development', 'foo'],
          skipReason: 'unknown-registry',
        },
        {
          datasource: 'rubygems',
          depName: 'bar',
          currentValue: '2.0.0',
          depTypes: ['test', 'development', 'bar', 'baz'],
          skipReason: 'unknown-registry',
        },
      ]);
    });
  });

  describe('registries', () => {
    it('parses gem-level source parameter', async () => {
      const src = codeBlock`
        gem 'foo', '1.0.0', source: 'https://example.com'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses global source statement', async () => {
      const src = codeBlock`
        source 'https://example.com'
        gem 'foo', '1.0.0'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses :rubygems in global source statement', async () => {
      const src = codeBlock`
        source :rubygems
        gem 'foo', '1.0.0'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://rubygems.org'],
        },
      ]);
    });

    it('parses source block', async () => {
      const src = codeBlock`
        source 'https://example.com' do
          gem 'foo', '1.0.0'
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses source block with :rubygems symbol', async () => {
      const src = codeBlock`
        source :rubygems do
          gem 'foo', '1.0.0'
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://rubygems.org'],
        },
      ]);
    });

    it('parses nested source blocks', async () => {
      const src = codeBlock`
        source 'https://example-1.com' do
          source 'https://example-2.com' do
            gem 'foo', '1.0.0'
          end
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example-2.com', 'https://example-1.com'],
        },
      ]);
    });

    it('prioritizes inner sources', async () => {
      const src = codeBlock`
        source 'https://example-1.com'
        source 'https://example-2.com'

        source 'https://example-3.com' do
          source 'https://example-4.com' do
            gem 'foo', '1.0.0', source: 'https://example-5.com'
          end
        end

        source :rubygems do
          gem 'bar', '2.0.0'
        end
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: [
            'https://example-5.com',
            'https://example-4.com',
            'https://example-3.com',
            'https://example-2.com',
            'https://example-1.com',
          ],
        },
        {
          datasource: 'rubygems',
          depName: 'bar',
          currentValue: '2.0.0',
          registryUrls: [
            'https://rubygems.org',
            'https://example-2.com',
            'https://example-1.com',
          ],
        },
      ]);
    });
  });

  describe('git refs', () => {
    it('parses git with ref (commit hash)', async () => {
      const src = codeBlock`
        gem 'foo', git: 'https://github.com/foo/foo', ref: 'fd184883048b922b176939f851338d0a4971a532'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'git-refs',
          depName: 'foo',
          packageName: 'https://github.com/foo/foo',
          sourceUrl: 'https://github.com/foo/foo',
          currentDigest: 'fd184883048b922b176939f851338d0a4971a532',
        },
      ]);
    });

    it('parses git with tag', async () => {
      const src = codeBlock`
        gem 'bar', git: 'https://github.com/bar/bar', tag: 'v1.0.0'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'git-refs',
          depName: 'bar',
          packageName: 'https://github.com/bar/bar',
          sourceUrl: 'https://github.com/bar/bar',
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('parses github with branch', async () => {
      const src = codeBlock`
        gem 'baz', github: 'baz/baz', branch: 'master'
      `;

      const res = await parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'git-refs',
          depName: 'baz',
          packageName: 'https://github.com/baz/baz',
          sourceUrl: 'https://github.com/baz/baz',
          currentValue: 'master',
        },
      ]);
    });
  });
});
