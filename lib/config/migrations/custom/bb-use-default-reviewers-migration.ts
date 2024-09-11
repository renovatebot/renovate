import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class BbUseDefaultReviewersMigration extends AbstractMigration {
  override readonly propertyName = 'bbUseDefaultReviewers';

  override run(value: unknown, key: string, parentKey?: string): void {
    if (is.boolean(value) && parentKey !== 'prOptions') {
      const prOptions = this.get('prOptions') ?? {};
      this.delete();
      this.setHard('prOptions', {
        ...prOptions,
        bbUseDefaultReviewers: value,
      });
    }
  }
}
