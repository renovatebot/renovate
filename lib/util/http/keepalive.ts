import Agent, { HttpsAgent } from 'agentkeepalive';
import type { Agents } from 'got';

const http = new Agent();
const https = new HttpsAgent();

const keepaliveAgents: Agents = {
  http,
  https,
};

export { keepaliveAgents };
