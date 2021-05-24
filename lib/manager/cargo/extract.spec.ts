import { dir } from 'tmp-promise';
import { join } from 'upath';
import { getName, loadFixture } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import { writeLocalFile } from '../../util/fs';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from './extract';

const cargo1toml = loadFixture('Cargo.1.toml');
const cargo2toml = loadFixture('Cargo.2.toml');
const cargo3toml = loadFixture('Cargo.3.toml');
const cargo4toml = loadFixture('Cargo.4.toml');
const cargo5toml = loadFixture('Cargo.5.toml');
const cargo6configtoml = loadFixture('cargo.6.config.toml');
const cargo6toml = loadFixture('Cargo.6.toml');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    let config: ExtractConfig;
    let adminConfig: RepoAdminConfig;

    beforeEach(async () => {
      config = {};
      const tmpDir = await dir();
      adminConfig = {
        localDir: join(tmpDir.path, 'local'),
        cacheDir: join(tmpDir.path, 'cache'),
      };

      setAdminConfig(adminConfig);
    });
    afterEach(() => {
      setAdminConfig();
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
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(15);
    });
    it('extracts multiple dependencies advanced', async () => {
      const res = await extractPackageFile(cargo2toml, 'Cargo.toml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(18 + 6 + 1);
    });
    it('handles inline tables', async () => {
      const res = await extractPackageFile(cargo3toml, 'Cargo.toml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
    it('handles standard tables', async () => {
      const res = await extractPackageFile(cargo4toml, 'Cargo.toml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
    it('extracts platform specific dependencies', async () => {
      const res = await extractPackageFile(cargo5toml, 'Cargo.toml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
    it('extracts registry urls from .cargo/config.toml', async () => {
      await writeLocalFile('.cargo/config.toml', cargo6configtoml);
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('extracts registry urls from .cargo/config (legacy path)', async () => {
      await writeLocalFile('.cargo/config', cargo6configtoml);
      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('skips unknown registries', async () => {
      const cargotoml =
        '[dependencies]\nfoobar = { version = "0.1.0", registry = "not-listed" }';
      const res = await extractPackageFile(cargotoml, 'Cargo.toml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('fails to parse cargo config with invalid TOML', async () => {
      await writeLocalFile('.cargo/config', '[registries');

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('ignore cargo config registries with missing index', async () => {
      await writeLocalFile('.cargo/config', '[registries.mine]\nfoo = "bar"');

      const res = await extractPackageFile(cargo6toml, 'Cargo.toml', {
        ...config,
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
