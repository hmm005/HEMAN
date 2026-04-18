const nodemailer = require('nodemailer');
const { getEmailTemplate } = require('./templates');
const outreachConfig = require('../../config/outreach.json');

function getDailyLimit() {
  const startEnv = process.env.WARMUP_START_DATE;
  const startDate = startEnv ? new Date(startEnv) : new Date();
  const weeksElapsed = Math.floor((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  for (const entry of outreachConfig.warmupSchedule) {
    if (weeksElapsed < entry.maxWeek) return entry.dailyLimit;
  }
  return outreachConfig.warmupSchedule[outreachConfig.warmupSchedule.length - 1].dailyLimit;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: parseInt(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendEmail(lead, step) {
  const template = getEmailTemplate(step, lead);
  if (!template) throw new Error(`No email template for step ${step}`);

  const transporter = createTransport();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `Heman McCray <${from}>`,
    to: lead.email,
    subject: template.subject,
    text: template.text,
  });

  console.log(`  📧 Sent step ${step} to ${lead.email}`);
}

module.exports = { sendEmail, getDailyLimit };
