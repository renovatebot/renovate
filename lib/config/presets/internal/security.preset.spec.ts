import { getDatasources } from '../../../modules/datasource/index.ts';
import {
  minimumReleaseAgeDatasourceNames,
  presets,
} from './security.preset.ts';

describe('config/presets/internal/security.preset', () => {
  it('generates a preset for each configured datasource', () => {
    expect(Object.keys(presets)).toEqual(
      expect.arrayContaining([
        'minimumReleaseAgeCrate',
        'minimumReleaseAgeNpm',
        'minimumReleaseAgePypi',
      ]),
    );
  });

  it.each`
    datasource | manager
    ${'crate'} | ${'cargo'}
    ${'npm'}   | ${'npm'}
    ${'pypi'}  | ${'poetry'}
  `(
    'generates a strict rule plus unsupported-update-type warnings for datasource $datasource',
    ({ datasource, manager }) => {
      const suffix = datasource[0].toUpperCase() + datasource.slice(1);
      const preset = presets[`minimumReleaseAge${suffix}`];
      const packageRules = preset.packageRules!;

      // the manager config passes minimumReleaseAge to the package manager
      expect(preset[manager]).toEqual({ minimumReleaseAge: '3 days' });

      // which then is reset for the other datasources of the manager
      expect(packageRules[0]).toMatchObject({
        matchManagers: [manager],
        matchDatasources: [`!${datasource}`],
        minimumReleaseAge: null,
      });

      // the next rule strictly enforces minimumReleaseAge for this datasource
      expect(packageRules[1]).toEqual({
        internalChecksFilter: 'strict',
        matchDatasources: [datasource],
        minimumReleaseAge: '3 days',
      });

      // then we opt-out updateTypes that aren't supported
      const updateTypesWithoutReleaseTimestampSupport = packageRules.slice(2);
      expect(
        updateTypesWithoutReleaseTimestampSupport.map(
          (rule) => rule.matchUpdateTypes,
        ),
      ).toEqual([
        ['lockFileMaintenance'],
        ['replacement'],
        ['pin'],
        ['bump', 'lockfileUpdate', 'rollback'],
      ]);

      const [lockFileMaintenanceRule, ...otherRules] =
        updateTypesWithoutReleaseTimestampSupport;
      // lock file maintenance has no datasource
      expect(lockFileMaintenanceRule.matchManagers).toEqual([manager]);
      expect(lockFileMaintenanceRule.matchDatasources).toBeUndefined();
      for (const rule of otherRules) {
        expect(rule.matchDatasources).toEqual([datasource]);
      }
      for (const rule of updateTypesWithoutReleaseTimestampSupport) {
        expect(rule.minimumReleaseAge).toBeNull();
        expect(rule.prBodyNotes).toHaveLength(1);
      }
    },
  );

  it.each(minimumReleaseAgeDatasourceNames)(
    'only exposes datasource %s because it supports release timestamps',
    (datasource) => {
      // A `minimumReleaseAge` preset only makes sense when the datasource can report a release timestamp, otherwise every update would be held back under the default `minimumReleaseAgeBehaviour`
      expect(getDatasources().get(datasource)).toMatchObject({
        releaseTimestampSupport: true,
      });
    },
  );
});
