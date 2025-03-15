import { FileMatchMigration } from './file-match-migration';

describe('config/migrations/custom/file-match-migration', () => {
  it('migrates fileMatch of type string', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: 'filename',
      },
      {
        filePatterns: ['/filename/'],
      },
    );
  });

  it('migrates fileMatch of type array', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
      },
      {
        filePatterns: ['/filename1/', '/filename2/'],
      },
    );
  });

  it('concats fileMatch to filePatterns', () => {
    expect(FileMatchMigration).toMigrate(
      {
        fileMatch: ['filename1', 'filename2'],
        filePatterns: ['filename3'],
      },
      {
        filePatterns: ['/filename1/', '/filename2/', 'filename3'],
      },
    );
  });

  it('does nothing if fileMatch not defined', () => {
    expect(FileMatchMigration).toMigrate(
      {
        filePatterns: ['filename3'],
      },
      {
        filePatterns: ['filename3'],
      },
      false,
    );
  });
});
