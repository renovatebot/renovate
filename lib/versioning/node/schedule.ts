import dataFiles from '../../data-files.generated';

interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;
const dataInStringForm: string | undefined = dataFiles.get(
  'data/node-js-schedule.json'
);
export const nodeSchedule: NodeJsData = dataInStringForm
  ? JSON.parse(dataInStringForm)
  : {};
