import { FileMatchMigration } from './file-match-migration';

describe('config/migrations/custom/file-match-migration', () => {
  it('migrates fileMatch of type string', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: 'filename',
      },
      {
        managerFilePatterns: ['/filename/'],
      },
    );
  });

  it('migrates fileMatch of type array', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
      },
      {
        managerFilePatterns: ['/filename1/', '/filename2/'],
      },
    );
  });

  it('concats fileMatch to managerFilePatterns', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
        managerFilePatterns: ['filename3'],
      },
      {
        managerFilePatterns: ['/filename1/', '/filename2/', 'filename3'],
      },
    );
  });

  it('does nothing if fileMatch not defined', () => {
    expect(FileMatchMigration).toMigrate(
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
