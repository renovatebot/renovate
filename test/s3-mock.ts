import { Readable } from 'stream';
import type { S3 } from '@aws-sdk/client-s3';
import { afterEach } from '@jest/globals';

interface S3Url {
  Bucket: string;
  Key: number;
}

let mockedObjects: any = {};
let mockedTimestamps: any = {};

function objectKey(url: S3Url) {
  return `s3://${url.Bucket}/${url.Key}`;
}

function headObject(url: S3Url) {
  const k = objectKey(url);
  if (!mockedObjects[k]) {
    return Promise.reject({ message: 'NotFound' });
  }
  const LastModified = mockedTimestamps[k];
  return Promise.resolve({ LastModified });
}

function getObject(url: S3Url) {
  const k = objectKey(url);
  if (!mockedObjects[k]) {
    return Promise.reject({ message: 'NotFound' });
  }
  const Body = new Readable();
  const content = mockedObjects[k];
  if (typeof content === 'string') {
    Body.push(content);
  }
  Body.push(null);
  const LastModified = mockedTimestamps[k];
  return Promise.resolve({ Body, LastModified });
}

function mockObject(url: string, content?: string, headers?: any) {
  mockedObjects[url] = content ? content : true;
  if (headers?.['Last-Modified']) {
    mockedTimestamps[url] = headers['Last-Modified'];
  }
}

const s3mock = {
  headObject,
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
  mockedTimestamps = {};
});
