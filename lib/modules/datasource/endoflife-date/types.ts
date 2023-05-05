// represents a "cycle" on endoflife.date
export interface EndoflifeDateVersion {
  cycle: string | number;
  releaseDate?: string;
  eol?: string | boolean;
  latest?: string;
  link?: string | null;
  lts?: string | boolean;
  support?: string | boolean;
  discontinued?: string | boolean;
}
