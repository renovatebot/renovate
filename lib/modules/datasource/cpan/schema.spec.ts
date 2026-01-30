import { MetaCpanApiFileSearchResponse } from './schema.ts';

describe('modules/datasource/cpan/schema', () => {
  describe('MetaCpanApiFileSearchResponse', () => {
    it('filters out entries with empty module arrays', () => {
      const response = {
        hits: {
          hits: [
            {
              _source: {
                module: [],
                distribution: 'Test-Package',
                date: '2023-01-01T00:00:00',
                deprecated: false,
                maturity: 'released',
                status: 'latest',
              },
            },
          ],
        },
      };
      const result = MetaCpanApiFileSearchResponse.parse(response);
      expect(result).toEqual([]);
    });

    it('filters out entries where module has no version', () => {
      const response = {
        hits: {
          hits: [
            {
              _source: {
                module: [{ name: 'Test::Module', version: '' }],
                distribution: 'Test-Package',
                date: '2023-01-01T00:00:00',
                deprecated: false,
                maturity: 'released',
                status: 'latest',
              },
            },
          ],
        },
      };
      const result = MetaCpanApiFileSearchResponse.parse(response);
      expect(result).toEqual([]);
    });

    it('includes valid entries', () => {
      const response = {
        hits: {
          hits: [
            {
              _source: {
                module: [{ name: 'Test::Module', version: '1.0' }],
                distribution: 'Test-Package',
                date: '2023-01-01T00:00:00',
                deprecated: false,
                maturity: 'released',
                status: 'latest',
              },
            },
          ],
        },
      };
      const result = MetaCpanApiFileSearchResponse.parse(response);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        version: '1.0',
        distribution: 'Test-Package',
        isDeprecated: false,
        isStable: true,
        isLatest: true,
      });
    });
  });
});
