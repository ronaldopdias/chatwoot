import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScheduleSendDropdown from '../ScheduleSendDropdown.vue';

describe('ScheduleSendDropdown', () => {
  it('renders a Send button', () => {
    const wrapper = mount(ScheduleSendDropdown, {
      props: { sendButtonText: 'Send', disabled: false },
    });
    expect(wrapper.text()).toContain('Send');
  });

  it('emits "send" when the Send button is clicked', async () => {
    const wrapper = mount(ScheduleSendDropdown, {
      props: { sendButtonText: 'Send', disabled: false },
    });
    await wrapper.find('[data-testid="send-btn"]').trigger('click');
    expect(wrapper.emitted('send')).toBeTruthy();
  });

  it('emits "openSchedule" when Schedule send option is clicked', async () => {
    const wrapper = mount(ScheduleSendDropdown, {
      props: {
        sendButtonText: 'Send',
        disabled: false,
        schedulerEnabled: true,
      },
    });
    await wrapper.find('[data-testid="dropdown-toggle"]').trigger('click');
    await wrapper.find('[data-testid="schedule-option"]').trigger('click');
    expect(wrapper.emitted('openSchedule')).toBeTruthy();
  });

  it('hides dropdown arrow when schedulerEnabled=false', () => {
    const wrapper = mount(ScheduleSendDropdown, {
      props: {
        sendButtonText: 'Send',
        disabled: false,
        schedulerEnabled: false,
      },
    });
    expect(wrapper.find('[data-testid="dropdown-toggle"]').exists()).toBe(
      false
    );
  });

  it('disables the Send button when disabled=true', () => {
    const wrapper = mount(ScheduleSendDropdown, {
      props: { sendButtonText: 'Send', disabled: true },
    });
    expect(
      wrapper.find('[data-testid="send-btn"]').attributes('disabled')
    ).toBeDefined();
  });
});
