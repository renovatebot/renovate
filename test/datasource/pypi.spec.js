const fs = require('fs');
const pypi = require('../../lib/datasource/pypi');
const got = require('got');

jest.mock('got');

const res1 = fs.readFileSync('test/_fixtures/pypi/azure-cli-monitor.json');

describe('datasource/pypi', () => {
  describe('getDependency', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(await pypi.getDependency('something')).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await pypi.getDependency('something')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      expect(await pypi.getDependency('azure-cli-monitor')).toMatchSnapshot();
    });
    it('returns non-github home_page', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            home_page: 'https://microsoft.com',
          },
        },
      });
      expect(await pypi.getDependency('something')).toMatchSnapshot();
    });
  });
});
