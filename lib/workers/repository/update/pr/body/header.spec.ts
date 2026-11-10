import { partial } from '~test/util.ts';
import * as _template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';
import { getPrHeader } from './header.ts';

vi.mock('../../../../../util/template/index.ts');
const template = vi.mocked(_template);

describe('workers/repository/update/pr/body/header', () => {
  it('renders empty header', () => {
    expect(
      getPrHeader(
        partial<BranchConfig>({
          manager: 'some-manager',
          baseBranch: 'base',
          branchName: 'branch',
          upgrades: [],
        }),
      ),
    ).toBe('');
  });

  it('renders prHeader', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrHeader(
        partial<BranchConfig>({
          manager: 'some-manager',
          branchName: 'branch',
          baseBranch: 'base',
          upgrades: [],
          prHeader: 'HEADER',
        }),
      ),
    ).toMatchInlineSnapshot(`
      "HEADER

      "
    `);
  });
});
