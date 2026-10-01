import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { ApiClient } from './api-client.js';

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, method: req.method }));
    } else if (req.url === '/empty') {
      res.writeHead(200).end();
    } else {
      res.writeHead(500, { 'Content-Type': 'text/html' }).end('<html>Server Error</html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('ApiClient returns the status and the parsed body', async ({ request }) => {
  const http = new ApiClient(request);

  expect(await http.get(`${baseURL}/json`)).toEqual({ status: 200, body: { ok: true, method: 'GET' } });
  expect(await http.post(`${baseURL}/json`, { data: { id: 1 } })).toEqual({
    status: 200,
    body: { ok: true, method: 'POST' },
  });
  expect(await http.post(`${baseURL}/empty`)).toEqual({ status: 200, body: '' });
});

test('ApiClient with expectOk false returns a failed response instead of throwing', async ({ request }) => {
  const http = new ApiClient(request);

  expect(await http.post(`${baseURL}/error`, { expectOk: false })).toEqual({
    status: 500,
    body: '<html>Server Error</html>',
  });
  await expect(http.post(`${baseURL}/error`)).rejects.toThrow('returned HTTP 500');
});
