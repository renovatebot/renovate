/**
 * https://fastapi.metacpan.org/v1/file/_mapping
 */
export interface MetaCpanApiFile {
  module: {
    name: string;
    version?: string;
  }[];
  distribution: string;
  date: string;
  deprecated: boolean;
  maturity: string;
}

/**
 * https://github.com/metacpan/metacpan-api/blob/master/docs/API-docs.md#available-fields
 */
export interface MetaCpanApiFileSearchResult {
  hits: {
    hits: {
      _source: MetaCpanApiFile;
    }[];
  };
}
