// travis.yml syntax description:
//  - regular: https://docs.travis-ci.com/user/tutorial/
//  - matrix: https://docs.travis-ci.com/user/build-matrix/

export type TravisNodeJs = string | string[];

export interface TravisYaml {
  node_js?: TravisNodeJs;
  jobs?: TravisMatrix;
  matrix?: TravisMatrix;
}

export interface TravisMatrixItem {
  node_js?: TravisNodeJs;
}

export interface TravisMatrix {
  include?: TravisMatrixItem[];
}
