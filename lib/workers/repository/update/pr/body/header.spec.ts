import { mocked } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import { getPrHeader } from './header';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/header', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders empty header', () => {
    expect(getPrHeader({ branchName: 'branch', upgrades: [] })).toBe('');
  });

  it('renders prHeader', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrHeader({ branchName: 'branch', upgrades: [], prHeader: 'HEADER' })
    ).toMatchInlineSnapshot(`
      "HEADER

      "
    `);
  });
});
