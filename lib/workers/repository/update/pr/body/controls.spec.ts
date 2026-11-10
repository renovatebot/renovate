import { getControls, getRebaseCheckbox } from './controls.ts';

describe('workers/repository/update/pr/body/controls', () => {
  it('calls getControls', () => {
    expect(getControls()).toBe(
      `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box\n\n`,
    );
  });

  it('returns an empty string when the checkbox is disabled', () => {
    expect(getRebaseCheckbox()).toBe('');
    expect(getRebaseCheckbox(false)).toBe('');
  });

  it('returns the checkbox when enabled', () => {
    expect(getRebaseCheckbox(true)).toBe(getControls());
  });
});
