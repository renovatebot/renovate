import { _ } from '../../../../../i18n';

export function getControls(): string {
  return `\n\n---\n\n - [ ] <!-- rebase-check -->` + _('If you want to rebase/retry this PR, check this box') + '\n\n';
}
