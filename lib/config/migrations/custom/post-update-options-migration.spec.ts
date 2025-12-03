import { PostUpdateOptionsMigration } from './post-update-options-migration';

describe('config/migrations/custom/post-update-options-migration', () => {
  it('should migrate properly', async () => {
    await expect(PostUpdateOptionsMigration).toMigrate(
      {
        postUpdateOptions: ['gomodTidy', 'gomodNoMassage'],
      },
      {
        postUpdateOptions: ['gomodTidy'],
      },
    );
  });
});
