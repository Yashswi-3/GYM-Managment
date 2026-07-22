import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? "gym@example.com";
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@example.com";

export async function sendEmail(to: string, subject: string, text: string) {
  return resend.emails.send({ from: FROM, to, subject, text });
}

/** Sends the same notification to the gym owner, and to the member too if they have an email on file. */
export async function notifyMemberAndOwner(
  memberEmail: string | null,
  memberName: string,
  subject: string,
  body: string
) {
  const tasks = [sendEmail(OWNER_EMAIL, `[Gym] ${subject} — ${memberName}`, body)];
  if (memberEmail) tasks.push(sendEmail(memberEmail, subject, body));
  await Promise.all(tasks);
}
