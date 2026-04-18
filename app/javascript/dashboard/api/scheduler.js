/**
 * HTTP client for the external chatwoot-scheduler companion service.
 * Reads SCHEDULER_BASE_URL + SCHEDULER_APP_SECRET from window.globalConfig
 * (populated via the InstallationConfig store on app boot).
 *
 * HMAC auth model: app_secret + account_id + user_id passed as query params.
 * Same pattern the sidebar Dashboard App iframe uses today.
 */

function requireConfig() {
  const cfg = window.globalConfig || {};
  if (!cfg.SCHEDULER_BASE_URL) {
    throw new Error(
      'SCHEDULER_BASE_URL is not configured in InstallationConfig'
    );
  }
  if (!cfg.SCHEDULER_APP_SECRET) {
    throw new Error(
      'SCHEDULER_APP_SECRET is not configured in InstallationConfig'
    );
  }
  return {
    baseUrl: cfg.SCHEDULER_BASE_URL.replace(/\/$/, ''),
    appSecret: cfg.SCHEDULER_APP_SECRET,
  };
}

function authQuery({ accountId, userId }) {
  const { appSecret } = requireConfig();
  const q = new URLSearchParams({
    app_secret: appSecret,
    account_id: String(accountId),
    user_id: String(userId),
  });
  return q;
}

async function readJson(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}

/**
 * Create a scheduled message.
 * @param {object} input
 * @returns {Promise<{id: number, status: string, scheduledAt: string}>}
 */
export async function createSchedule(input) {
  const { baseUrl } = requireConfig();
  const q = authQuery({ accountId: input.accountId, userId: input.userId });
  const body = {
    accountId: input.accountId,
    createdByUserId: input.userId,
    conversationId: input.conversationId ?? null,
    contactId: input.contactId,
    inboxId: input.inboxId,
    channelType: input.channelType,
    content: input.content,
    contentType: input.contentType,
    scheduledAt: input.scheduledAt,
    senderTimezone: input.senderTimezone,
    attachments: input.attachments || [],
    ...(input.template ? { template: input.template } : {}),
    ...(input.recurrenceRule ? { recurrenceRule: input.recurrenceRule } : {}),
  };
  const res = await fetch(`${baseUrl}/api/schedule?${q}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson(res);
}

/**
 * Fetch WhatsApp/FB/IG templates for a given inbox via the scheduler proxy.
 * @param {{accountId:number, userId:number, inboxId:number}} input
 * @returns {Promise<Array<{name:string, language:string, components?:any[]}>>}
 */
export async function fetchTemplates({ accountId, userId, inboxId }) {
  const { baseUrl } = requireConfig();
  const q = authQuery({ accountId, userId });
  q.set('inboxId', String(inboxId));
  const res = await fetch(`${baseUrl}/api/chatwoot/templates?${q}`, {
    headers: { accept: 'application/json' },
  });
  const data = await readJson(res);
  return data.templates || [];
}
