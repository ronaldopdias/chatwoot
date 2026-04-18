<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  sendButtonText: { type: String, default: 'Send' },
  disabled: { type: Boolean, default: false },
  schedulerEnabled: { type: Boolean, default: true },
});

const emit = defineEmits(['send', 'openSchedule']);

const { t } = useI18n();

const dropdownOpen = ref(false);
const rootEl = ref(null);

const toggleDropdown = () => {
  if (props.disabled) return;
  dropdownOpen.value = !dropdownOpen.value;
};

const handleSend = () => {
  if (props.disabled) return;
  emit('send');
};

const handleScheduleOption = () => {
  dropdownOpen.value = false;
  emit('openSchedule');
};

const handleClickOutside = event => {
  if (rootEl.value && !rootEl.value.contains(event.target)) {
    dropdownOpen.value = false;
  }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<template>
  <div ref="rootEl" class="schedule-send-dropdown">
    <button
      data-testid="send-btn"
      class="send-btn"
      :class="{ 'with-dropdown': schedulerEnabled }"
      :disabled="disabled"
      @click="handleSend"
    >
      {{ sendButtonText }}
    </button>
    <button
      v-if="schedulerEnabled"
      data-testid="dropdown-toggle"
      class="dropdown-toggle"
      :disabled="disabled"
      :aria-label="t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.SEND_OPTIONS_LABEL')"
      @click.stop="toggleDropdown"
    >
      <!-- eslint-disable-next-line vue/no-bare-strings-in-template -->
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M1 3l4 4 4-4"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div v-if="dropdownOpen" class="dropdown-menu">
      <button
        data-testid="schedule-option"
        class="dropdown-item"
        @click="handleScheduleOption"
      >
        {{ t('CONVERSATION.REPLYBOX.SCHEDULE_SEND.SCHEDULE_OPTION') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.schedule-send-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.send-btn {
  background: var(--color-primary, #1f93ff);
  color: white;
  border: none;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  &.with-dropdown {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  &:hover:not(:disabled) {
    background: var(--color-primary-dark, #1570cc);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.dropdown-toggle {
  background: var(--color-primary, #1f93ff);
  color: white;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding: 7px 8px;
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  &:hover:not(:disabled) {
    background: var(--color-primary-dark, #1570cc);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.dropdown-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  background: white;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  z-index: 20;
  overflow: hidden;
}
.dropdown-item {
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-body, #1f2937);
  &:hover {
    background: var(--color-background-light, #f9fafb);
  }
}
</style>
