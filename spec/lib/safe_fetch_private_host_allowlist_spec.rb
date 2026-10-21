require 'rails_helper'

# `SafeFetch.fetch` requires a block; it is not `Hash#fetch` (same as spec/lib/safe_fetch_spec.rb).
# rubocop:disable Style/RedundantFetchBlock

# RevivaTech fork: SAFE_FETCH_PRIVATE_HOST_ALLOWLIST lets named internal hosts through
# without turning off SSRF protection for every other URL.
RSpec.describe SafeFetch do
  let(:allowed_url) { 'https://manager.internal.test/message/sendText' }
  let(:avatar) do
    { status: 200, body: File.new(Rails.root.join('spec/assets/avatar.png')), headers: { 'Content-Type' => 'image/png' } }
  end

  before do
    allow(Resolv).to receive(:getaddresses).and_call_original
    allow(Resolv).to receive(:getaddresses).with('example.com').and_return(['93.184.216.34'])
    allow(Resolv).to receive(:getaddresses).with('manager.internal.test').and_return(['100.122.130.67'])
    allow(Resolv).to receive(:getaddresses).with('other.internal.test').and_return(['100.122.130.68'])
  end

  it 'blocks a private host by default' do
    expect { described_class.fetch(allowed_url) { nil } }.to raise_error(SafeFetch::UnsafeUrlError)
  end

  it 'allows an allowlisted host that resolves to a private address' do
    stub_request(:get, allowed_url).to_return(avatar)

    with_modified_env('SAFE_FETCH_PRIVATE_HOST_ALLOWLIST' => 'example.com, Manager.Internal.Test') do
      expect { described_class.fetch(allowed_url) { nil } }.not_to raise_error
    end
  end

  it 'still blocks private hosts that are not on the allowlist' do
    with_modified_env('SAFE_FETCH_PRIVATE_HOST_ALLOWLIST' => 'manager.internal.test') do
      expect { described_class.fetch('https://other.internal.test/a.png') { nil } }.to raise_error(SafeFetch::UnsafeUrlError)
      expect { described_class.fetch('http://10.0.0.1/secret') { nil } }.to raise_error(SafeFetch::UnsafeUrlError)
      expect { described_class.fetch('http://169.254.169.254/latest/meta-data/') { nil } }.to raise_error(SafeFetch::UnsafeUrlError)
    end
  end

  it 'does not let a public URL redirect into an allowlisted private host' do
    stub_request(:get, 'http://example.com/redirect.png').to_return(status: 302, headers: { 'Location' => allowed_url })

    with_modified_env('SAFE_FETCH_PRIVATE_HOST_ALLOWLIST' => 'manager.internal.test') do
      expect { described_class.fetch('http://example.com/redirect.png') { nil } }.to raise_error(SafeFetch::UnsafeUrlError)
    end
  end

  it 'matches whole hostnames only' do
    with_modified_env('SAFE_FETCH_PRIVATE_HOST_ALLOWLIST' => 'internal.test') do
      expect(described_class.private_host_allowed?(allowed_url)).to be(false)
      expect(described_class.private_host_allowed?('not a url')).to be(false)
    end
  end
end
# rubocop:enable Style/RedundantFetchBlock
