# Server-side proxy for the "Schedule send" composer button (RevivaTech fork).
#
# The browser only talks to Chatwoot, using its normal session. Account and
# user come from that session, and contact, inbox and channel come from the
# conversation record, never from request params. Rails then signs the call
# to the chatwoot-scheduler service with a secret the browser never sees.
class Api::V1::Accounts::ScheduledMessagesController < Api::V1::Accounts::BaseController
  before_action :ensure_agent
  before_action :ensure_scheduler_configured
  before_action :fetch_conversation, only: [:create]
  before_action :fetch_inbox, only: [:templates]

  rescue_from Scheduler::Client::Error, with: :render_scheduler_error

  def create
    render json: scheduler.post('/api/schedule', schedule_payload), status: :created
  end

  def templates
    render json: scheduler.get('/api/chatwoot/templates', inboxId: @inbox.id)
  end

  private

  def ensure_agent
    render_unauthorized('Scheduling is only available to agents') unless Current.user.is_a?(User)
  end

  def ensure_scheduler_configured
    render_not_found_error('Scheduler is not configured') unless Scheduler::Client.configured?
  end

  def fetch_conversation
    @conversation = Current.account.conversations.find_by!(display_id: params.require(:conversation_id))
    authorize @conversation.inbox, :show?
  end

  def fetch_inbox
    @inbox = Current.account.inboxes.find(params.require(:inbox_id))
    authorize @inbox, :show?
  end

  def scheduler
    @scheduler ||= Scheduler::Client.new(account_id: Current.account.id, user_id: Current.user.id)
  end

  def schedule_payload
    {
      conversationId: @conversation.display_id,
      contactId: @conversation.contact_id,
      inboxId: @conversation.inbox_id,
      channelType: @conversation.inbox.channel_type.delete_prefix('Channel::'),
      content: params[:content].to_s,
      contentType: params[:content_type].to_s,
      scheduledAt: params.require(:scheduled_at),
      senderTimezone: params[:sender_timezone].presence || 'UTC',
      attachments: [],
      template: template_params,
      recurrenceRule: recurrence_params
    }.compact
  end

  def template_params
    return if params[:template].blank?

    params.require(:template).permit(:name, :language, :namespace, components: [:type, { parameters: [:type, :text] }])
          .to_h.reverse_merge('components' => [])
  end

  def recurrence_params
    return if params[:recurrence_rule].blank?

    params.require(:recurrence_rule).permit(:freq, :interval, :until, :count, byweekday: []).to_h
  end

  def render_scheduler_error(error)
    if error.client_error?
      render json: { error: error.message.presence || 'Scheduler rejected the request' }, status: :unprocessable_entity
    else
      Rails.logger.error("[Scheduler] #{error.message} (status #{error.status.inspect})")
      render json: { error: 'Scheduling is temporarily unavailable' }, status: :bad_gateway
    end
  end
end
