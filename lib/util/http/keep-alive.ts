import { HttpAgent, HttpsAgent } from 'agentkeepalive';
import type { Agents } from 'got';

const http = new HttpAgent();
const https = new HttpsAgent();

const keepAliveAgents: Agents = {
  http,
  https,
};

export { keepAliveAgents };
