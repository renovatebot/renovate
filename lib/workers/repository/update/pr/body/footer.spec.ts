import { mocked } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import { getPrFooter } from './footer';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/footer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders empty footer', () => {
    expect(getPrFooter({ branchName: 'branch', upgrades: [] })).toBe('');
  });

  it('renders prFooter', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrFooter({ branchName: 'branch', upgrades: [], prFooter: 'FOOTER' })
    ).toMatchInlineSnapshot(`
      "
      ---

      FOOTER"
    `);
  });
});
