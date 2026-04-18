// сервис для отправки писем через resend
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// инициализация resend клиента
let resend: Resend | null = null;
if (apiKey) {
  resend = new Resend(apiKey);
} else {
  console.warn("[emailService] RESEND_API_KEY not set — emails will not be sent.");
}

// отправляем письмо для подтверждения email
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  if (!resend) return;
  const url = `${FRONTEND_URL}?verifyToken=${encodeURIComponent(token)}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Verify your email – Alias",
    html: `<p>Thanks for registering! Click the link below to verify your email address:</p>
<p><a href="${url}">Verify Email</a></p>
<p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
  });
}

// отправляем письмо для сброса пароля
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (!resend) return;
  const url = `${FRONTEND_URL}?resetToken=${encodeURIComponent(token)}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Password reset – Alias",
    html: `<p>Click the link below to reset your password:</p>
<p><a href="${url}">Reset Password</a></p>
<p>This link expires in 1 hour. If you did not request a password reset, ignore this email.</p>`,
  });
}
