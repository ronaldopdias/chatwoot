import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSchedule, fetchTemplates } from '../scheduler';

const BASE = 'https://scheduler.example.com';
const SECRET = 'x'.repeat(32);

function mockFetchOnce(status, body) {
  const mock = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
  window.fetch = mock;
  return mock;
}

describe('scheduler api client', () => {
  beforeEach(() => {
    window.globalConfig = {
      SCHEDULER_BASE_URL: BASE,
      SCHEDULER_APP_SECRET: SECRET,
    };
  });

  it('createSchedule POSTs to the right URL with HMAC params', async () => {
    const mock = mockFetchOnce(201, { id: 42, status: 'scheduled' });
    const result = await createSchedule({
      accountId: 1,
      userId: 2,
      conversationId: 3,
      contactId: 4,
      inboxId: 5,
      channelType: 'Email',
      content: 'hi',
      contentType: 'text',
      scheduledAt: '2026-04-20T09:00:00.000Z',
      senderTimezone: 'UTC',
      attachments: [],
    });
    expect(result.id).toBe(42);
    const [url, init] = mock.mock.calls[0];
    expect(url).toContain(`${BASE}/api/schedule?`);
    expect(url).toContain('app_secret=');
    expect(url).toContain('account_id=1');
    expect(url).toContain('user_id=2');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).content).toBe('hi');
  });

  it('createSchedule throws on 4xx', async () => {
    mockFetchOnce(400, { error: 'invalid' });
    await expect(
      createSchedule({
        accountId: 1,
        userId: 2,
        contactId: 4,
        inboxId: 5,
        channelType: 'Email',
        content: 'x',
        contentType: 'text',
        scheduledAt: '2026-04-20T09:00:00.000Z',
        senderTimezone: 'UTC',
        attachments: [],
      })
    ).rejects.toThrow();
  });

  it('fetchTemplates hits the proxy endpoint', async () => {
    const mock = mockFetchOnce(200, {
      templates: [{ name: 't', language: 'en' }],
    });
    const templates = await fetchTemplates({
      accountId: 1,
      userId: 2,
      inboxId: 5,
    });
    expect(templates).toHaveLength(1);
    expect(mock.mock.calls[0][0]).toContain('/api/chatwoot/templates');
    expect(mock.mock.calls[0][0]).toContain('inboxId=5');
  });

  it('throws when SCHEDULER_BASE_URL is not configured', async () => {
    window.globalConfig = {};
    await expect(
      createSchedule({
        accountId: 1,
        userId: 2,
        contactId: 4,
        inboxId: 5,
        channelType: 'Email',
        content: 'x',
        contentType: 'text',
        scheduledAt: '2026-04-20T09:00:00.000Z',
        senderTimezone: 'UTC',
        attachments: [],
      })
    ).rejects.toThrow(/SCHEDULER_BASE_URL/);
  });
});
