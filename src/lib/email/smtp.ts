import nodemailer from "nodemailer";
import type { ServerEnv } from "@/lib/config/env";
import { getServerEnv } from "@/lib/config/env";

export type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export function readSmtpSettings(env: ServerEnv): SmtpSettings | null {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const password = env.SMTP_PASSWORD;
  const from = env.SMTP_FROM;
  if (!host || !user || !password || !from) {
    return null;
  }
  const port = Number(env.SMTP_PORT || "465");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return { host, port, user, password, from };
}

export async function sendLoginCode(to: string, code: string): Promise<void> {
  const settings = readSmtpSettings(getServerEnv());
  if (!settings) {
    throw new Error("Email delivery is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });

  try {
    await transporter.sendMail({
      from: settings.from,
      to,
      subject: "Your ORYVOM sign-in code",
      text: [
        `Your sign-in code is ${code}.`,
        "It expires in 10 minutes.",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
    });
  } catch {
    throw new Error("Email delivery failed.");
  }
}
