import { mocked } from '../../../../../../test/util';
import * as _template from '../../../../../util/template';
import { getPrExtraNotes, getPrNotes } from './notes';

jest.mock('../../../../../util/template');
const template = mocked(_template);

describe('workers/repository/update/pr/body/notes', () => {
  it('renders notes', () => {
    template.compile.mockImplementation((x) => x);
    const res = getPrNotes({
      manager: 'some-manager',
      branchName: 'branch',
      baseBranch: 'base',
      upgrades: [
        {
          manager: 'some-manager',
          branchName: 'branch',
          prBodyNotes: ['NOTE'],
        },
      ],
    });
    expect(res).toContain('NOTE');
  });

  it('handles render error', () => {
    template.compile.mockImplementationOnce(() => {
      throw new Error('unknown');
    });
    const res = getPrNotes({
      manager: 'some-manager',
      branchName: 'branch',
      baseBranch: 'base',
      upgrades: [
        {
          manager: 'some-manager',
          branchName: 'branch',
          prBodyNotes: ['{{NOTE}}'],
        },
      ],
    });
    expect(res).toContain('{{NOTE}}');
  });

  it('handles extra notes', () => {
    const res = getPrExtraNotes({
      manager: 'some-manager',
      branchName: 'branch',
      baseBranch: 'base',
      upgrades: [
        { manager: 'some-manager', branchName: 'branch', gitRef: true },
      ],
      updateType: 'lockFileMaintenance',
      isPin: true,
    });
    expect(res).toContain(
      'If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.',
    );
    expect(res).toContain(
      'This Pull Request updates lock files to use the latest dependency versions.',
    );
    expect(res).toContain(
      "Add the preset `:preserveSemverRanges` to your config if you don't want to pin your dependencies.",
    );
  });
});
