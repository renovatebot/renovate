import { codeBlock } from 'common-tags';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

function mockReadLocalFile(files: Record<string, string | null>) {
  fs.readLocalFile.mockImplementation((file): Promise<any> => {
    let content: string | null = null;
    if (file in files) {
      content = files[file];
    }
    return Promise.resolve(content);
  });
}

const cargo1toml = Fixtures.get('Cargo.1.toml');
const cargo2toml = Fixtures.get('Cargo.2.toml');
const cargo3toml = Fixtures.get('Cargo.3.toml');
const cargo4toml = Fixtures.get('Cargo.4.toml');
const cargo5toml = Fixtures.get('Cargo.5.toml');
const cargo6configtoml = Fixtures.get('cargo.6.config.toml');
const cargo6toml = Fixtures.get('Cargo.6.toml');
const cargo7toml = Fixtures.get('Cargo.7.toml');

const lockfileUpdateCargotoml = Fixtures.get('lockfile-update/Cargo.toml');

describe('modules/manager/cargo/extract', () => {
  describe('extractPackageFile()', () => {
    const config: ExtractConfig = {};

    beforeEach(() => {
      delete process.env.CARGO_REGISTRIES_PRIVATE_CRATES_INDEX;
      delete process.env.CARGO_REGISTRIES_MCORBIN_INDEX;
    });

    it('returns null for invalid toml', async () => {
      expect(
        await extractPackageFile('invalid toml', 'Cargo.toml', config),
      ).toBeNull();
    });

    it('returns null for empty dependencies', async () => {
      const cargotoml = '[dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config),
      ).toBeNull();
    });

    it('returns null for empty dev-dependencies', async () => {
      const cargotoml = '[dev-dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config),
      ).toBeNull();
    });

    it('returns null for empty custom target', async () => {
      const cargotoml = '[target."foo".dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config),
      ).toBeNull();
    });

    it('extracts multiple dependencies simple', async () => {
      const res = await extractPackageFile(cargo1toml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(15);
    });

    it('extracts multiple dependencies advanced', async () => {
      const res = await extractPackageFile(cargo2toml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(18 + 6 + 1);
    });

    it('handles inline tables', async () => {
      const res = await extractPackageFile(cargo3toml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
    });

    it('handles standard tables', async () => {
      const res = await extractPackageFile(cargo4toml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
    });

    it('extracts platform specific dependencies', async () => {
      const res = await extractPackageFile(cargo5toml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(4);
    });

    it('extracts registry urls from .cargo/config.toml', async () => {
      mockReadLocalFile({ '.cargo/config.toml': cargo6configtoml });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('extracts registry urls from .cargo/config (legacy path)', async () => {
      mockReadLocalFile({ '.cargo/config.toml': cargo6configtoml });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('extracts overridden registry indexes from .cargo/config.toml', async () => {
      mockReadLocalFile({
        '.cargo/config.toml': codeBlock`[registries]
private-crates = { index = "https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git" }

[registries.mcorbin]
index = "https://github.com/mcorbin/testregistry"

[source.crates-io]
replace-with = "mcorbin"

[source.mcorbin]
replace-with = "private-crates"`,
      });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'crate',
          depName: 'proprietary-crate',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'private-crates',
          },
          registryUrls: [
            'https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git',
          ],
        },
        {
          currentValue: '3.0.0',
          datasource: 'crate',
          depName: 'mcorbin-test',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'mcorbin',
          },
          registryUrls: [
            'https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git',
          ],
        },
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          registryUrls: [
            'https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git',
          ],
        },
      ]);
    });

    it('extracts overridden source registry indexes from .cargo/config.toml', async () => {
      mockReadLocalFile({
        '.cargo/config.toml': codeBlock`[source.crates-io-replacement]
registry = "https://github.com/replacement/testregistry"

[source.crates-io]
replace-with = "crates-io-replacement"`,
      });
      const res = await extractPackageFile(cargo7toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          registryUrls: ['https://github.com/replacement/testregistry'],
        },
      ]);
    });

    it('extracts registries overridden to the default', async () => {
      mockReadLocalFile({
        '.cargo/config.toml': codeBlock`[source.mcorbin]
replace-with = "crates-io"

[source.private-crates]
replace-with = "mcorbin"`,
      });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'crate',
          depName: 'proprietary-crate',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'private-crates',
          },
        },
        {
          currentValue: '3.0.0',
          datasource: 'crate',
          depName: 'mcorbin-test',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'mcorbin',
          },
        },
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
        },
      ]);
    });

    it('extracts registries with an empty config.toml', async () => {
      mockReadLocalFile({ '.cargo/config.toml': '' });
      const res = await extractPackageFile(cargo5toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.2.37',
          datasource: 'crate',
          depName: 'wasm-bindgen',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          target: 'cfg(target_arch = "wasm32")',
        },
        {
          currentValue: '0.3.14',
          datasource: 'crate',
          depName: 'js-sys',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          target: 'cfg(target_arch = "wasm32")',
        },
        {
          currentValue: '',
          datasource: 'crate',
          depName: 'js_relative_import',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          skipReason: 'path-dependency',
          target: 'cfg(target_arch = "wasm32")',
        },
        {
          currentValue: '0.3.14',
          datasource: 'crate',
          depName: 'web-sys',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
          },
          target: 'cfg(target_arch = "wasm32")',
        },
      ]);
    });

    it('extracts registry urls from environment', async () => {
      process.env.CARGO_REGISTRIES_PRIVATE_CRATES_INDEX =
        'https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git';
      process.env.CARGO_REGISTRIES_MCORBIN_INDEX =
        'https://github.com/mcorbin/testregistry';
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });

      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'crate',
          depName: 'proprietary-crate',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'private-crates',
          },
          registryUrls: [
            'https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git',
          ],
        },
        {
          currentValue: '3.0.0',
          datasource: 'crate',
          depName: 'mcorbin-test',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'mcorbin',
          },
          registryUrls: ['https://github.com/mcorbin/testregistry'],
        },
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
        },
      ]);
    });

    it('extracts workspace dependencies', async () => {
      const cargoToml = codeBlock`
[package]
name = "renovate-test"
version = "0.1.0"
authors = ["John Doe <john.doe@example.org>"]
edition = "2018"

[dependencies]
git2 = "0.14.0"

[workspace]
members = ["pcap-sys"]

[workspace.dependencies]
serde = "1.0.146"
tokio = { version = "1.21.1" }`;
      const res = await extractPackageFile(cargoToml, 'Cargo.toml', config);
      expect(res?.deps).toEqual([
        {
          currentValue: '0.14.0',
          datasource: 'crate',
          depName: 'git2',
          depType: 'dependencies',
          managerData: { nestedVersion: false },
        },
        {
          currentValue: '1.0.146',
          datasource: 'crate',
          depName: 'serde',
          depType: 'workspace.dependencies',
          managerData: { nestedVersion: false },
        },
        {
          currentValue: '1.21.1',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'workspace.dependencies',
          managerData: {
            nestedVersion: true,
          },
        },
      ]);
    });

    it('skips workspace dependency', async () => {
      const cargotoml = '[dependencies]\nfoobar = { workspace = true }';
      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.deps).toEqual([
        {
          currentValue: '',
          datasource: 'crate',
          depName: 'foobar',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          skipReason: 'inherited-dependency',
        },
      ]);
    });

    it('skips unknown registries', async () => {
      const cargotoml =
        '[dependencies]\nfoobar = { version = "0.1.0", registry = "not-listed" }';
      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('fails to parse cargo config with invalid TOML', async () => {
      mockReadLocalFile({ '.cargo/config': '[registries' });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('ignore cargo config registries with missing index', async () => {
      mockReadLocalFile({ '.cargo/config': '[registries.mine]\nfoo = "bar"' });
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('ignore cargo config source replaced registries with missing index', async () => {
      mockReadLocalFile({
        '.cargo/config': codeBlock`[registries.mine]
foo = "bar"

[source.crates-io]
replace-with = "mine"`,
      });

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'crate',
          depName: 'proprietary-crate',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'private-crates',
          },
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '3.0.0',
          datasource: 'crate',
          depName: 'mcorbin-test',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'mcorbin',
          },
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('ignore cargo config with circular registry source replacements', async () => {
      mockReadLocalFile({
        '.cargo/config': codeBlock`[registries]
private-crates = { index = "https://dl.cloudsmith.io/basic/my-org/my-repo/cargo/index.git" }

[registries.mcorbin]
index = "https://github.com/mcorbin/testregistry"

[source.crates-io]
replace-with = "mcorbin"

[source.mcorbin]
replace-with = "private-crates"

[source.private-crates]
replace-with = "mcorbin"
`,
      });

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toEqual([
        {
          currentValue: '0.1.0',
          datasource: 'crate',
          depName: 'proprietary-crate',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'private-crates',
          },
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '3.0.0',
          datasource: 'crate',
          depName: 'mcorbin-test',
          depType: 'dependencies',
          managerData: {
            nestedVersion: true,
            registryName: 'mcorbin',
          },
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '0.2',
          datasource: 'crate',
          depName: 'tokio',
          depType: 'dependencies',
          managerData: {
            nestedVersion: false,
          },
          skipReason: 'unknown-registry',
        },
      ]);
    });

    it('extracts original package name of renamed dependencies', async () => {
      const cargotoml =
        '[dependencies]\nboolector-solver = { package = "boolector", version = "0.4.0" }';
      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);

      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].packageName).toBe('boolector');
    });

    it('extracts locked versions', async () => {
      const cargolock = Fixtures.get('lockfile-update/Cargo.3.lock');
      mockReadLocalFile({ 'Cargo.lock': cargolock });
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');

      const cargotoml = codeBlock`
        [package]
        name = "test"
        version = "0.1.0"
        edition = "2021"
        [dependencies]
        syn = "2.0"
        `;

      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.deps).toMatchObject([{ lockedVersion: '2.0.1' }]);
    });

    it('extracts locked versions for renamed packages', async () => {
      const cargolock = Fixtures.get('lockfile-update/Cargo.1.lock');
      mockReadLocalFile({ 'Cargo.lock': cargolock });
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');

      const res = await extractPackageFile(
        lockfileUpdateCargotoml,
        'Cargo.toml',
        config,
      );
      expect(res?.deps).toMatchObject([
        { lockedVersion: '2.0.1' },
        { lockedVersion: '1.0.1' },
      ]);
    });

    it('handles missing locked versions', async () => {
      const cargolock = Fixtures.get('lockfile-update/Cargo.2.lock');
      mockReadLocalFile({ 'Cargo.lock': cargolock });
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');

      const res = await extractPackageFile(
        lockfileUpdateCargotoml,
        'Cargo.toml',
        config,
      );
      expect(res?.deps).toMatchObject([
        { lockedVersion: '2.0.1' },
        expect.not.objectContaining({ lockedVersion: expect.anything() }),
      ]);
    });

    it('handles invalid versions in the toml file', async () => {
      const cargolock = Fixtures.get('lockfile-update/Cargo.3.lock');
      mockReadLocalFile({ 'Cargo.lock': cargolock });
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');

      const cargotoml = codeBlock`
        [package]
        name = "test"
        version = "0.1.0"
        edition = "2021"
        [dependencies]
        syn = "2.foo.1"
        `;

      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.deps).not.toHaveProperty('lockedVersion');
    });

    it('handles invalid lock file', async () => {
      mockReadLocalFile({ 'Cargo.lock': 'foo' });
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');

      const res = await extractPackageFile(
        lockfileUpdateCargotoml,
        'Cargo.toml',
        config,
      );
      expect(res?.deps).toMatchObject([
        expect.not.objectContaining({ lockedVersion: expect.anything() }),
        expect.not.objectContaining({ lockedVersion: expect.anything() }),
      ]);
    });

    it('should extract project version', async () => {
      const cargotoml = codeBlock`
        [package]
        name = "test"
        version = "0.1.0"
        edition = "2021"
        [dependencies]
        syn = "2.0"
        `;

      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.packageFileVersion).toBe('0.1.0');
    });

    it('should extract project version from workspace', async () => {
      const cargotoml = codeBlock`
        [package]
        name = "test"
        version.workspace = true
        edition = "2021"
        [workspace.package]
        version = "0.1.0"
        [dependencies]
        syn = "2.0"
        `;

      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res?.packageFileVersion).toBe('0.1.0');
    });
  });
});
