const fs = require('fs');
const options = require('../lib/config/definitions').getOptions();

describe('docs', () => {
  const doc = fs.readFileSync('website/docs/configuration-options.md', 'utf8');
  const headers = doc
    .match(/\n## (.*?)\n/g)
    .map(match => match.substring(4, match.length - 1));
  const expectedOptions = options
    .filter(option => option.stage !== 'global')
    .filter(option => !option.admin)
    .filter(option => !option.parent)
    .map(option => option.name)
    .sort();
  it('has doc headers sorted alphabetically', () => {
    expect(headers).toEqual([...headers].sort());
  });
  it('has headers for every required option', () => {
    expect(headers).toEqual(expectedOptions);
  });
  const headers3 = doc
    .match(/\n### (.*?)\n/g)
    .map(match => match.substring(5, match.length - 1));
  headers3.sort();
  const expectedOptions3 = options
    .filter(option => option.stage !== 'global')
    .filter(option => !option.admin)
    .filter(option => option.parent)
    .map(option => option.name)
    .sort();
  expectedOptions3.sort();
  it('has headers for every required sub-option', () => {
    expect(headers3).toEqual(expectedOptions3);
  });
});
