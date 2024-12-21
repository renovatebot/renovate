import dataFiles from '../../../data-files.generated';

interface LambdaSchedule {
  cycle: string;
  releaseLabel: string;

  /**
   * Either `true` if currently in support or a string indicating the date at which support will end
   */
  support: true | string;
}

export type LambdaData = Record<string, LambdaSchedule>;

const lambdaSchedule: LambdaData = JSON.parse(
  dataFiles.get('data/lambda-node-js-schedule.json')!,
);

export function findLambdaScheduleForVersion(
  version: string,
): LambdaSchedule | null {
  const majorVersionMatch = version.match(/^v?([0-9]+)\./);

  if (!majorVersionMatch?.[1]) {
    return null;
  }

  return lambdaSchedule[majorVersionMatch[1]];
}
