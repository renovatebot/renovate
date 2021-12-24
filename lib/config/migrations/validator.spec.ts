import { BinarySourceMigration } from './custom/binary-source-migration';
import { getCustomMigrationValidator } from './validator';

jest.mock('./custom/binary-source-migration');

describe('config/migrations/validator', () => {
  const validate = getCustomMigrationValidator(BinarySourceMigration);

  it('should use constructor', () => {
    validate({}, {}, false);

    expect(BinarySourceMigration).toHaveBeenCalledTimes(1);
    expect(BinarySourceMigration).toHaveBeenCalledWith({}, {});
  });
});
