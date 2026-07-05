import { Resend } from 'resend';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  workspaceName: string;
  inviteLink: string;
  role: string;
}) {
  const { to, inviterName, workspaceName, inviteLink, role } = params;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: 'TaskFlow <onboarding@resend.dev>',
      to: [to],
      subject: `${inviterName} invited you to join ${workspaceName} on TaskFlow`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 8px;">You've been invited!</h1>
          <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to join the workspace
            <strong>${workspaceName}</strong> as a <em>${role.toLowerCase()}</em>.
          </p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}"
               style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: #fff;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">
            This invitation expires in 7 days. If you weren't expecting this, you can ignore it.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">
            Sent by TaskFlow — Team task management, simplified.
          </p>
        </div>
      `,
    });

    if (error) {
      logger.error(error, 'Failed to send invitation email');
    } else {
      logger.info({ to }, 'Invitation email sent');
    }
  } catch (err) {
    // Don't throw — email failure shouldn't block the invitation creation
    logger.error(err, 'Failed to send invitation email');
  }
}
