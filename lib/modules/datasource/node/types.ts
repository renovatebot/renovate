export interface NodeRelease {
  /** release date */
  date: string;

  /** Is LTS release */
  lts: false | string;

  /** included files */
  files: string[];

  /** npm version */
  npm: string;

  /** Is security release */
  security: boolean;

  /** node version */
  version: string;
}
