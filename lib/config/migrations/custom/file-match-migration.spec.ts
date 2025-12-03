import { FileMatchMigration } from './file-match-migration';

describe('config/migrations/custom/file-match-migration', () => {
  it('migrates fileMatch of type string', async () => {
    await expect(FileMatchMigration).toMigrate(
      {
        fileMatch: 'filename',
      },
      {
        managerFilePatterns: ['/filename/'],
      },
    );
  });

  it('migrates fileMatch of type array', async () => {
    await expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
      },
      {
        managerFilePatterns: ['/filename1/', '/filename2/'],
      },
    );
  });

  it('concats fileMatch to managerFilePatterns', async () => {
    await expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
        managerFilePatterns: ['filename3'],
      },
      {
        managerFilePatterns: ['filename3', '/filename1/', '/filename2/'],
      },
    );
  });

  it('does nothing if fileMatch not defined', async () => {
    await expect(FileMatchMigration).toMigrate(
      {
        managerFilePatterns: ['filename3'],
      },
      {
        managerFilePatterns: ['filename3'],
      },
      false,
    );
  });
});
