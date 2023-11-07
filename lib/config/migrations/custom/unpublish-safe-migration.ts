import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class UnpublishSafeMigration extends AbstractMigration {
  private static readonly SUPPORTED_VALUES = [
    ':unpublishSafe',
    'default:unpublishSafe',
    'npm:unpublishSafe',
  ];

  override readonly deprecated = true;
  override readonly propertyName = 'unpublishSafe';

  override run(value: unknown): void {
    const extendsValue = this.get('extends');
    const newExtendsValue = Array.isArray(extendsValue) ? extendsValue : [];

    if (value === true) {
      if (is.string(extendsValue)) {
        newExtendsValue.push(extendsValue);
      }

      if (newExtendsValue.every((item) => !this.isSupportedValue(item))) {
        newExtendsValue.push('npm:unpublishSafe');
      }

      this.setHard(
        'extends',
        newExtendsValue.map((item) => {
          if (this.isSupportedValue(item)) {
            return 'npm:unpublishSafe';
          }

          return item;
        }),
      );
    }
  }

  private isSupportedValue(value: string): boolean {
    return UnpublishSafeMigration.SUPPORTED_VALUES.includes(value);
  }
}
