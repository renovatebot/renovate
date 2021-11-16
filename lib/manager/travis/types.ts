export type TravisNodeJs = string | Array<string>;

export interface TravisYaml {
  node_js?: TravisNodeJs;
  jobs?: TravisMatrix;
  matrix?: TravisMatrix;
}

export interface TravisMatrixItem {
  node_js?: TravisNodeJs;
}

export interface TravisMatrix {
  include?: Array<TravisMatrixItem>;
}
