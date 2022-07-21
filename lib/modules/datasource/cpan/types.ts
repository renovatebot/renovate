export interface MetaCpanResult {
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
