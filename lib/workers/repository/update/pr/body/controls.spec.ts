import { getControls } from './controls';

describe('workers/repository/update/pr/body/controls', () => {
  it('calls getControls', () => {
    expect(getControls()).toBe(
      `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box\n\n`,
    );
  });
});
