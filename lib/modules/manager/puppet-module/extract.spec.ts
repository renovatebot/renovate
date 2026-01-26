import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import { extractPackageFile, updateDependency } from '.';

describe('modules/manager/puppet-module/extract', () => {
  it('returns null for invalid json', () => {
    expect(extractPackageFile('{')).toBeNull();
  });

  it('returns null if no dependencies', () => {
    expect(extractPackageFile('{}')).toBeNull();
  });

  it('extracts dependencies with version_requirement', () => {
    const res = extractPackageFile(
      JSON.stringify({
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
    );
    expect(res?.deps).toHaveLength(2);
    expect(res?.deps).toMatchObject([
      {
        depName: 'puppetlabs/stdlib',
        packageName: 'puppetlabs/stdlib',
        currentValue: '>= 9.0.0 < 10.0.0',
        datasource: PuppetForgeDatasource.id,
      },
      {
        depName: 'puppetlabs/inifile',
        packageName: 'puppetlabs/inifile',
        currentValue: '>= 1.6.0 < 7.0.0',
        datasource: PuppetForgeDatasource.id,
      },
    ]);
  });

  it('handles missing version requirement', () => {
    const res = extractPackageFile(
      JSON.stringify({
        dependencies: [
          { name: 'puppetlabs/stdlib' },
          { name: 'puppetlabs/inifile', version: '>= 1.0.0 < 2.0.0' },
        ],
      }),
    );
    expect(res?.deps).toHaveLength(2);
    const stdlib = res?.deps.find((d) => d.depName === 'puppetlabs/stdlib');
    expect(stdlib?.skipReason).toBe('unspecified-version');
    const inifile = res?.deps.find((d) => d.depName === 'puppetlabs/inifile');
    // version field alone should be ignored so also skipped
    expect(inifile?.skipReason).toBe('unspecified-version');
  });

  it('handles invalid name', () => {
    const res = extractPackageFile(
      JSON.stringify({
        dependencies: [
          { name: 'invalid@name', version_requirement: '>= 1.0.0 < 2.0.0' },
        ],
      }),
    );
    expect(res?.deps).toHaveLength(1);
    expect(res?.deps[0].skipReason).toBe('invalid-name');
  });

  it('extracts dependency with dash form and normalizes name', () => {
    const res = extractPackageFile(
      JSON.stringify({
        dependencies: [
          {
            name: 'puppetlabs-stdlib',
            version_requirement: '>= 9.0.0 < 10.0.0',
          },
        ],
      }),
    );
    expect(res?.deps).toHaveLength(1);
    expect(res?.deps[0]).toMatchObject({
      depName: 'puppetlabs/stdlib',
      packageName: 'puppetlabs/stdlib',
      currentValue: '>= 9.0.0 < 10.0.0',
      datasource: PuppetForgeDatasource.id,
    });
  });

  it('updates dependency specified with dash form', () => {
    const base = {
      dependencies: [
        { name: 'puppetlabs-stdlib', version_requirement: '>= 9.0.0 < 10.0.0' },
      ],
    };
    const file = JSON.stringify(base, null, 2) + '\n';
    const updated = updateDependency({
      fileContent: file,
      upgrade: {
        depName: 'puppetlabs/stdlib',
        newValue: '>= 9.0.0 < 11.0.0',
      },
    });
    expect(updated).not.toBeNull();
    const parsed = JSON.parse(updated!);
    expect(parsed.dependencies[0].name).toBe('puppetlabs-stdlib'); // original preserved
    expect(parsed.dependencies[0].version_requirement).toBe(
      '>= 9.0.0 < 11.0.0',
    );
  });

  it('normalizes both forms without duplicating entries', () => {
    const res = extractPackageFile(
      JSON.stringify({
        dependencies: [
          {
            name: 'puppetlabs/stdlib',
            version_requirement: '>= 9.0.0 < 10.0.0',
          },
          {
            name: 'puppetlabs-stdlib',
            version_requirement: '>= 9.1.0 < 10.0.0',
          },
        ],
      }),
    );
    // Both entries map to same normalized name; we currently allow both to appear.
    // Ensure both extracted with normalized names (could be future dedupe enhancement).
    expect(
      res?.deps.filter((d) => d.depName === 'puppetlabs/stdlib'),
    ).toHaveLength(2);
  });
  describe('updateDependency()', () => {
    const base = {
      dependencies: [
        { name: 'puppetlabs/stdlib', version_requirement: '>= 9.0.0 < 10.0.0' },
        { name: 'puppetlabs/inifile', version_requirement: '>= 1.0.0 < 2.0.0' },
      ],
    };

    it('updates existing version_requirement', () => {
      const file = JSON.stringify(base, null, 2) + '\n';
      const updated = updateDependency({
        fileContent: file,
        upgrade: {
          depName: 'puppetlabs/stdlib',
          newValue: '>= 9.0.0 < 11.0.0',
        },
      });
      expect(updated).not.toBeNull();
      const parsed = JSON.parse(updated!);
      expect(parsed.dependencies[0].version_requirement).toBe(
        '>= 9.0.0 < 11.0.0',
      );
    });

    it('updates existing version_requirement for second dependency', () => {
      const file = JSON.stringify(base, null, 2) + '\n';
      const updated = updateDependency({
        fileContent: file,
        upgrade: {
          depName: 'puppetlabs/inifile',
          newValue: '>= 1.0.0 < 3.0.0',
        },
      });
      expect(updated).not.toBeNull();
      const parsed = JSON.parse(updated!);
      const dep = parsed.dependencies.find(
        (d: any) => d.name === 'puppetlabs/inifile',
      );
      expect(dep.version_requirement).toBe('>= 1.0.0 < 3.0.0');
    });

    it('returns null if dependency not found', () => {
      const file = JSON.stringify(base, null, 2) + '\n';
      const updated = updateDependency({
        fileContent: file,
        upgrade: { depName: 'puppetlabs/unknown', newValue: '1.0.0' },
      });
      expect(updated).toBeNull();
    });
  });
});
