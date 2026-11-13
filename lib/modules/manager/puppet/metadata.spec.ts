import { PuppetForgeDatasource } from '../../datasource/puppet-forge/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import { extractPackageFile } from './index.ts';

const packageFile = 'metadata.json';

describe('modules/manager/puppet/metadata', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid json', () => {
      expect(extractPackageFile('{', packageFile)).toBeNull();
    });

    it('returns null if dependencies is not an array', () => {
      expect(
        extractPackageFile(
          JSON.stringify({ dependencies: { name: 'puppetlabs/stdlib' } }),
          packageFile,
        ),
      ).toBeNull();
    });

    it('returns null if there are no dependencies', () => {
      expect(extractPackageFile('{}', packageFile)).toBeNull();
      expect(
        extractPackageFile(JSON.stringify({ dependencies: [] }), packageFile),
      ).toBeNull();
    });

    it('ignores dependencies without a name', () => {
      expect(
        extractPackageFile(
          JSON.stringify({
            dependencies: [{ version_requirement: '>= 1.0.0' }, 'nope'],
          }),
          packageFile,
        ),
      ).toBeNull();
    });

    it('extracts dependencies with version_requirement', () => {
      const res = extractPackageFile(
        JSON.stringify({
          name: 'example-mymodule',
          version: '1.2.3',
          dependencies: [
            {
              name: 'puppetlabs/stdlib',
              version_requirement: '>= 9.0.0 < 10.0.0',
            },
            {
              name: 'puppetlabs/inifile',
              version_requirement: '>= 1.6.0 < 7.0.0',
            },
          ],
        }),
        'modules/mymodule/metadata.json',
      );

      expect(res).toEqual({
        deps: [
          {
            depName: 'puppetlabs/stdlib',
            depType: 'dependencies',
            packageName: 'puppetlabs/stdlib',
            currentValue: '>= 9.0.0 < 10.0.0',
            datasource: PuppetForgeDatasource.id,
            versioning: npmVersioning.id,
          },
          {
            depName: 'puppetlabs/inifile',
            depType: 'dependencies',
            packageName: 'puppetlabs/inifile',
            currentValue: '>= 1.6.0 < 7.0.0',
            datasource: PuppetForgeDatasource.id,
            versioning: npmVersioning.id,
          },
        ],
      });
    });

    it('normalizes dash-form names for the datasource but keeps depName as written', () => {
      const res = extractPackageFile(
        JSON.stringify({
          dependencies: [
            { name: 'puppetlabs-stdlib', version_requirement: '9.x' },
          ],
        }),
        packageFile,
      );

      expect(res).toEqual({
        deps: [
          {
            depName: 'puppetlabs-stdlib',
            depType: 'dependencies',
            packageName: 'puppetlabs/stdlib',
            currentValue: '9.x',
            datasource: PuppetForgeDatasource.id,
            versioning: npmVersioning.id,
          },
        ],
      });
    });

    it('skips dependencies without version_requirement', () => {
      const res = extractPackageFile(
        JSON.stringify({ dependencies: [{ name: 'puppetlabs/stdlib' }] }),
        packageFile,
      );

      expect(res).toEqual({
        deps: [
          {
            depName: 'puppetlabs/stdlib',
            depType: 'dependencies',
            packageName: 'puppetlabs/stdlib',
            datasource: PuppetForgeDatasource.id,
            versioning: npmVersioning.id,
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('skips dependencies with an invalid name', () => {
      const res = extractPackageFile(
        JSON.stringify({
          dependencies: [
            { name: 'stdlib', version_requirement: '>= 9.0.0' },
            { name: 'puppetlabs/std lib', version_requirement: '>= 9.0.0' },
          ],
        }),
        packageFile,
      );

      expect(res).toEqual({
        deps: [
          { depName: 'stdlib', skipReason: 'invalid-name' },
          { depName: 'puppetlabs/std lib', skipReason: 'invalid-name' },
        ],
      });
    });
  });
});
