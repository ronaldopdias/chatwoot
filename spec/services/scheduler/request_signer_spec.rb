require 'rails_helper'

RSpec.describe Scheduler::RequestSigner do
  let(:secret) { 'test-shared-secret-0123456789abcdef' }
  let(:signer) { described_class.new(secret, account_id: 1, user_id: 2) }
  let(:signed) { { method: 'POST', path: '/api/schedule', body: '{"content":"hi"}', timestamp: 1_700_000_000 } }

  # Same fixed vector as chatwoot-scheduler's tests/unit/hmac.spec.ts, so the
  # Ruby signer and the TypeScript verifier can't drift apart silently.
  it 'matches the vector the scheduler verifies against' do
    expect(signer.headers(**signed)).to eq(
      'X-Scheduler-Account-Id' => '1',
      'X-Scheduler-User-Id' => '2',
      'X-Scheduler-Timestamp' => '1700000000',
      'X-Scheduler-Signature' => 'v1=2505d0b0893c9a94707f7df60f59357d75ec3200bb347523a142275332fe7cda'
    )
  end

  it 'changes the signature when any signed part changes' do
    original = signer.headers(**signed)['X-Scheduler-Signature']
    variations = [{ method: 'GET' }, { path: '/api/schedule?x=1' }, { body: '{"content":"ho"}' }, { timestamp: 1_700_000_001 }]
    other_signers = [
      described_class.new(secret, account_id: 3, user_id: 2),
      described_class.new(secret, account_id: 1, user_id: 3),
      described_class.new('other-secret', account_id: 1, user_id: 2)
    ]

    variations.each do |change|
      expect(signer.headers(**signed, **change)['X-Scheduler-Signature']).not_to eq(original)
    end
    other_signers.each do |other|
      expect(other.headers(**signed)['X-Scheduler-Signature']).not_to eq(original)
    end
  end
end
