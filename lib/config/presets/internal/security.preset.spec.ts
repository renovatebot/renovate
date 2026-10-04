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

  it.each(minimumReleaseAgeDatasourceNames)(
    'generates a strict rule plus unsupported-update-type warnings for datasource %s',
    (datasource) => {
      const suffix = datasource[0].toUpperCase() + datasource.slice(1);
      const packageRules = presets[`minimumReleaseAge${suffix}`].packageRules!;

      // the first rule strictly enforces minimumReleaseAge for this datasource
      expect(packageRules[0]).toEqual({
        internalChecksFilter: 'strict',
        matchDatasources: [datasource],
        minimumReleaseAge: expect.any(String),
      });

      // then we opt-out updateTypes that aren't supported
      const updateTypesWithoutReleaseTimestampSupport = packageRules.slice(1);
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

      for (const rule of updateTypesWithoutReleaseTimestampSupport) {
        expect(rule.matchDatasources).toEqual([datasource]);
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
