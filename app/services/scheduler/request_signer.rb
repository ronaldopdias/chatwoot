# Signs server-to-server requests to the chatwoot-scheduler companion service.
#
# The scheduler verifies the same canonical string in
# src/api/middleware/hmac.ts; both sides are tested against one fixed vector.
# The shared secret only ever lives on the two servers.
class Scheduler::RequestSigner
  VERSION = 'v1'.freeze

  def initialize(secret, account_id:, user_id:)
    @secret = secret
    @account_id = account_id
    @user_id = user_id
  end

  # path is the request path including its query string, exactly as sent.
  def headers(method:, path:, body: '', timestamp: Time.now.to_i)
    {
      'X-Scheduler-Account-Id' => @account_id.to_s,
      'X-Scheduler-User-Id' => @user_id.to_s,
      'X-Scheduler-Timestamp' => timestamp.to_s,
      'X-Scheduler-Signature' => signature(method, path, body, timestamp)
    }
  end

  def signature(method, path, body, timestamp)
    canonical = [VERSION, timestamp, method.to_s.upcase, path, @account_id, @user_id, Digest::SHA256.hexdigest(body.to_s)].join("\n")
    "#{VERSION}=#{OpenSSL::HMAC.hexdigest('SHA256', @secret, canonical)}"
  end
end
