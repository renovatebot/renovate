import { Fixtures } from '../../../../test/fixtures';
import * as gleamManager from '.';

describe('modules/manager/gleam/extract', () => {
  it('should extract dev and prod dependencies', () => {
    const gleamTomlString = Fixtures.get('gleam.prod_and_dev_deps.toml');
    const extracted = gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted).toMatchSnapshot();
  });

  it('should extract dev only dependencies', () => {
    const gleamTomlString = Fixtures.get('gleam.dev_deps_only.toml');
    const extracted = gleamManager.extractPackageFile(
      gleamTomlString,
      'gleam.toml',
    );
    expect(extracted).toMatchSnapshot();
  });
});
