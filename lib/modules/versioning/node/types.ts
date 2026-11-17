export interface NodeJsSchedule {
  alpha?: string;
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;

export type NodeJsScheduleWithVersion = { version: string } & NodeJsSchedule;
