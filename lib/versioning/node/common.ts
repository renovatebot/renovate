interface NodeJsSchedule {
  lts: string;
  maintenance: string;
  end: string;
  start: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;
