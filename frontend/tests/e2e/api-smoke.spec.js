import { test, expect } from '@playwright/test';

const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000/api';

test.describe('live Flask API smoke checks', () => {
  let authHeaders;
  let conversationId;
  test.beforeAll(async ({ request }) => {
    let authentication = await request.post(`${apiBase}/auth/register`, {
      data: {
        name: 'E2E Demo User',
        email: 'e2e-finora@example.test',
        password: 'e2e-demo-password',
      },
    });
    if (authentication.status() === 409)
      authentication = await request.post(`${apiBase}/auth/login`, {
        data: { email: 'e2e-finora@example.test', password: 'e2e-demo-password' },
      });
    expect([200, 201]).toContain(authentication.status());
    const auth = await authentication.json();
    authHeaders = { Authorization: `Bearer ${auth.token}` };
    const conversation = await request.post(`${apiBase}/conversations`, {
      data: { title: 'API test conversation' },
      headers: authHeaders,
    });
    conversationId = (await conversation.json()).id;
  });
  test('health and read endpoints respond with expected JSON', async ({ request }) => {
    const health = await request.get(`${apiBase}/health`);
    expect(health.status()).toBe(200);
    await expect(health).toBeOK();
    expect(await health.json()).toMatchObject({ status: 'ok', demo: true });

    for (const endpoint of [
      'accounts',
      'transactions',
      'beneficiaries',
      'cards',
      'notifications',
    ]) {
      const response = await request.get(`${apiBase}/${endpoint}`, { headers: authHeaders });
      expect(response.status(), `${endpoint} endpoint status`).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body), `${endpoint} should return an array`).toBe(true);
      expect(body.length, `${endpoint} should contain demo data`).toBeGreaterThan(0);
    }
  });

  test('chat, simulated transfer and simulated bill payment use live API', async ({ request }) => {
    const chat = await request.post(`${apiBase}/chat`, {
      data: { message: 'What is my balance?', conversationId },
      headers: authHeaders,
    });
    expect(chat.status()).toBe(200);
    const chatBody = await chat.json();
    expect(chatBody).toMatchObject({ simulated: true });
    expect(chatBody.reply).toContain('$37,340.55');

    const transfer = await request.post(`${apiBase}/transfers`, {
      headers: authHeaders,
      data: { sourceAccount: 'CHK-001', beneficiaryId: 'ben-1', amount: 1.25 },
    });
    expect(transfer.status()).toBe(201);
    expect(await transfer.json()).toMatchObject({ status: 'simulated', amount: 1.25 });

    const bill = await request.post(`${apiBase}/bill-payments`, {
      headers: authHeaders,
      data: { provider: 'Demo Utilities', customer: 'CUS-TEST', amount: 1.25 },
    });
    expect(bill.status()).toBe(201);
    expect(await bill.json()).toMatchObject({ status: 'simulated', amount: 1.25 });
  });

  test('invalid transfer and unknown endpoint fail with JSON errors', async ({ request }) => {
    const invalid = await request.post(`${apiBase}/transfers`, {
      headers: authHeaders,
      data: { sourceAccount: 'CHK-001', beneficiaryId: 'ben-1', amount: 'Infinity' },
    });
    expect(invalid.status()).toBe(400);
    expect(typeof (await invalid.json()).error).toBe('string');

    const missing = await request.get(`${apiBase}/endpoint-does-not-exist`);
    expect(missing.status()).toBe(404);
    expect(typeof (await missing.json()).error).toBe('string');
  });
});
