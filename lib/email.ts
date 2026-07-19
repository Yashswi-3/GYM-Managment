import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? "gym@example.com";

export async function sendEmail(to: string, subject: string, text: string) {
  return resend.emails.send({ from: FROM, to, subject, text });
}
