import { readFileSync } from 'fs';
import { updateDependency } from './update';

const railsGemfile = readFileSync(
  'lib/manager/bundler/__fixtures__/Gemfile.rails',
  'utf8'
);

describe('manager/docker-compose/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      // gem "rack-cache", "~> 1.2"
      const updateOptions = {
        managerData: { lineNumber: 13 },
        depName: 'rack-cache',
        newValue: '~> 1.3',
      };
      const res = updateDependency({
        fileContent: railsGemfile,
        updateOptions,
      });
      expect(res).not.toEqual(railsGemfile);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('returns same', () => {
      // gem "rack-cache", "~> 1.2"
      const updateOptions = {
        managerData: { lineNumber: 13 },
        depName: 'rack-cache',
        newValue: '~> 1.2',
      };
      const res = updateDependency({
        fileContent: railsGemfile,
        updateOptions,
      });
      expect(res).toEqual(railsGemfile);
    });
    it('returns null if mismatch', () => {
      // gem "rack-cache", "~> 1.2"
      const updateOptions = {
        managerData: { lineNumber: 13 },
        depName: 'wrong',
        newValue: '~> 1.3',
      };
      const res = updateDependency({
        fileContent: railsGemfile,
        updateOptions,
      });
      expect(res).toBeNull();
    });
    it('uses single quotes', () => {
      const updateOptions = {
        managerData: { lineNumber: 0 },
        depName: 'rack-cache',
        newValue: '~> 1.3',
      };
      const gemFile = `gem 'rack-cache', '~> 1.2'`;
      const res = updateDependency({ fileContent: gemFile, updateOptions });
      expect(res).toEqual(`gem 'rack-cache', '~> 1.3'`);
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
  });
});
