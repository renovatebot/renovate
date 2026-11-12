import { migrateConfig } from '../../migration.ts';
import { ConstraintsMigration } from './constraints-migration.ts';

describe('config/migrations/custom/constraints-migration', () => {
  it.each`
    erlang                     | expected
    ${'^26.2.1'}               | ${'>=26.2.1 <27'}
    ${'^0.6.1'}                | ${'>=0.6.1 <0.7'}
    ${'^0.0.3'}                | ${'>=0.0.3 <0.0.4'}
    ${'^0.0.0'}                | ${'>=0.0.0 <0.0.1'}
    ${'^26'}                   | ${'26'}
    ${'^26.2'}                 | ${'>=26.2 <27'}
    ${'^v26.2.1'}              | ${'>=v26.2.1 <v27'}
    ${'^26.2.1-rc.1'}          | ${'>=26.2.1-rc.1 <27'}
    ${'~26.2.1'}               | ${'>=26.2.1 <26.3'}
    ${'~>26.2.1'}              | ${'>=26.2.1 <26.3'}
    ${'~> 26.2.1'}             | ${'>=26.2.1 <26.3'}
    ${'~ 26.2.1'}              | ${'>=26.2.1 <26.3'}
    ${'~26'}                   | ${'26'}
    ${'~26.2'}                 | ${'26.2'}
    ${'~> 26.0'}               | ${'26.0'}
    ${'^26.2.1 || ~> 27.1.0'}  | ${'>=26.2.1 <27 || >=27.1.0 <27.2'}
    ${'>=26.2 <28 || ^28.1.0'} | ${'>=26.2 <28 || >=28.1.0 <29'}
    ${'=26.2.1'}               | ${'26.2.1'}
    ${'== 26.2.1'}             | ${'26.2.1'}
    ${'>=26.2 <28 || =28.1.0'} | ${'>=26.2 <28 || 28.1.0'}
    ${'^1.2.x'}                | ${'>=1.2 <2'}
    ${'~>1.2.3.x'}             | ${'>=1.2.3 <1.3'}
    ${'^1.x'}                  | ${'1'}
    ${'^1.x.3'}                | ${'1'}
    ${'=26.x.1'}               | ${'26'}
    ${'~>26.2.*.1'}            | ${'26.2'}
  `(
    'migrates the erlang constraint "$erlang" to "$expected"',
    async ({ erlang, expected }) => {
      await expect(ConstraintsMigration).toMigrate(
        { constraints: { erlang, ruby: '~> 3.2' } },
        { constraints: { erlang: expected, ruby: '~> 3.2' } },
      );
    },
  );

  it.each`
    constraints
    ${{ erlang: '>=26.2 <27' }}
    ${{ erlang: '<=26 || >=28' }}
    ${{ erlang: '26' }}
    ${{ erlang: '^foo' }}
    ${{ ruby: '~> 3.2' }}
    ${'~> 26.0'}
  `('keeps the constraints $constraints', async ({ constraints }) => {
    await expect(ConstraintsMigration).toMigrate(
      { constraints },
      { constraints },
      false,
    );
  });

  it('migrates the erlang constraint in packageRules', () => {
    const packageRule = {
      matchManagers: ['mix'],
      constraints: { erlang: '~> 26.0' },
    };

    const { isMigrated, migratedConfig } = migrateConfig({
      packageRules: [packageRule],
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig.packageRules).toEqual([
      { matchManagers: ['mix'], constraints: { erlang: '26.0' } },
    ]);
  });
});
