import modulesDataJson from '../../lib/config/modules.generated.json' with { type: 'json' };
import { getModulesData } from '../../tools/utils/modules-data.ts';

describe('other/validate-modules-data', () => {
  // if this test fails, run `pnpm generate`
  it('generated modules data is up to date', async () => {
    // JSON round trip drops `undefined` values like the generated file does
    const expected = JSON.parse(JSON.stringify(await getModulesData()));

    expect(modulesDataJson).toEqual(expected);
  }, 120_000);
});
