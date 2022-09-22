import { mocked, partial } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';
import { getPrFooter } from './footer';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/footer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders empty footer', () => {
    expect(
      getPrFooter(
        partial<BranchConfig>({
          manager: 'some-manager',
          branchName: 'branch',
          upgrades: [],
        })
      )
    ).toBe('');
  });

  it('renders prFooter', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrFooter(
        partial<BranchConfig>({
          manager: 'some-manager',
          branchName: 'branch',
          upgrades: [],
          prFooter: 'FOOTER',
        })
      )
    ).toMatchInlineSnapshot(`
      "
      ---

      FOOTER"
    `);
  });
});
