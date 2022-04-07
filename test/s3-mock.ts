import type { Url } from 'url';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
import {clear} from "./http-mock";

let mockedResources = {};

const mockS3 = {
  getObject: (url: {Bucket: string; Key: string}) => {
    console.log("getObject", url);
    return Promise.reject("TEST");
  }
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3: jest.fn(() => {
    return mockS3;
  })
}));

afterEach(() => {
  mockedResources = [];
});
