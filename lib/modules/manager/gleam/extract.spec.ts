import { codeBlock } from 'common-tags';
import * as gleamManager from '.';

describe('modules/manager/gleam/extract', () => {
  it('should extract dev and prod dependencies', () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dependencies]
      gleam_json = "~> 0.6.0"

      [dev-dependencies]
      gleeunit = "~> 1.0"
    `;
    const extracted = gleamManager.extractPackageFile(gleamTomlString);
    expect(extracted?.deps).toEqual([
      {
        currentValue: '~> 0.6.0',
        datasource: 'hex',
        depName: 'gleam_json',
        depType: 'dependencies',
      },
      {
        currentValue: '~> 1.0',
        datasource: 'hex',
        depName: 'gleeunit',
        depType: 'devDependencies',
      },
    ]);
  });

  it('should extract dev only dependencies', () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [dev-dependencies]
      gleeunit = "~> 1.0"
    `;
    const extracted = gleamManager.extractPackageFile(gleamTomlString);
    expect(extracted?.deps).toEqual([
      {
        currentValue: '~> 1.0',
        datasource: 'hex',
        depName: 'gleeunit',
        depType: 'devDependencies',
      },
    ]);
  });

  it('should return null when no dependencies are found', () => {
    const gleamTomlString = codeBlock`
      name = "test_gleam_toml"
      version = "1.0.0"

      [unknown]
      gleam_http = "~> 3.6.0"
    `;
    const extracted = gleamManager.extractPackageFile(gleamTomlString);
    expect(extracted).toBeNull();
  });
});
