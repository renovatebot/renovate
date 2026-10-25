export interface GoModManagerData {
  lineNumber?: number;
  multiLine?: boolean;
}

export interface ExtraDep {
  depName: string;
  currentValue: string;
  newValue: string;
}

export interface GoModulesTidyPlan {
  modules: string[];
  containsCycle: boolean;
}
