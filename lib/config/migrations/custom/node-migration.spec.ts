import { NodeMigration } from './node-migration';

describe('config/migrations/custom/node-migration', () => {
  it('should migrate node to travis', () => {
    expect(NodeMigration).toMigrate(
      {
        node: { enabled: true },
      },
      {
        travis: { enabled: true },
      },
    );
  });

  it('should not delete node in case it has more than one property', () => {
    expect(NodeMigration).toMigrate(
      {
        node: { enabled: true, automerge: false },
      },
      {
        node: { automerge: false },
        travis: { enabled: true },
      },
    );
  });
});
