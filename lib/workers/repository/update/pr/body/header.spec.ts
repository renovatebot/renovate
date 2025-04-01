import * as _template from '../../../../../util/template';
import { getPrHeader } from './header';

vi.mock('../../../../../util/template');
const template = vi.mocked(_template);

describe('workers/repository/update/pr/body/header', () => {
  it('renders empty header', () => {
    expect(
      getPrHeader({
        manager: 'some-manager',
        baseBranch: 'base',
        branchName: 'branch',
        upgrades: [],
      }),
    ).toBe('');
  });

  it('renders prHeader', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrHeader({
        manager: 'some-manager',
        branchName: 'branch',
        baseBranch: 'base',
        upgrades: [],
        prHeader: 'HEADER',
      }),
    ).toMatchInlineSnapshot(`
      "HEADER

      "
    `);
  });
});
