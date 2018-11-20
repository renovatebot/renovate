const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/cargo/update');

const cargo1toml = fs.readFileSync('test/_fixtures/cargo/Cargo.1.toml', 'utf8');
const cargo5toml = fs.readFileSync('test/_fixtures/cargo/Cargo.5.toml', 'utf8');
const cargo6toml = fs.readFileSync('test/_fixtures/cargo/Cargo.6.toml', 'utf8');
const cargo7toml = fs.readFileSync('test/_fixtures/cargo/Cargo.7.toml', 'utf8');

describe('lib/manager/cargo/update', () => {
  describe('updateDependency()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns same', () => {
      expect(updateDependency('abc', config)).toEqual('abc');
    });
    it('updates normal dependency', () => {
      const upgrade = {
        depName: 'libc',
        lineNumber: 16,
        depType: 'normal',
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo5toml);
    });
    it('updates inline table dependency', () => {
      const upgrade = {
        depName: 'pcap-sys',
        lineNumber: 18,
        depType: 'inlineTable',
        newValue: '0.2.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo6toml);
    });
    it('updates standard table table dependency', () => {
      const upgrade = {
        depName: 'winapi',
        lineNumber: 21,
        versionLineNumber: 22,
        depType: 'standardTable',
        newValue: '0.4.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo7toml);
    });
    it('does not update in case of error', () => {
      const upgrade = {
        depName: 'libc',
        lineNumber: 13, // Wrong lineNumber
        depType: 'normal',
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo1toml);
    });
  });
});
