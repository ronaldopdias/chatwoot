<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { createSchedule, fetchTemplates } from 'dashboard/api/scheduler';

const props = defineProps({
  show: { type: Boolean, default: false },
  initialContent: { type: String, default: '' },
  conversationId: { type: Number, default: null },
  contactId: { type: Number, required: true },
  inboxId: { type: Number, required: true },
  channelType: { type: String, required: true },
  currentUserId: { type: Number, required: true },
  accountId: { type: Number, required: true },
});

const emit = defineEmits(['close', 'scheduled']);

const { t } = useI18n();

const TEMPLATE_CHANNELS = new Set(['Whatsapp', 'FacebookPage', 'Instagram']);

const content = ref(props.initialContent);
const scheduledAt = ref('');
const senderTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const submitting = ref(false);
const errorMessage = ref(null);
const successMessage = ref(null);

const recurrenceEnabled = ref(false);
const recurrenceFreq = ref('WEEKLY');
const recurrenceInterval = ref(1);
const recurrenceUntil = ref('');

const templates = ref([]);
const templateName = ref('');
const templateLang = ref('en');
const templatesLoading = ref(false);

const requiresTemplate = computed(() =>
  TEMPLATE_CHANNELS.has(props.channelType)
);

// Build label strings in script to avoid bare strings in template
const sendAtLabel = computed(
  () =>
    `${t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.SEND_AT_LABEL')} (${senderTimezone})`
);

function tplOptionLabel(tpl) {
  return `${tpl.name} (${tpl.language})`;
}

watch(
  () => props.initialContent,
  val => {
    content.value = val;
  }
);

async function loadTemplates() {
  if (!requiresTemplate.value) return;
  templatesLoading.value = true;
  try {
    templates.value = await fetchTemplates({
      accountId: props.accountId,
      userId: props.currentUserId,
      inboxId: props.inboxId,
    });
  } catch (e) {
    errorMessage.value = e.message || String(e);
  } finally {
    templatesLoading.value = false;
  }
}

onMounted(() => {
  if (props.show && requiresTemplate.value) loadTemplates();
});
watch(
  () => props.show,
  v => {
    if (v && requiresTemplate.value) loadTemplates();
  }
);

const onTemplateChange = e => {
  const chosen = templates.value.find(x => x.name === e.target.value);
  if (chosen) {
    templateName.value = chosen.name;
    templateLang.value = chosen.language;
  }
};

const canSubmit = computed(() => {
  if (!scheduledAt.value) return false;
  if (requiresTemplate.value && !templateName.value) return false;
  if (!requiresTemplate.value && !content.value.trim()) return false;
  return !submitting.value;
});

async function submit() {
  submitting.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const payload = {
      accountId: props.accountId,
      userId: props.currentUserId,
      conversationId: props.conversationId,
      contactId: props.contactId,
      inboxId: props.inboxId,
      channelType: props.channelType,
      content: requiresTemplate.value ? '' : content.value,
      contentType: requiresTemplate.value ? 'template' : 'text',
      scheduledAt: new Date(scheduledAt.value).toISOString(),
      senderTimezone,
      attachments: [],
    };
    if (requiresTemplate.value) {
      payload.template = {
        name: templateName.value,
        language: templateLang.value,
        components: [],
      };
    }
    if (recurrenceEnabled.value) {
      payload.recurrenceRule = {
        freq: recurrenceFreq.value,
        interval: Number(recurrenceInterval.value),
        ...(recurrenceUntil.value
          ? { until: new Date(recurrenceUntil.value).toISOString() }
          : {}),
      };
    }
    const result = await createSchedule(payload);
    successMessage.value = t(
      'CONVERSATION.REPLYBOX.SCHEDULE_SEND.SCHEDULED_SUCCESS',
      { id: result.id }
    );
    emit('scheduled', result);
    setTimeout(() => emit('close'), 900);
  } catch (e) {
    errorMessage.value = e.message || String(e);
  } finally {
    submitting.value = false;
  }
}

function cancel() {
  emit('close');
}
</script>

<template>
  <template v-if="show">
    <div class="schedule-modal-backdrop" @click.self="cancel">
      <div class="schedule-modal">
        <div class="modal-header">
          <h2>{{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.MODAL_TITLE') }}</h2>
          <button
            class="close-btn"
            :aria-label="t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.CLOSE')"
            @click="cancel"
          >
            <fluent-icon icon="dismiss" size="16" />
          </button>
        </div>

        <div class="modal-body">
          <div v-if="requiresTemplate" class="form-row">
            <label>
              {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.TEMPLATE_LABEL') }}
              <span v-if="templatesLoading" class="help">
                {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.TEMPLATE_LOADING') }}
              </span>
            </label>
            <select
              data-testid="template-picker"
              :value="templateName"
              @change="onTemplateChange"
            >
              <option value="" disabled>
                {{
                  t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.TEMPLATE_PLACEHOLDER')
                }}
              </option>
              <option
                v-for="tpl in templates"
                :key="`${tpl.name}:${tpl.language}`"
                :value="tpl.name"
              >
                {{ tplOptionLabel(tpl) }}
              </option>
            </select>
            <div class="help">
              {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.TEMPLATE_HELP') }}
            </div>
          </div>

          <div v-else class="form-row">
            <label>
              {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.MESSAGE_LABEL') }}
            </label>
            <textarea v-model="content" rows="4" />
          </div>

          <div class="form-row">
            <label>{{ sendAtLabel }}</label>
            <input v-model="scheduledAt" type="datetime-local" />
          </div>

          <div class="form-row">
            <label>
              <input v-model="recurrenceEnabled" type="checkbox" />
              {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.REPEAT_LABEL') }}
            </label>
            <div v-if="recurrenceEnabled" class="recurrence-row">
              <select v-model="recurrenceFreq">
                <option value="DAILY">
                  {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.FREQ_DAILY') }}
                </option>
                <option value="WEEKLY">
                  {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.FREQ_WEEKLY') }}
                </option>
                <option value="MONTHLY">
                  {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.FREQ_MONTHLY') }}
                </option>
              </select>
              <input
                v-model="recurrenceInterval"
                type="number"
                min="1"
                max="52"
              />
              <span class="help">{{
                t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.EVERY_N')
              }}</span>
              <input
                v-model="recurrenceUntil"
                type="date"
                :placeholder="
                  t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.UNTIL_PLACEHOLDER')
                "
              />
            </div>
          </div>

          <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
          <div v-if="successMessage" class="success">{{ successMessage }}</div>
        </div>

        <div class="modal-footer">
          <button
            data-testid="schedule-cancel"
            class="btn-secondary"
            @click="cancel"
          >
            {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.CANCEL') }}
          </button>
          <button
            data-testid="schedule-submit"
            class="btn-primary"
            :disabled="!canSubmit || undefined"
            @click="submit"
          >
            {{
              submitting
                ? t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.SCHEDULING')
                : t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.SCHEDULE')
            }}
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped lang="scss">
.schedule-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.schedule-modal {
  background: white;
  border-radius: 10px;
  width: 480px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-body, #1f2937);
  }
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-body-secondary, #6b7280);
  display: flex;
  align-items: center;
  padding: 4px;
}

.modal-body {
  padding: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;

  label {
    font-weight: 500;
    font-size: 12px;
    color: var(--color-body-secondary, #6b7280);
  }
}

textarea,
input,
select {
  padding: 8px 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: var(--color-primary, #1f93ff);
    box-shadow: 0 0 0 3px rgba(31, 147, 255, 0.15);
  }
}

.recurrence-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.help {
  font-size: 11px;
  color: #9ca3af;
}

.error {
  color: #dc2626;
  padding: 8px;
  background: #fef2f2;
  border-radius: 6px;
  font-size: 12px;
}

.success {
  color: #065f46;
  padding: 8px;
  background: #d1fae5;
  border-radius: 6px;
  font-size: 12px;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-primary {
  background: var(--color-primary, #1f93ff);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  background: white;
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-body, #1f2937);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
</style>
