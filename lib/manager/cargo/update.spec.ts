import { readFileSync } from 'fs';
import { updateDependency } from './update';

const cargo1toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.1.toml',
  'utf8'
);
const cargo4toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.4.toml',
  'utf8'
);
const cargo5toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.5.toml',
  'utf8'
);

describe('lib/manager/cargo/update', () => {
  describe('updateDependency()', () => {
    let config;
    beforeEach(() => {
      config = { managerData: {} };
    });
    it('returns same for invalid toml', () => {
      const cargotoml = 'invalid toml !#$#';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: config })
      ).toEqual(cargotoml);
    });
    it('returns same for null upgrade', () => {
      const cargotoml = '[dependencies]\n';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: null })
      ).toEqual(cargotoml);
    });
    it('returns same if version has not changed', () => {
      const cargotoml = '[dependencies]\n';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: null })
      ).toEqual(cargotoml);
      const updateOptions = {
        depName: 'libc',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        newValue: '=0.2.43',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(updateDependency({ fileContent: cargo1toml, updateOptions })).toBe(
        cargo1toml
      );
    });
    it('returns same for invalid target', () => {
      const cargotoml = '[dependencies]\n';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: null })
      ).toEqual(cargotoml);
      const updateOptions = {
        depName: 'platform-specific-dep',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        target: 'foobar',
        newValue: '1.2.3',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(updateDependency({ fileContent: cargo1toml, updateOptions })).toBe(
        cargo1toml
      );
    });
    it('returns same for invalid depType', () => {
      const cargotoml = '[dependencies]\n';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: null })
      ).toEqual(cargotoml);
      const updateOptions = {
        depName: 'libc',
        depType: 'foobar',
        managerData: { nestedVersion: false },
        newValue: '1.2.3',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(updateDependency({ fileContent: cargo1toml, updateOptions })).toBe(
        cargo1toml
      );
    });
    it('returns same for invalid depName', () => {
      const cargotoml = '[dependencies]\n';
      expect(
        updateDependency({ fileContent: cargotoml, updateOptions: null })
      ).toEqual(cargotoml);
      const updateOptions = {
        depName: 'does not exist',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        newValue: '1.2.3',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(updateDependency({ fileContent: cargo1toml, updateOptions })).toBe(
        cargo1toml
      );
    });
    it('updates normal dependency', () => {
      const updateOptions = {
        depName: 'libc',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        newValue: '0.3.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBe(cargo1toml);
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toMatchSnapshot();
    });
    it('updates normal dependency with mismatch on first try', () => {
      const updateOptions = {
        depName: 'same_version_1',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        newValue: '1.2.3',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBe(cargo1toml);
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toMatchSnapshot();
    });
    it('updates nested version dependency', () => {
      const updateOptions = {
        depName: 'pcap-sys',
        depType: 'dependencies',
        managerData: { nestedVersion: true },
        newValue: '0.2.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBe(cargo1toml);
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toMatchSnapshot();
    });
    it('updates platform specific dependency', () => {
      const updateOptions = {
        depName: 'winapi',
        target: 'cfg(windows)',
        depType: 'dependencies',
        managerData: { nestedVersion: true },
        newValue: '0.4.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).not.toBe(cargo1toml);
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toMatchSnapshot();
    });
    it('handles invalid standard tables gracefully', () => {
      const updateOptions = {
        depName: 'dep5',
        managerData: { nestedVersion: true },
        depType: 'dependencies',
        newValue: '2.0.0',
      };
      expect(
        updateDependency({ fileContent: cargo4toml, updateOptions })
      ).toEqual(cargo4toml);
    });
    it('does not update in case of error', () => {
      const updateOptions = {
        depName: 'libc',
        devType: 'dev-dependencies', // Wrong devType
        managerData: { nestedVersion: false },
        newValue: '0.3.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toEqual(cargo1toml);
    });
    it('does not update in case of error', () => {
      const updateOptions = {
        depName: 'libc',
        devType: 'dependencies',
        managerData: { nestedVersion: true }, // Should be false
        newValue: '0.3.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toEqual(cargo1toml);
    });
    it('does not update in case of error', () => {
      const updateOptions = {
        depName: 'pcap-sys',
        devType: 'dependencies',
        managerData: { nestedVersion: false }, // Should be true
        newValue: '0.3.0',
      };
      expect(
        updateDependency({ fileContent: cargo1toml, updateOptions })
      ).toEqual(cargo1toml);
    });
    it('updates platform specific normal dependency', () => {
      const updateOptions = {
        depName: 'wasm-bindgen',
        depType: 'dependencies',
        managerData: { nestedVersion: false },
        target: 'cfg(target_arch = "wasm32")',
        newValue: '0.3.0',
      };
      expect(
        updateDependency({ fileContent: cargo5toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo5toml, updateOptions })
      ).not.toBe(cargo5toml);
    });
    it('updates platform specific table dependency', () => {
      const updateOptions = {
        depName: 'web-sys',
        managerData: { nestedVersion: true },
        depType: 'dependencies',
        target: 'cfg(target_arch = "wasm32")',
        newValue: '0.4.0',
      };
      expect(
        updateDependency({ fileContent: cargo5toml, updateOptions })
      ).not.toBeNull();
      expect(
        updateDependency({ fileContent: cargo5toml, updateOptions })
      ).not.toBe(cargo5toml);
    });
  });
});
