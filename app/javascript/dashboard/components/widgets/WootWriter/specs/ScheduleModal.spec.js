import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ScheduleModal from '../ScheduleModal.vue';

vi.mock('dashboard/api/scheduler', () => ({
  createSchedule: vi.fn().mockResolvedValue({ id: 42, status: 'scheduled' }),
  fetchTemplates: vi.fn().mockResolvedValue([]),
}));

const baseProps = {
  show: true,
  initialContent: 'Hello there',
  conversationId: 10,
  contactId: 20,
  inboxId: 5,
  channelType: 'Email',
  currentUserId: 1,
  accountId: 1,
};

// Minimal i18n stub so <t('...')> calls don't blow up in tests
const globalI18n = {
  mocks: { $t: (k, v) => (v ? `${k}:${JSON.stringify(v)}` : k) },
};

describe('ScheduleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden when show=false', () => {
    const wrapper = mount(ScheduleModal, {
      props: { ...baseProps, show: false },
      global: globalI18n,
    });
    expect(wrapper.find('.schedule-modal-backdrop').exists()).toBe(false);
  });

  it('pre-populates textarea with initialContent', () => {
    const wrapper = mount(ScheduleModal, {
      props: baseProps,
      global: globalI18n,
    });
    expect(wrapper.find('textarea').element.value).toBe('Hello there');
  });

  it('disables Schedule button when scheduledAt is empty', () => {
    const wrapper = mount(ScheduleModal, {
      props: baseProps,
      global: globalI18n,
    });
    expect(
      wrapper.find('[data-testid="schedule-submit"]').attributes('disabled')
    ).toBeDefined();
  });

  it('calls createSchedule on submit with correct payload', async () => {
    const schedulerApi = await import('dashboard/api/scheduler');
    const wrapper = mount(ScheduleModal, {
      props: baseProps,
      global: globalI18n,
    });
    const future = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);
    await wrapper.find('input[type="datetime-local"]').setValue(future);
    await wrapper.find('[data-testid="schedule-submit"]').trigger('click');
    await flushPromises();
    expect(schedulerApi.createSchedule).toHaveBeenCalledOnce();
    const arg = schedulerApi.createSchedule.mock.calls[0][0];
    expect(arg.content).toBe('Hello there');
    expect(arg.channelType).toBe('Email');
    expect(arg.conversationId).toBe(10);
  });

  it('shows template picker for Whatsapp channel', async () => {
    const wrapper = mount(ScheduleModal, {
      props: { ...baseProps, channelType: 'Whatsapp' },
      global: globalI18n,
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="template-picker"]').exists()).toBe(true);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('emits close on cancel', async () => {
    const wrapper = mount(ScheduleModal, {
      props: baseProps,
      global: globalI18n,
    });
    await wrapper.find('[data-testid="schedule-cancel"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
