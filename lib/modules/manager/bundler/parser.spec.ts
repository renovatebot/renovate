import { codeBlock } from 'common-tags';
import { parseGemfile } from './parser';

describe('modules/manager/bundler/parser', () => {
  it('extracts ruby version', () => {
    const src = codeBlock`
      ruby '2.7.1'
    `;

    const res = parseGemfile(src);

    expect(res).toEqual([
      {
        datasource: 'ruby-version',
        depName: 'ruby',
        currentValue: '2.7.1',
      },
    ]);
  });

  describe('gem instruction', () => {
    it('parses simplest gem instruction', () => {
      const src = codeBlock`
        source :rubygems
        source :foobar
        gem 'foo'
      `;

      const res = parseGemfile(src);

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
        ${`gem 'foo', '1.0.0', group: :test`}                        | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', foo: :foo, group: :test`}             | ${'foo'} | ${'1.0.0'} | ${'test'}
        ${`gem 'foo', '1.0.0', foo: :foo, group: :test, bar: "bar"`} | ${'foo'} | ${'1.0.0'} | ${'test'}
      `('$input', ({ input, depName, version, group }) => {
        const deps = parseGemfile(input);
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

    it('handles multiline gem instructions', () => {
      const src = codeBlock`
        gem 'foo',
            '1.0.0',
            foo:   :foo,
            group: :test
            bar:   "bar"
      `;

      const res = parseGemfile(src);

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

    it('extracts weird version', () => {
      const src = codeBlock`
        gem 'foo', '>= 1.0.0', '< 2.0.0'
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: "'>= 1.0.0', '< 2.0.0'",
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('handles multiple groups', () => {
      const src = codeBlock`
        gem 'foo', '1.0.0', group: [:test, "development"]
      `;

      const res = parseGemfile(src);

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
    it('handles single group with single gem', () => {
      const src = codeBlock`
        group :test do
          gem 'foo', '1.0.0'
        end
      `;

      const res = parseGemfile(src);

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

    it('handles single group with multiple gems', () => {
      const src = codeBlock`
        group :test do
          gem 'foo', '1.0.0'
          gem 'bar', '2.0.0'
        end
      `;

      const res = parseGemfile(src);

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

    it('handles nested group blocks', () => {
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

      const res = parseGemfile(src);

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

    it('handles multiple groups with multiple gems', () => {
      const src = codeBlock`
        group :test, "development" do
          gem 'foo', '1.0.0', group: :foo
          gem 'bar', '2.0.0', group: [:bar, "baz"]
        end
      `;
      const res = parseGemfile(src);
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
    it('parses gem-level source parameter', () => {
      const src = codeBlock`
        gem 'foo', '1.0.0', source: 'https://example.com'
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses global source statement', () => {
      const src = codeBlock`
        source 'https://example.com'
        gem 'foo', '1.0.0'
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses :rubygems in global source statement', () => {
      const src = codeBlock`
        source :rubygems
        gem 'foo', '1.0.0'
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://rubygems.org'],
        },
      ]);
    });

    it('parses source block', () => {
      const src = codeBlock`
        source 'https://example.com' do
          gem 'foo', '1.0.0'
        end
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example.com'],
        },
      ]);
    });

    it('parses source block with :rubygems symbol', () => {
      const src = codeBlock`
        source :rubygems do
          gem 'foo', '1.0.0'
        end
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://rubygems.org'],
        },
      ]);
    });

    it('parses nested source blocks', () => {
      const src = codeBlock`
        source 'https://example-1.com' do
          source 'https://example-2.com' do
            gem 'foo', '1.0.0'
          end
        end
      `;

      const res = parseGemfile(src);

      expect(res).toEqual([
        {
          datasource: 'rubygems',
          depName: 'foo',
          currentValue: '1.0.0',
          registryUrls: ['https://example-2.com', 'https://example-1.com'],
        },
      ]);
    });

    it('prioritizes inner sources', () => {
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

      const res = parseGemfile(src);

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
});
