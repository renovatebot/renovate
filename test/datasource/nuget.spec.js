const fs = require('fs');
const nuget = require('../../lib/datasource/nuget');
const got = require('got');

const withRepositoryInNuspec = fs.readFileSync(
  'test/_fixtures/nuget/sample.nuspec',
  'utf8'
);
jest.mock('got');

describe('api/nuget', () => {
  describe('getVersions', () => {
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({});
      const nuspec = await nuget.getVersions('MyPackage');
      expect(nuspec).toBe(null);
    });
    it('returns versions list', async () => {
      got.mockReturnValueOnce({
        body: { versions: ['1.0.0', '2.0.0', '2.1.0', '2.1.1-alpha'] },
      });
      const versions = await nuget.getVersions('MyPackage');
      expect(versions).toHaveLength(4);
    });
  });

  describe('getNuspec', () => {
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({});
      const nuspec = await nuget.getNuspec('MyPackage', '1.0.0.0');
      expect(nuspec).toBe(null);
    });
    it('returns json-ified nuspec with attributes', async () => {
      got.mockReturnValueOnce({ headers: {}, body: withRepositoryInNuspec });
      const nuspec = await nuget.getNuspec('MyPackage', '1.0.0.0');

      expect(nuspec.metadata.id).toBe('Newtonsoft.Json');
      expect(nuspec.metadata.version).toBe('11.0.2');
      expect(nuspec.metadata.repository['@_url']).toBe(
        'https://github.com/JamesNK/Newtonsoft.Json.git'
      );
    });
  });
});
