import schedulerAPI, { createSchedule, fetchTemplates } from '../scheduler';
import ApiClient from '../ApiClient';

describe('#schedulerAPI', () => {
  it('is an account-scoped Chatwoot API client', () => {
    expect(schedulerAPI).toBeInstanceOf(ApiClient);
    expect(schedulerAPI.resource).toBe('scheduled_messages');
    expect(schedulerAPI.options.accountScoped).toBe(true);
  });

  describe('API calls', () => {
    const originalAxios = window.axios;
    const axiosMock = {
      post: vi.fn(() => Promise.resolve({ data: { id: 42 } })),
      get: vi.fn(() =>
        Promise.resolve({
          data: { templates: [{ name: 't', language: 'en' }] },
        })
      ),
    };

    beforeEach(() => {
      window.axios = axiosMock;
      window.globalConfig = { SCHEDULER_APP_SECRET: 'must-not-be-used' };
    });

    afterEach(() => {
      window.axios = originalAxios;
      window.globalConfig = {};
      vi.clearAllMocks();
    });

    it('#createSchedule posts only the agent-chosen fields to Chatwoot', async () => {
      const result = await createSchedule({
        conversationId: 3,
        content: 'hi',
        contentType: 'text',
        scheduledAt: '2026-04-20T09:00:00.000Z',
        senderTimezone: 'UTC',
        recurrenceRule: { freq: 'WEEKLY', interval: 1 },
      });

      expect(result.id).toBe(42);
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/scheduled_messages',
        {
          conversation_id: 3,
          content: 'hi',
          content_type: 'text',
          scheduled_at: '2026-04-20T09:00:00.000Z',
          sender_timezone: 'UTC',
          recurrence_rule: { freq: 'WEEKLY', interval: 1 },
        }
      );
      const [url, body] = axiosMock.post.mock.calls[0];
      expect(url).not.toContain('scheduler');
      expect(JSON.stringify(body)).not.toContain('must-not-be-used');
    });

    it('#createSchedule surfaces the server error message', async () => {
      axiosMock.post.mockRejectedValueOnce({
        response: {
          data: { error: 'Please pick a time at least 1 minute from now.' },
        },
      });
      await expect(
        createSchedule({ conversationId: 3, content: 'x', contentType: 'text' })
      ).rejects.toThrow('Please pick a time at least 1 minute from now.');
    });

    it('#fetchTemplates asks Chatwoot for the inbox templates', async () => {
      const templates = await fetchTemplates({ inboxId: 5 });
      expect(templates).toHaveLength(1);
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/scheduled_messages/templates',
        { params: { inbox_id: 5 } }
      );
    });
  });
});
