require 'rails_helper'

RSpec.describe 'Scheduled Messages API', type: :request do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:inbox) { create(:inbox, account: account) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox) }
  let(:scheduler_url) { 'http://scheduler.test:3100' }
  let(:secret) { 'test-signing-secret-0123456789abcdef0123456789' }
  let(:scheduled_at) { 1.hour.from_now.utc.iso8601 }

  def configure_scheduler
    create(:installation_config, name: 'SCHEDULER_BASE_URL', value: scheduler_url, locked: false)
    create(:installation_config, name: 'SCHEDULER_APP_SECRET', value: secret, locked: false)
    GlobalConfig.clear_cache
  end

  def signature_valid?(request)
    uri = URI.parse(request.uri.to_s)
    path = uri.query ? "#{uri.path}?#{uri.query}" : uri.path
    headers = request.headers
    signer = Scheduler::RequestSigner.new(secret, account_id: headers['X-Scheduler-Account-Id'], user_id: headers['X-Scheduler-User-Id'])
    expected = signer.signature(request.method, path, request.body.to_s, headers['X-Scheduler-Timestamp'])
    ActiveSupport::SecurityUtils.secure_compare(headers['X-Scheduler-Signature'].to_s, expected)
  end

  def schedule_params
    { conversation_id: conversation.display_id, content: 'Hello later', content_type: 'text',
      scheduled_at: scheduled_at, sender_timezone: 'Europe/London' }
  end

  before { configure_scheduler }

  after { GlobalConfig.clear_cache }

  describe 'POST /api/v1/accounts/{account.id}/scheduled_messages' do
    let(:endpoint) { "/api/v1/accounts/#{account.id}/scheduled_messages" }

    it 'returns unauthorized without a Chatwoot session' do
      post endpoint, params: schedule_params, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /scheduler\.test/)).not_to have_been_made
    end

    context 'when the agent is a member of the inbox' do
      before { create(:inbox_member, user: agent, inbox: inbox) }

      it 'forwards a signed request built from the session and the conversation' do
        stub = stub_request(:post, "#{scheduler_url}/api/schedule")
               .with { |req| signature_valid?(req) }
               .to_return(status: 201, body: { id: 7, status: 'scheduled', scheduledAt: scheduled_at }.to_json)

        # Client-supplied identity and routing must be ignored
        spoofed = { account_id: 999, user_id: 999, accountId: 999, createdByUserId: 999, contact_id: 999, inbox_id: 999 }
        post endpoint, params: schedule_params.merge(spoofed), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:created)
        expect(response.parsed_body['id']).to eq(7)
        expect(stub).to have_been_requested.once
        expect(
          a_request(:post, "#{scheduler_url}/api/schedule").with(
            headers: { 'X-Scheduler-Account-Id' => account.id.to_s, 'X-Scheduler-User-Id' => agent.id.to_s },
            body: hash_including(
              'conversationId' => conversation.display_id, 'contactId' => conversation.contact_id,
              'inboxId' => inbox.id, 'channelType' => 'WebWidget', 'content' => 'Hello later',
              'scheduledAt' => scheduled_at, 'senderTimezone' => 'Europe/London'
            )
          ) { |req| !JSON.parse(req.body).key?('accountId') && !JSON.parse(req.body).key?('createdByUserId') }
        ).to have_been_made.once
      end

      it 'passes scheduler validation errors back as 422' do
        stub_request(:post, "#{scheduler_url}/api/schedule")
          .to_return(status: 400, body: { error: 'Please pick a time at least 1 minute from now.' }.to_json)

        post endpoint, params: schedule_params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq('Please pick a time at least 1 minute from now.')
      end

      it 'returns 502 without details when the scheduler rejects the signature' do
        stub_request(:post, "#{scheduler_url}/api/schedule").to_return(status: 401, body: { error: 'invalid signature' }.to_json)

        post endpoint, params: schedule_params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.body).not_to include('signature')
      end

      it 'returns 502 when the scheduler is unreachable' do
        stub_request(:post, "#{scheduler_url}/api/schedule").to_timeout

        post endpoint, params: schedule_params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
      end

      it 'returns 404 when the scheduler is not configured' do
        InstallationConfig.where(name: %w[SCHEDULER_BASE_URL SCHEDULER_APP_SECRET]).destroy_all
        GlobalConfig.clear_cache

        post endpoint, params: schedule_params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:not_found)
      end
    end

    it 'rejects conversations in inboxes the agent cannot access' do
      post endpoint, params: schedule_params, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /scheduler\.test/)).not_to have_been_made
    end

    it 'does not find conversations from another account' do
      other_conversation = create(:conversation)
      create(:inbox_member, user: agent, inbox: inbox)

      # This account has no conversations, so the other account's display_id must not resolve
      post endpoint, params: { conversation_id: other_conversation.display_id, content: 'x', content_type: 'text', scheduled_at: scheduled_at },
                     headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:not_found)
      expect(a_request(:any, /scheduler\.test/)).not_to have_been_made
    end

    it 'rejects agent bot tokens' do
      bot = create(:agent_bot, account: account)
      create(:agent_bot_inbox, agent_bot: bot, inbox: inbox)

      post endpoint, params: schedule_params, headers: { api_access_token: bot.access_token.token }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /scheduler\.test/)).not_to have_been_made
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/scheduled_messages/templates' do
    let(:endpoint) { "/api/v1/accounts/#{account.id}/scheduled_messages/templates" }

    it 'returns templates for an inbox the agent belongs to, via a signed request' do
      create(:inbox_member, user: agent, inbox: inbox)
      stub_request(:get, "#{scheduler_url}/api/chatwoot/templates?inboxId=#{inbox.id}")
        .with { |req| signature_valid?(req) }
        .to_return(status: 200, body: { templates: [{ name: 'welcome', language: 'en' }] }.to_json)

      get endpoint, params: { inbox_id: inbox.id }, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:success)
      expect(response.parsed_body['templates'].first['name']).to eq('welcome')
    end

    it 'rejects inboxes the agent cannot access' do
      get endpoint, params: { inbox_id: inbox.id }, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /scheduler\.test/)).not_to have_been_made
    end
  end
end
