import { mocked, partial } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';
import { getPrHeader } from './header';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/header', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders empty header', () => {
    expect(
      getPrHeader(
        partial<BranchConfig>({
          manager: 'some-manager',
          branchName: 'branch',
          upgrades: [],
        })
      )
    ).toBe('');
  });

  it('renders prHeader', () => {
    template.compile.mockImplementation((x) => x);
    expect(
      getPrHeader(
        partial<BranchConfig>({
          manager: 'some-manager',
          branchName: 'branch',
          upgrades: [],
          prHeader: 'HEADER',
        })
      )
    ).toMatchInlineSnapshot(`
      "HEADER

      "
    `);
  });
});
