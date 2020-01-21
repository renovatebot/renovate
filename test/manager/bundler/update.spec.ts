import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/bundler/update';

const railsGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails',
  'utf8'
);

interface TestCase {
  oldString: string;
  newValue: string | null;
  newString: string;
}

describe('manager/docker-compose/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      // gem "rack-cache", "~> 1.2"
      const upgrade = {
        managerData: { lineNumber: 13 },
        depName: 'rack-cache',
        newValue: '~> 1.3',
      };
      const res = updateDependency(railsGemfile, upgrade);
      expect(res).not.toEqual(railsGemfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      // gem "rack-cache", "~> 1.2"
      const upgrade = {
        managerData: { lineNumber: 13 },
        depName: 'rack-cache',
        newValue: '~> 1.2',
      };
      const res = updateDependency(railsGemfile, upgrade);
      expect(res).toEqual(railsGemfile);
    });
    it('returns null if mismatch', () => {
      // gem "rack-cache", "~> 1.2"
      const upgrade = {
        managerData: { lineNumber: 13 },
        depName: 'wrong',
        newValue: '~> 1.3',
      };
      const res = updateDependency(railsGemfile, upgrade);
      expect(res).toBeNull();
    });
    it('uses single quotes', () => {
      const upgrade = {
        managerData: { lineNumber: 0 },
        depName: 'rack-cache',
        newValue: '~> 1.3',
      };
      const gemFile = `gem 'rack-cache', '~> 1.2'`;
      const res = updateDependency(gemFile, upgrade);
      expect(res).toEqual(`gem 'rack-cache', '~> 1.3'`);
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });

    describe('replaces gem strings', () => {
      const cases: [string, TestCase][] = [
        [
          'Null for nonsense strings',
          {
            oldString: 'nonsense',
            newValue: '2.0',
            newString: null,
          },
        ],
        [
          'Double quotes',
          {
            oldString: 'gem "foo", "1.0"',
            newValue: '2.0',
            newString: 'gem "foo", "2.0"',
          },
        ],
        [
          'Single quotes',
          {
            oldString: "gem 'foo', '1.0'",
            newValue: '2.0',
            newString: "gem 'foo', '2.0'",
          },
        ],
        [
          'Mixed quotes are converted according to which depName uses',
          {
            oldString: 'gem \'foo\', "1.0"',
            newValue: '2.0',
            newString: "gem 'foo', '2.0'",
          },
        ],
        [
          'Preserve whitespaces',
          {
            oldString: 'gem "foo",    "1.0"',
            newValue: '2.0',
            newString: 'gem "foo",    "2.0"',
          },
        ],
        [
          'Preserve other options and comments',
          {
            oldString: 'gem "foo", "1.0",   :requires=> false   # comment',
            newValue: '2.0',
            newString: 'gem "foo", "2.0",   :requires=> false   # comment',
          },
        ],
        [
          'Replace range versions',
          {
            oldString: 'gem "foo", ">= 1.0.0", "< 1.1.0"',
            newValue: '>= 1.0.0, < 1.2.0',
            newString: 'gem "foo", ">= 1.0.0", "< 1.2.0"',
          },
        ],
        [
          'Synchronize with gem version',
          {
            oldString:
              'gem "foo", "1.0.0", :github => "bar/foo", :tag=> "1.0.0"',
            newValue: '2.0.0',
            newString:
              'gem "foo", "2.0.0", :github => "bar/foo", :tag=> "2.0.0"',
          },
        ],
        [
          'Synchronize with gem version (alternative opt-map syntax)',
          {
            oldString: 'gem "foo", "1.0", github: "foo", tag: "1.0.0"',
            newValue: '2.0.0',
            newString: 'gem "foo", "2.0.0", github: "foo", tag: "2.0.0"',
          },
        ],
        [
          'Synchronize with gem version ("v2.0.0" -> "2.0.0")',
          {
            oldString: 'gem "foo", "1.0.0", tag: "v1.0.0"',
            newValue: 'v2.0.0',
            newString: 'gem "foo", "2.0.0", tag: "v2.0.0"',
          },
        ],
        [
          'Synchronize with gem version (unstable "2.0.0-rc1")',
          {
            oldString: 'gem "foo", "1.0.0", tag: "1.0.0"',
            newValue: '2.0.0-rc1',
            newString: 'gem "foo", "2.0.0", tag: "2.0.0-rc1"',
          },
        ],
        [
          'Synchronize with gem version (unstable "v2.0.0.beta1")',
          {
            oldString: 'gem "foo", "1.0.0", tag: "v1.0.0"',
            newValue: 'v2.0.0.beta1',
            newString: 'gem "foo", "2.0.0", tag: "v2.0.0.beta1"',
          },
        ],
        [
          'Keep range (new version is inside)',
          {
            oldString: 'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.0"',
            newValue: '1.0.5',
            newString: 'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.5"',
          },
        ],
        [
          'Keep range (new version is outside)',
          {
            oldString: 'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.0"',
            newValue: '1.2.0',
            newString: 'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.2.0"',
          },
        ],
        [
          'Modify exact range ("=1.0.0")',
          {
            oldString: 'gem "foo", "=1.0.0", tag: "1.0.0"',
            newValue: '1.0.5',
            newString: 'gem "foo", "=1.0.5", tag: "1.0.5"',
          },
        ],
        [
          'Modify arrow range ("~>1.0.0")',
          {
            oldString: 'gem "foo", "~>1.0.0", tag: "1.0.0"',
            newValue: '1.2.0',
            newString: 'gem "foo", "~>1.2.0", tag: "1.2.0"',
          },
        ],
      ];

      test.each(cases)('%s', (_msg, { oldString, newString, newValue }) => {
        const depType = /tag/.test(oldString) ? 'tags' : undefined;
        expect(
          updateDependency(oldString, {
            depName: 'foo',
            depType,
            managerData: { lineNumber: 0 },
            newValue,
          })
        ).toEqual(newString);
      });
    });
  });
});
