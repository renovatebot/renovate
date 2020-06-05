import fs from 'fs';
import _got from '../../util/got';
import { getReleases } from '.';

const got: any = _got;

// Truncated index.yaml file
const indexYaml = fs.readFileSync(
  'lib/datasource/helm/__fixtures__/index.yaml',
  'utf8'
);

jest.mock('../../util/got');

describe('datasource/helm', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null if lookupName was not provided', async () => {
      expect(
        await getReleases({
          lookupName: undefined,
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null if repository was not provided', async () => {
      expect(
        await getReleases({
          lookupName: 'some_chart',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty response', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getReleases({
          lookupName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null for missing response body', async () => {
      got.mockReturnValueOnce({
        body: undefined,
      });
      expect(
        await getReleases({
          lookupName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await getReleases({
          lookupName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getReleases({
          lookupName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
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
        await getReleases({
          lookupName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null if index.yaml in response is empty', async () => {
      const res = { body: '# A comment' };
      got.mockReturnValueOnce(res);
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
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
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });
    it('returns null if lookupName is not in index.yaml', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });
    it('returns list of versions for normal response', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getReleases({
        lookupName: 'ambassador',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });
    it('adds trailing slash to subdirectories', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      await getReleases({
        lookupName: 'ambassador',
        registryUrls: ['https://example-repository.com/subdir'],
      });
      expect(got.mock.calls[0][0]).toEqual(
        'https://example-repository.com/subdir/index.yaml'
      );
    });
  });
});
