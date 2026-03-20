import nodemailer from "nodemailer";
import { ENV } from "./env";

/**
 * Send email using configured SMTP settings
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      auth: {
        user: ENV.smtpUser,
        pass: ENV.smtpPass,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: options.replyTo ? `"${options.replyTo}" <${ENV.smtpUser}>` : ENV.contactEmailFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email sending failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send contact form email
 */
export async function sendContactFormEmail(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const emailText = `
Neue Kontaktanfrage von der Jogge di Balla Website

Name: ${data.name}
E-Mail: ${data.email}
Betreff: ${data.subject}

Nachricht:
${data.message}
  `.trim();

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0891b2 0%, #f87171 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #0891b2; }
    .message-box { background: white; padding: 15px; border-left: 4px solid #0891b2; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Neue Kontaktanfrage</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Jogge di Balla Website</p>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">Name:</span> ${data.name}
      </div>
      <div class="field">
        <span class="label">E-Mail:</span> <a href="mailto:${data.email}">${data.email}</a>
      </div>
      <div class="field">
        <span class="label">Betreff:</span> ${data.subject}
      </div>
      <div class="field">
        <span class="label">Nachricht:</span>
        <div class="message-box">
          ${data.message.replace(/\n/g, "<br>")}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: ENV.contactEmailTo,
    subject: `Kontaktanfrage: ${data.subject}`,
    text: emailText,
    html: emailHtml,
    replyTo: `${data.name} <${data.email}>`,
  });
}

/**
 * Send Harassenlauf registration notification email
 */
export async function sendHarassenlaufEmail(data: {
  teamName: string;
  memberCount: number;
  captainFirstName: string;
  captainLastName: string;
  captainPhone: string;
  wurstKalb: number;
  wurstKloepfer: number;
  wurstVegi: number;
  additionalInfo?: string;
}): Promise<{ success: boolean; error?: string }> {
  const totalWurste = data.wurstKalb + data.wurstKloepfer + data.wurstVegi;

  const emailText = `
Neue Harassenlauf Anmeldung!

Team: ${data.teamName}
Anzahl Teilnehmer: ${data.memberCount}
Teamchef: ${data.captainFirstName} ${data.captainLastName}
Tel. Mobile: ${data.captainPhone}

Wurstbestellung:
- Kalbsbratwurst: ${data.wurstKalb}
- Klöpfer: ${data.wurstKloepfer}
- Vegi: ${data.wurstVegi}
- Total: ${totalWurste} Würste

${data.additionalInfo ? `Zusätzliche Angaben:\n${data.additionalInfo}` : ""}
  `.trim();

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0891b2 0%, #f97316 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #0891b2; }
    .wurst-box { background: white; padding: 15px; border-left: 4px solid #f97316; margin-top: 10px; border-radius: 0 4px 4px 0; }
    .additional-box { background: white; padding: 15px; border-left: 4px solid #0891b2; margin-top: 10px; border-radius: 0 4px 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🍺 Neue Harassenlauf Anmeldung!</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Jogge di Balla – Harassenlauf</p>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">🏆 Team:</span> ${data.teamName}
      </div>
      <div class="field">
        <span class="label">👥 Anzahl Teilnehmer:</span> ${data.memberCount}
      </div>
      <div class="field">
        <span class="label">👤 Teamchef:</span> ${data.captainFirstName} ${data.captainLastName}
      </div>
      <div class="field">
        <span class="label">📱 Tel. Mobile:</span> ${data.captainPhone}
      </div>
      <div class="field">
        <span class="label">🌭 Wurstbestellung:</span>
        <div class="wurst-box">
          <div>Kalbsbratwurst: <strong>${data.wurstKalb}</strong></div>
          <div>Klöpfer: <strong>${data.wurstKloepfer}</strong></div>
          <div>Vegi: <strong>${data.wurstVegi}</strong></div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
            <strong>Total: ${totalWurste} Würste</strong>
          </div>
        </div>
      </div>
      ${data.additionalInfo ? `
      <div class="field">
        <span class="label">💬 Zusätzliche Angaben:</span>
        <div class="additional-box">${data.additionalInfo.replace(/\n/g, "<br>")}</div>
      </div>
      ` : ""}
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: ENV.contactEmailTo,
    subject: `🍺 Harassenlauf Anmeldung: ${data.teamName}`,
    text: emailText,
    html: emailHtml,
  });
}
