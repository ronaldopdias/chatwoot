/* global axios */
import ApiClient from './ApiClient';

/**
 * Schedule Send goes through Chatwoot's own API with the agent's normal
 * session. Rails works out the account, user, contact and inbox, then signs
 * the call to the chatwoot-scheduler service server-side
 * (Api::V1::Accounts::ScheduledMessagesController). The browser never sees
 * the scheduler's URL or secret.
 */
class SchedulerAPI extends ApiClient {
  constructor() {
    super('scheduled_messages', { accountScoped: true });
  }

  createSchedule(payload) {
    return axios.post(this.url, payload);
  }

  getTemplates(inboxId) {
    return axios.get(`${this.url}/templates`, {
      params: { inbox_id: inboxId },
    });
  }
}

const schedulerAPI = new SchedulerAPI();

function toError(error) {
  const message = error?.response?.data?.error;
  return message ? new Error(message) : error;
}

/**
 * Create a scheduled message for a conversation.
 * @param {object} input
 * @returns {Promise<{id: number, status: string, scheduledAt: string}>}
 */
export async function createSchedule(input) {
  try {
    const { data } = await schedulerAPI.createSchedule({
      conversation_id: input.conversationId,
      content: input.content,
      content_type: input.contentType,
      scheduled_at: input.scheduledAt,
      sender_timezone: input.senderTimezone,
      ...(input.template ? { template: input.template } : {}),
      ...(input.recurrenceRule
        ? { recurrence_rule: input.recurrenceRule }
        : {}),
    });
    return data;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * Fetch WhatsApp/FB/IG templates for an inbox.
 * @param {{inboxId:number}} input
 * @returns {Promise<Array<{name:string, language:string, components?:any[]}>>}
 */
export async function fetchTemplates({ inboxId }) {
  try {
    const { data } = await schedulerAPI.getTemplates(inboxId);
    return data.templates || [];
  } catch (error) {
    throw toError(error);
  }
}

export default schedulerAPI;
