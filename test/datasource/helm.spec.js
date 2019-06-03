const fs = require('fs');
const got = require('../../lib/util/got');
const { getPkgReleases } = require('../../lib/datasource/helm');

// Truncated index.yaml file
const indexYaml = fs.readFileSync(
  'test/datasource/helm/_fixtures/index.yaml',
  'utf8'
);

jest.mock('../../lib/util/got');

describe('datasource/helm', () => {
  describe('getPkgReleases', () => {
    it('returns null if lookupName was not provided', async () => {
      expect(
        await getPkgReleases({
          lookupName: undefined,
          repository: 'example-repository.com',
        })
      ).toBeNull();
    });
    it('returns null if repository was not provided', async () => {
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          repository: undefined,
        })
      ).toBeNull();
    });
    it('returns null for empty response', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({
          lookupName: 'non_existent_chart',
          repository: 'example-repository.com',
        })
      ).toBeNull();
    });
    it('returns null for missing response body', async () => {
      got.mockReturnValueOnce({
        body: undefined,
      });
      expect(
        await getPkgReleases({
          lookupName: 'non_existent_chart',
          repository: 'example-repository.com',
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockReturnValueOnce(Promise.reject({ statusCode: 404 }));
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          repository: 'example-repository.com',
        })
      ).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockReturnValueOnce(Promise.reject({ statusCode: 502 }));
      let e;
      try {
        await getPkgReleases({
          lookupName: 'some_chart',
          repository: 'example-repository.com',
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          repository: 'example-repository.com',
        })
      ).toBeNull();
    });
    it('returns null if index.yaml in response is empty', async () => {
      const res = { body: '# A comment' };
      got.mockReturnValueOnce(res);
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        repository: 'example-repository.com',
      });
      expect(releases).toBeNull();
    });
    it('returns null if index.yaml in response is invalid', async () => {
      const res = {
        body: `some
                     invalid:
                     [
                     yaml`,
      };
      got.mockReturnValueOnce(res);
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        repository: 'example-repository.com',
      });
      expect(releases).toBeNull();
    });
    it('returns null if lookupName is not in index.yaml', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        repository: 'example-repository.com',
      });
      expect(releases).toBeNull();
    });
    it('returns list of versions for normal response', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getPkgReleases({
        lookupName: 'ambassador',
        repository: 'example-repository.com',
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });
  });
});
