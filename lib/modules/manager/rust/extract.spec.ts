import { extractPackageFile } from '.';

describe('modules/manager/rust/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns result when fully qualified version is set', () => {
      const res = extractPackageFile(`
        [toolchain]
        components = [ "rustfmt", "rustc-dev" ]
        channel = "1.82.0"
        targets = [ "wasm32-unknown-unknown", "thumbv2-none-eabi" ]
        profile = "minimal"`);
      expect(res.deps).toEqual([
        {
          currentValue: '1.82.0',
          datasource: 'github-releases',
          depName: 'rust',
          packageName: 'rust-lang/rust',
        },
      ]);
    });

    it('returns result when major.minor version is set', () => {
      const res = extractPackageFile(`
        [toolchain]
        components = [ "rustfmt", "rustc-dev" ]
        channel = "1.82"`);
      expect(res.deps).toEqual([
        {
          currentValue: '1.82',
          datasource: 'github-releases',
          depName: 'rust',
          packageName: 'rust-lang/rust',
        },
      ]);
    });

    it('returns all deps when multiple channels are set', () => {
      const res = extractPackageFile(`
        [toolchain]
        components = [ "rustfmt", "rustc-dev" ]
        channel = "1.83"
        channel = "1.82"`);
      expect(res.deps).toEqual([
        {
          currentValue: '1.83',
          datasource: 'github-releases',
          depName: 'rust',
          packageName: 'rust-lang/rust',
        },
        {
          currentValue: '1.82',
          datasource: 'github-releases',
          depName: 'rust',
          packageName: 'rust-lang/rust',
        },
      ]);
    });

    it('returns empty when no channel entry is present', () => {
      const res = extractPackageFile(`
        [toolchain]
        components = [ "rustfmt", "rustc-dev" ]
        targets = [ "wasm32-unknown-unknown", "thumbv2-none-eabi" ]
        profile = "minimal"`);
      expect(res.deps).toEqual([]);
    });

    it('returns empty when channel with named release set', () => {
      const res = extractPackageFile(`
        [toolchain]
        components = [ "rustfmt", "rustc-dev" ]
        channel = "nightly-2020-07-10"
        targets = [ "wasm32-unknown-unknown", "thumbv2-none-eabi" ]
        profile = "minimal"`);
      expect(res.deps).toEqual([]);
    });
  });
});
