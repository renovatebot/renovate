const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/cargo/update');

const cargo1toml = fs.readFileSync('test/_fixtures/cargo/Cargo.1.toml', 'utf8');
const cargo4toml = fs.readFileSync('test/_fixtures/cargo/Cargo.4.toml', 'utf8');

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
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('updates inline table dependency', () => {
      const upgrade = {
        depName: 'pcap-sys',
        lineNumber: 18,
        depType: 'inlineTable',
        newValue: '0.2.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('updates standard table table dependency', () => {
      const upgrade = {
        depName: 'winapi',
        lineNumber: 21,
        versionLineNumber: 22,
        depType: 'standardTable',
        newValue: '0.4.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('handles invalid standard tables gracefully', () => {
      const upgrade = {
        depName: 'dep5',
        lineNumber: 28,
        versionLineNumber: 29,
        depType: 'standardTable',
        newValue: '2.0.0',
      };
      expect(updateDependency(cargo4toml, upgrade)).toEqual(cargo4toml);
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
    it('does not update commented out standard table dependencies', () => {
      const upgrade = {
        depName: 'dep6',
        lineNumber: 33,
        versionLineNumber: 34,
        depType: 'standardTable',
        newValue: '4.0.0',
      };
      expect(updateDependency(cargo4toml, upgrade)).toEqual(cargo4toml);
    });
  });
});
