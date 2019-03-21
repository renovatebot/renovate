const fs = require('fs');
const path = require('path');
const tfUpdate = require('../../../lib/manager/mix/update');

const sample = fs.readFileSync(
  path.resolve(__dirname, './_fixtures/mix.exs'),
  'utf-8'
);

describe('lib/manager/mix/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depType: 'hex',
        depName: 'postgrex',
        lineNumber: 18,
        newValue: '~> 0.8.2',
      };
      const res = tfUpdate.updateDependency(sample, upgrade);
      expect(res).not.toEqual(sample);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('return the same', () => {
      const upgrade = {
        depType: 'hex',
        depName: 'postgrex',
        lineNumber: 18,
        newValue: '~> 0.8.1',
      };
      const res = tfUpdate.updateDependency(sample, upgrade);
      expect(res).toEqual(sample);
    });
    it('returns null if wrong line', () => {
      const upgrade = {
        depType: 'hex',
        depName: 'postgrex',
        lineNumber: 19,
        newValue: '~> 0.8.2',
      };
      const res = tfUpdate.updateDependency(sample, upgrade);
      expect(res).toBeNull();
    });
    it('returns null for unsupported depType', () => {
      const upgrade = {
        depType: 'github',
        depName: 'cowboy',
        lineNumber: 19,
        newValue: '~> 0.8.2',
      };
      const res = tfUpdate.updateDependency(sample, upgrade);
      expect(res).toBeNull();
    });
  });
});
