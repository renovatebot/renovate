export interface PythonSetup {
  extras_require: Record<string, string[]>;
  install_requires: string[];
}
