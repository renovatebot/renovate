export class Identifier {
  value: string;
}

export class BzlmodVersion {
  release: Identifier[];
  prerelease: Identifier[];
  build: Identifier[];

  constructor(version) {
    this.release = [];
    this.prerelease = [];
    this.build = [];
  }
}
