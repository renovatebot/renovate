/**
 * https://github.com/metacpan/metacpan-api/blob/master/docs/API-docs.md#available-fields
 */
export interface MetaCpanFileSearchResult {
  hits: {
    hits: {
      _source: {
        module: {
          name: string;
          version?: string;
        }[];
        distribution: string;
        date: string;
        deprecated: boolean;
        maturity: string;
      };
    }[];
  };
}
