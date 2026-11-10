import { partial } from '~test/util.ts';
import * as _template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';
import { getPrFooter } from './footer.ts';

vi.mock('../../../../../util/template/index.ts');
const template = vi.mocked(_template);

describe('workers/repository/update/pr/body/footer', () => {
  it('renders empty footer', () => {
    expect(
      getPrFooter(
        partial<BranchConfig>({
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'branch',
          upgrades: [],
        }),
      ),
    ).toBe('');
  });

  it('renders prFooter', () => {
    template.safeCompile.mockImplementation((x) => x);
    expect(
      getPrFooter(
        partial<BranchConfig>({
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'branch',
          upgrades: [],
          prFooter: 'FOOTER',
        }),
      ),
    ).toMatchInlineSnapshot(`
      "
      ---

      FOOTER"
    `);
  });
});
