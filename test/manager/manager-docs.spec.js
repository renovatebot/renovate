const fs = require('fs-extra');

describe('manager readmes', () => {
  it('has same questions for all managers', async () => {
    const managers = (await fs.readdir('lib/manager')).filter(
      item => !item.includes('.')
    );
    expect(managers).toMatchSnapshot();
    let expectedHeaders;
    for (const manager of managers) {
      let readme;
      try {
        readme = await fs.readFile(
          'lib/manager/' + manager + '/readme.md',
          'utf8'
        );
      } catch (err) {
        // ignore missing file
      }
      if (readme) {
        const headers = readme
          .match(/\n#### (.*?)\n/g)
          .map(match => match.substring(6, match.length - 1));
        expectedHeaders = expectedHeaders || headers;
        expect(headers).toMatchSnapshot();
        expect(headers).toEqual(expectedHeaders);
      }
    }
  });
});
