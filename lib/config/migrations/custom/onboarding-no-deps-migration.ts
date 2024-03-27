import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class OnboardingNoDepsMigration extends AbstractMigration {
  override readonly propertyName = 'onboardingNoDeps';

  override run(value: unknown): void {
    if (is.boolean(value)) {
      this.rewrite(value ? 'enabled' : 'disabled');
    }
  }
}
