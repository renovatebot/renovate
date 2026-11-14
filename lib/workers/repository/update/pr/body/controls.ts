export function getRebaseCheckbox(enabled?: boolean): string {
  if (!enabled) {
    return '';
  }
  return `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box\n\n`;
}

export function getControls(): string {
  return getRebaseCheckbox(true);
}
