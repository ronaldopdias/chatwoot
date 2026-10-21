require 'rails_helper'

describe '/app/login', type: :request do
  context 'without DEFAULT_LOCALE' do
    it 'renders the dashboard' do
      get '/app/login'
      expect(response).to have_http_status(:success)
    end
  end

  context 'with DEFAULT_LOCALE' do
    it 'renders the dashboard' do
      with_modified_env DEFAULT_LOCALE: 'pt_BR' do
        get '/app/login'
        expect(response).to have_http_status(:success)
        expect(response.body).to include "selectedLocale: 'pt_BR'"
      end
    end
  end

  context 'when the scheduler companion is configured' do
    let(:secret) { 'scheduler-signing-secret-0123456789abcdef' }

    before do
      create(:installation_config, name: 'SCHEDULER_BASE_URL', value: 'http://scheduler_api:3100', locked: false)
      create(:installation_config, name: 'SCHEDULER_APP_SECRET', value: secret, locked: false)
      GlobalConfig.clear_cache
    end

    after { GlobalConfig.clear_cache }

    it 'enables Schedule Send without exposing the scheduler URL or secret' do
      get '/app/login'

      expect(response).to have_http_status(:success)
      expect(response.body).not_to include(secret)
      expect(response.body).not_to include('SCHEDULER_APP_SECRET')
      expect(response.body).not_to include('scheduler_api:3100')
      expect(response.body).to include('"SCHEDULER_ENABLED":true')
    end
  end

  context 'with non-HTML format' do
    it 'returns not acceptable for JSON with error message' do
      get '/app/login', headers: { 'Accept' => 'application/json' }
      expect(response).to have_http_status(:not_acceptable)
      expect(response.parsed_body).to eq({ 'error' => 'Please use API routes instead of dashboard routes for JSON requests' })
    end
  end

  # Routes are loaded once on app start
  # hence Rails.application.reload_routes! is used in this spec
  # ref : https://stackoverflow.com/a/63584877/939299
  context 'with CW_API_ONLY_SERVER true' do
    it 'returns 404' do
      with_modified_env CW_API_ONLY_SERVER: 'true' do
        Rails.application.reload_routes!
        get '/app/login'
        expect(response).to have_http_status(:not_found)
      end
      Rails.application.reload_routes!
    end
  end
end
