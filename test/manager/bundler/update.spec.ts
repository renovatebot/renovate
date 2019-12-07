import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/bundler/update';

const railsGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails',
  'utf8'
);

describe('manager/docker-compose/update', () => {
  describe('updateDependency', () => {
    it('replaces gem strings', () => {
      // prettier-ignore
      [
        ['nonsense', null, '2.0',],
        ['non\nsense', null, '2.0',],
        [
          'gem "foo", "1.0"',
          'gem "foo", "2.0"',
          '2.0',
        ],
        [
          'gem \'foo\', "1.0"',
          'gem \'foo\', \'2.0\'',
          '2.0',
        ],
        [
          'gem "foo",    "1.0"',
          'gem "foo",    "2.0"',
          '2.0',
        ],
        [
          'gem "foo", "1.0",   :requires=> false   # comment',
          'gem "foo", "2.0",   :requires=> false   # comment',
          '2.0',
        ],
        [
          'gem "foo", ">= 1.0.0", "< 1.1.0"',
          'gem "foo", ">= 1.0.0", "< 1.2.0"',
          '>= 1.0.0, < 1.2.0',
        ],
        // Synchronize with gem version
        [
          'gem "foo", "1.0.0"  , :github   =>"bar/foo" , :tag=> "1.0.0"',
          'gem "foo", "2.0.0"  , :github   =>"bar/foo" , :tag=> "2.0.0"',
          '2.0.0',
        ],
        [
          'gem "foo", "1.0", github: "foo", tag: "1.0.0"',
          'gem "foo", "2.0.0", github: "foo", tag: "2.0.0"',
          '2.0.0',
        ],
        [
          'gem "foo", "1.0.0", tag: "v1.0.0"',
          'gem "foo", "2.0.0", tag: "v2.0.0"',
          'v2.0.0',
        ],
        [
          'gem "foo", "1.0.0", tag: "1.0.0"',
          'gem "foo", "2.0.0", tag: "2.0.0-rc1"',
          '2.0.0-rc1',
        ],
        [
          'gem "foo", "1.0.0", tag: "v1.0.0"',
          'gem "foo", "2.0.0", tag: "v2.0.0.beta1"',
          'v2.0.0.beta1',
        ],
        // Don't touch ranges
        [
          'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.0"',
          'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.5"',
          '1.0.5',
        ],
        [
          'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.0.0"',
          'gem "foo", ">= 1.0.0", "< 1.1.0", tag: "1.2.0"',
          '1.2.0',
        ],
        // Though some range types are okay
        [
          'gem "foo", "=1.0.0", tag: "1.0.0"',
          'gem "foo", "=1.0.5", tag: "1.0.5"',
          '1.0.5',
        ],
        [
          'gem "foo", "~>1.0.0", tag: "1.0.0"',
          'gem "foo", "~>1.2.0", tag: "1.2.0"',
          '1.2.0',
        ],
      ].forEach(([oldString, newString, newValue]) => {
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
  });
});
