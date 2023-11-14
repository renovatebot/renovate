import { mocked } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import { getPrFooter } from './footer';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/footer', () => {
  it('renders empty footer', () => {
    expect(
      getPrFooter({
        manager: 'some-manager',
        baseBranch: 'base',
        branchName: 'branch',
        upgrades: [],
      }),
    ).toBe('');
  });

  it('renders prFooter', () => {
    template.safeCompile.mockImplementation((x) => x);
    expect(
      getPrFooter({
        manager: 'some-manager',
        baseBranch: 'base',
        branchName: 'branch',
        upgrades: [],
        prFooter: 'FOOTER',
      }),
    ).toMatchInlineSnapshot(`
      "
      ---

      FOOTER"
    `);
  });
});
