const fs = require('fs');
const datasource = require('../../lib/datasource');
const got = require('got');

jest.mock('got');

const res1 = fs.readFileSync('test/_fixtures/nuget/nunit.json');

describe('datasource/nuget', () => {
  describe('getDependency', () => {
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(await datasource.getDependency('pkg:nuget/something')).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await datasource.getDependency('pkg:nuget/something')).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await datasource.getDependency('pkg:nuget/something')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      const res = await datasource.getDependency('pkg:nuget/nunit');
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
