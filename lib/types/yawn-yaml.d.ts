declare module 'yawn-yaml' {
  export default class YAWN {
    constructor(content: string);

    json: any;

    yaml: string;
  }
}

declare module 'yawn-yaml/cjs' {
  export default class YAWN {
    constructor(content: string);

    json: any;

    yaml: string;
  }
}
