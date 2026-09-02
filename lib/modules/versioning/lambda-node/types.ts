export interface LambdaSchedule {
  cycle: string;

  /**
   * Either `true` if currently in support or a string indicating the date at which support will end
   */
  support: true | string;
}

export type LambdaData = Record<string, LambdaSchedule>;
