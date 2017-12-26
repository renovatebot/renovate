const fs = require('fs');
const options = require('../lib/config/definitions').getOptions();

describe('docs', () => {
  const doc = fs.readFileSync(
    'website/docs/_posts/2017-10-05-configuration-options.md',
    'utf8'
  );
  const headers = doc
    .match(/\n## (.*?)\n/g)
    .map(match => match.substring(4, match.length - 1));
  const expectedOptions = options
    .filter(option => option.stage !== 'global')
    .filter(option => !option.admin)
    .map(option => option.name)
    .sort();
  it('has doc headers sorted alphabetically', () => {
    expect(headers).toEqual([...headers].sort());
  });
  it('has headers for every required option', () => {
    expect(headers).toEqual(expectedOptions);
  });
});
