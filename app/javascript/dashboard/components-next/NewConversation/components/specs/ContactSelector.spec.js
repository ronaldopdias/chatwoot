import { mount, flushPromises } from '@vue/test-utils';
import ContactSelector from '../ContactSelector.vue';
import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import ComboBox from 'dashboard/components-next/combobox/ComboBox.vue';

const mountSelector = (props = {}) =>
  mount(ContactSelector, {
    props: {
      contacts: [],
      showContactsDropdown: true,
      isLoading: false,
      isCreatingContact: false,
      showInboxesDropdown: false,
      ...props,
    },
    global: { stubs: { DropdownMenu: true } },
  });

const type = async (wrapper, value) => {
  await wrapper.find('input').setValue(value);
  await flushPromises();
};

const menuItems = wrapper =>
  wrapper.findComponent({ name: 'DropdownMenu' }).props('menuItems');

const lastSearch = wrapper => wrapper.emitted('searchContacts').at(-1)[0];

describe('ContactSelector phone numbers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a number without a country code as a UK number', async () => {
    const wrapper = mountSelector();
    await type(wrapper, '07565621896');

    expect(wrapper.findComponent(TagInput).props('type')).toBe('tel');
    expect(lastSearch(wrapper)).toBe('+447565621896');
    expect(menuItems(wrapper)).toEqual([
      expect.objectContaining({
        action: 'create',
        value: '+447565621896',
        label: '+44 7565 621896',
      }),
    ]);

    vi.advanceTimersByTime(1000);
    await flushPromises();
    expect(wrapper.find('[data-testid="phone-country-prompt"]').exists()).toBe(
      false
    );
  });

  it('creates the contact with the +44 number on Enter', async () => {
    const wrapper = mountSelector();
    await type(wrapper, '07565 621896');
    await wrapper.find('input').trigger('keydown.enter');
    await flushPromises();

    expect(wrapper.emitted('setSelectedContact')[0][0]).toEqual({
      value: '+447565621896',
      action: 'create',
    });
  });

  it('asks for the country when the number is not a valid UK number', async () => {
    const wrapper = mountSelector();
    await type(wrapper, '06 12 34 56 78');

    // No create suggestion while the number isn't valid
    expect(menuItems(wrapper)).toEqual([]);

    vi.advanceTimersByTime(1000);
    await flushPromises();
    expect(wrapper.find('[data-testid="phone-country-prompt"]').exists()).toBe(
      true
    );

    wrapper.findComponent(ComboBox).vm.$emit('update:modelValue', 'FR');
    await flushPromises();

    expect(lastSearch(wrapper)).toBe('+33612345678');
    expect(menuItems(wrapper)).toEqual([
      expect.objectContaining({ action: 'create', value: '+33612345678' }),
    ]);
  });

  it('keeps international numbers and plain searches unchanged', async () => {
    const wrapper = mountSelector();
    await type(wrapper, '+55 11 98765 4321');
    expect(lastSearch(wrapper)).toBe('+5511987654321');

    await type(wrapper, 'john');
    expect(lastSearch(wrapper)).toBe('john');
    expect(wrapper.findComponent(TagInput).props('type')).toBe('email');

    vi.advanceTimersByTime(1000);
    await flushPromises();
    expect(wrapper.find('[data-testid="phone-country-prompt"]').exists()).toBe(
      false
    );
  });
});
