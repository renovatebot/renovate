import { AbstractMigration } from './abstract-migration';

describe('config/migrations/base/abstract-migration', () => {
  it('should not allow to use method rewrite', () => {
    class CustomMigration extends AbstractMigration {
      override readonly propertyName = /^foo/;

      override run(): void {
        this.rewrite(false);
      }
    }
    const customMigration = new CustomMigration(
      {
        fooBar: true,
      },
      {},
    );

    expect(() => customMigration.run()).toThrow();
  });

  it('should not allow to use method delete', () => {
    class CustomMigration extends AbstractMigration {
      override readonly propertyName = /^foo/;

      override run(): void {
        this.delete();
      }
    }
    const customMigration = new CustomMigration(
      {
        fooBar: true,
      },
      {},
    );

    expect(() => customMigration.run()).toThrow();
  });
});
