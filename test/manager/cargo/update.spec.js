const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/cargo/update');

const cargo1toml = fs.readFileSync(
  'test/manager/cargo/_fixtures/Cargo.1.toml',
  'utf8'
);
const cargo4toml = fs.readFileSync(
  'test/manager/cargo/_fixtures/Cargo.4.toml',
  'utf8'
);
const cargo5toml = fs.readFileSync(
  'test/manager/cargo/_fixtures/Cargo.5.toml',
  'utf8'
);

describe('lib/manager/cargo/update', () => {
  describe('updateDependency()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns same for invalid toml', () => {
      const cargotoml = 'invalid toml !#$#';
      expect(updateDependency(cargotoml, config)).toEqual(cargotoml);
    });
    it('returns same for null upgrade', () => {
      const cargotoml = '[dependencies]\n';
      expect(updateDependency(cargotoml, null)).toEqual(cargotoml);
    });
    it('returns same if version has not changed', () => {
      const cargotoml = '[dependencies]\n';
      expect(updateDependency(cargotoml, null)).toEqual(cargotoml);
      const upgrade = {
        depName: 'libc',
        depType: 'dependencies',
        nestedVersion: false,
        newValue: '=0.2.43',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).toBe(cargo1toml);
    });
    it('returns same for invalid target', () => {
      const cargotoml = '[dependencies]\n';
      expect(updateDependency(cargotoml, null)).toEqual(cargotoml);
      const upgrade = {
        depName: 'platform-specific-dep',
        depType: 'dependencies',
        nestedVersion: false,
        target: 'foobar',
        newValue: '1.2.3',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).toBe(cargo1toml);
    });
    it('returns same for invalid depType', () => {
      const cargotoml = '[dependencies]\n';
      expect(updateDependency(cargotoml, null)).toEqual(cargotoml);
      const upgrade = {
        depName: 'libc',
        depType: 'foobar',
        nestedVersion: false,
        newValue: '1.2.3',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).toBe(cargo1toml);
    });
    it('returns same for invalid depName', () => {
      const cargotoml = '[dependencies]\n';
      expect(updateDependency(cargotoml, null)).toEqual(cargotoml);
      const upgrade = {
        depName: 'does not exist',
        depType: 'dependencies',
        nestedVersion: false,
        newValue: '1.2.3',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).toBe(cargo1toml);
    });
    it('updates normal dependency', () => {
      const upgrade = {
        depName: 'libc',
        depType: 'dependencies',
        nestedVersion: false,
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).not.toBe(cargo1toml);
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('updates normal dependency with mismatch on first try', () => {
      const upgrade = {
        depName: 'same_version_1',
        depType: 'dependencies',
        nestedVersion: false,
        newValue: '1.2.3',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).not.toBe(cargo1toml);
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('updates nested version dependency', () => {
      const upgrade = {
        depName: 'pcap-sys',
        depType: 'dependencies',
        nestedVersion: true,
        newValue: '0.2.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).not.toBe(cargo1toml);
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('updates platform specific dependency', () => {
      const upgrade = {
        depName: 'winapi',
        target: 'cfg(windows)',
        depType: 'dependencies',
        nestedVersion: true,
        newValue: '0.4.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo1toml, upgrade)).not.toBe(cargo1toml);
      expect(updateDependency(cargo1toml, upgrade)).toMatchSnapshot();
    });
    it('handles invalid standard tables gracefully', () => {
      const upgrade = {
        depName: 'dep5',
        nestedVersion: true,
        depType: 'dependencies',
        newValue: '2.0.0',
      };
      expect(updateDependency(cargo4toml, upgrade)).toEqual(cargo4toml);
    });
    it('does not update in case of error', () => {
      const upgrade = {
        depName: 'libc',
        devType: 'dev-dependencies', // Wrong devType
        nestedVersion: false,
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo1toml);
    });
    it('does not update in case of error', () => {
      const upgrade = {
        depName: 'libc',
        devType: 'dependencies',
        nestedVersion: true, // Should be false
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo1toml);
    });
    it('does not update in case of error', () => {
      const upgrade = {
        depName: 'pcap-sys',
        devType: 'dependencies',
        nestedVersion: false, // Should be true
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo1toml, upgrade)).toEqual(cargo1toml);
    });
    it('updates platform specific normal dependency', () => {
      const upgrade = {
        depName: 'wasm-bindgen',
        depType: 'dependencies',
        nestedVersion: false,
        target: 'cfg(target_arch = "wasm32")',
        newValue: '0.3.0',
      };
      expect(updateDependency(cargo5toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo5toml, upgrade)).not.toBe(cargo5toml);
    });
    it('updates platform specific table dependency', () => {
      const upgrade = {
        depName: 'web-sys',
        nestedVersion: true,
        depType: 'dependencies',
        target: 'cfg(target_arch = "wasm32")',
        newValue: '0.4.0',
      };
      expect(updateDependency(cargo5toml, upgrade)).not.toBeNull();
      expect(updateDependency(cargo5toml, upgrade)).not.toBe(cargo5toml);
    });
  });
});
