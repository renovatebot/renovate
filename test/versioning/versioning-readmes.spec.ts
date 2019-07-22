import { readdir, readFile } from 'fs-extra';

describe('versioning readmes', () => {
  it('has same questions for all version schemes', async () => {
    const managers = (await readdir('lib/versioning')).filter(
      item => !item.includes('.')
    );
    let expectedHeaders: string[];
    for (const manager of managers) {
      let readme: string;
      try {
        readme = await readFile(
          'lib/versioning/' + manager + '/readme.md',
          'utf8'
        );
      } catch (err) {
        // ignore missing file
      }
      if (readme) {
        const headers = readme
          .match(/\n## (.*?)\n/g)
          .map(match => match.substring(4, match.length - 1));
        expectedHeaders = expectedHeaders || headers;
        expect(headers).toEqual(expectedHeaders);
      }
    }
  });
});
