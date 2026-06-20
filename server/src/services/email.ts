import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
): Promise<void> {
  const transporter = getTransporter()

  await transporter.sendMail({
    from:    `"Excaliber" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: 'Reset your Excaliber password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff;">
          <span style="color:#f59e0b;">✦</span> Excaliber
        </h2>
        <p style="margin:0 0 24px;color:#a1a1aa;font-size:14px;">Password reset request</p>

        <p style="font-size:15px;line-height:1.6;color:#d4d4d8;">
          We received a request to reset your password. Click the button below —
          this link expires in <strong style="color:#fff;">1 hour</strong>.
        </p>

        <a href="${resetLink}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;
                  background:linear-gradient(to right,#f59e0b,#f97316);
                  color:#fff;font-size:14px;font-weight:600;
                  text-decoration:none;border-radius:8px;">
          Reset password
        </a>

        <p style="font-size:12px;color:#71717a;line-height:1.6;">
          If you didn't request this, you can safely ignore this email —
          your password won't change.
        </p>

        <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;" />
        <p style="font-size:11px;color:#52525b;">
          If the button doesn't work, paste this link into your browser:<br />
          <span style="color:#a1a1aa;word-break:break-all;">${resetLink}</span>
        </p>
      </div>
    `,
  })
}
