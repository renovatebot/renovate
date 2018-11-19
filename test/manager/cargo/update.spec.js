const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/cargo/update');

const cargo1toml = fs.readFileSync('test/_fixtures/cargo/Cargo.1.toml', 'utf8');
const cargo5toml = fs.readFileSync('test/_fixtures/cargo/Cargo.5.toml', 'utf8');

describe('lib/manager/cargo/update', () => {
  describe('updateDependency()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns same', () => {
      expect(updateDependency('abc', config)).toEqual('abc');
    });
    it('updates dependency', () => {
      upgrade = {
        depName : 'libc',
        lineNumber : 16,
        depType : 'normal',
        newValue : '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo5toml);
    });
  });
});
