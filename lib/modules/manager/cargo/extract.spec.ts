import { codeBlock } from 'common-tags';
import { DirectoryResult, dir } from 'tmp-promise';
import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { writeLocalFile } from '../../../util/fs';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

const cargo1toml = Fixtures.get('Cargo.1.toml');
const cargo2toml = Fixtures.get('Cargo.2.toml');
const cargo3toml = Fixtures.get('Cargo.3.toml');
const cargo4toml = Fixtures.get('Cargo.4.toml');
const cargo5toml = Fixtures.get('Cargo.5.toml');
const cargo6configtoml = Fixtures.get('cargo.6.config.toml');
const cargo6toml = Fixtures.get('Cargo.6.toml');

describe('modules/manager/cargo/extract', () => {
  describe('extractPackageFile()', () => {
    let config: ExtractConfig;
    let adminConfig: RepoGlobalConfig;
    let tmpDir: DirectoryResult;

    beforeEach(async () => {
      config = {};
      tmpDir = await dir({ unsafeCleanup: true });
      adminConfig = {
        localDir: join(tmpDir.path, 'local'),
        cacheDir: join(tmpDir.path, 'cache'),
      };

      GlobalConfig.set(adminConfig);
      delete process.env.CARGO_REGISTRIES_PRIVATE_CRATES_INDEX;
      delete process.env.CARGO_REGISTRIES_MCORBIN_INDEX;
    });

    afterEach(async () => {
      await tmpDir.cleanup();
      GlobalConfig.reset();
    });

    it('returns null for invalid toml', async () => {
      expect(
        await extractPackageFile('invalid toml', 'Cargo.toml', config)
      ).toBeNull();
    });

    it('returns null for empty dependencies', async () => {
      const cargotoml = '[dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config)
      ).toBeNull();
    });

    it('returns null for empty dev-dependencies', async () => {
      const cargotoml = '[dev-dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config)
      ).toBeNull();
    });

    it('returns null for empty custom target', async () => {
      const cargotoml = '[target."foo".dependencies]\n';
      expect(
        await extractPackageFile(cargotoml, 'Cargo.toml', config)
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
      await writeLocalFile('.cargo/config.toml', cargo6configtoml);
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('extracts registry urls from .cargo/config (legacy path)', async () => {
      await writeLocalFile('.cargo/config', cargo6configtoml);
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
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
      await writeLocalFile('.cargo/config', '[registries');

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('ignore cargo config registries with missing index', async () => {
      await writeLocalFile('.cargo/config', '[registries.mine]\nfoo = "bar"');

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('extracts original package name of renamed dependencies', async () => {
      const cargotoml =
        '[dependencies]\nboolector-solver = { package = "boolector", version = "0.4.0" }';
      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);

      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].packageName).toBe('boolector');
    });
  });
});
