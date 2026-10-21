# Calls the chatwoot-scheduler companion service on behalf of a Chatwoot user.
#
# SCHEDULER_BASE_URL is the scheduler's internal address (for example
# http://scheduler_api:3100 on the compose network) and SCHEDULER_APP_SECRET is
# the shared signing secret. Both are read server-side only and are never
# added to the dashboard's window.globalConfig.
class Scheduler::Client
  class Error < StandardError
    attr_reader :status

    def initialize(message, status: nil)
      super(message)
      @status = status
    end

    # The scheduler rejected the request itself (validation and the like)
    def client_error?
      status.present? && status.between?(400, 499) && status != 401
    end
  end

  OPEN_TIMEOUT = 3
  READ_TIMEOUT = 10

  def self.configured?
    base_url.present? && secret.present?
  end

  def self.base_url
    GlobalConfigService.load('SCHEDULER_BASE_URL', nil)
  end

  def self.secret
    GlobalConfigService.load('SCHEDULER_APP_SECRET', nil)
  end

  def initialize(account_id:, user_id:)
    @account_id = account_id
    @user_id = user_id
  end

  def get(path, query = {})
    path = "#{path}?#{query.to_query}" if query.present?
    perform(Net::HTTP::Get, path, '')
  end

  def post(path, payload)
    perform(Net::HTTP::Post, path, payload.to_json)
  end

  private

  def perform(request_class, path, body)
    raise Error, 'Scheduler is not configured' unless self.class.configured?

    request = request_class.new(path, 'Content-Type' => 'application/json', 'Accept' => 'application/json')
    request.body = body if body.present?
    signer.headers(method: request.method, path: path, body: body).each { |name, value| request[name] = value }

    parse(http.request(request))
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError => e
    raise Error, "Scheduler unreachable (#{e.class})"
  end

  def parse(response)
    status = response.code.to_i
    data = response.body.present? ? JSON.parse(response.body) : {}
    return data if status.between?(200, 299)

    raise Error.new(data.is_a?(Hash) ? data['error'].to_s : '', status: status)
  rescue JSON::ParserError
    raise Error.new('Unexpected response from scheduler', status: status)
  end

  def http
    uri = URI.parse(self.class.base_url)
    Net::HTTP.new(uri.host, uri.port).tap do |http|
      http.use_ssl = uri.scheme == 'https'
      http.open_timeout = OPEN_TIMEOUT
      http.read_timeout = READ_TIMEOUT
    end
  end

  def signer
    Scheduler::RequestSigner.new(self.class.secret, account_id: @account_id, user_id: @user_id)
  end
end
