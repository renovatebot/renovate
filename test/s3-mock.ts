import type { Url } from 'url';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
import {clear} from "./http-mock";
import {S3} from "@aws-sdk/client-s3";
import {Readable} from "stream";
import {loadFixture} from "./util";

interface S3Url {
  Bucket: string;
  Key: number;
}

let mockedObjects: any = {};

function objectKey(url: S3Url) {
  return `${url.Bucket}/${url.Key}`;
}

function listObject(url: S3Url) {
  console.log("listObject:", url);
  const k = objectKey(url);
  if (!mockedObjects[k]) {
    return Promise.reject({message: 'NotFound'})
  }
  return Promise.resolve({});
}

function getObject(url: S3Url) {
  console.log("getObject:", url);
  const k = objectKey(url);
  if (!mockedObjects[k]) {
    return Promise.reject({message: 'NotFound'})
  }
  const Body = new Readable();
  const content = mockedObjects[k];
  if (typeof content === 'string') {
    Body.push(content);
  }
  Body.push(null);
  return Promise.resolve({Body});
}

function mockObject(url: string, content: string | null) {
  console.log("mockObject:", url);
  //mockedObjects[objectKey(url)] = !content ? true : content;
}

const s3mock = {
  listObject,
  getObject,
  mockObject,
};
export default s3mock;

jest.mock('@aws-sdk/client-s3', () => ({
  S3: function (this: S3) {
    return { ...this, ...s3mock };
  },
}));

afterEach(() => {
  mockedObjects = {};
});
