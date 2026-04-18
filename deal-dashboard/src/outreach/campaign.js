require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const database = require('../db/database');
const { sendEmail, getDailyLimit } = require('./emailSender');
const { getEmailTemplate } = require('./templates');
const outreachConfig = require('../../config/outreach.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000));
}

async function runCampaign(dryRun = false) {
  if (!dryRun && process.env.OUTREACH_ENABLED !== 'true') {
    console.log('Outreach disabled (OUTREACH_ENABLED != true) — skipping');
    return;
  }

  console.log(`\n📬 Outreach campaign${dryRun ? ' [DRY RUN]' : ''}...`);

  const promoted = database.promoteNewLeads();
  if (promoted > 0) console.log(`  → Promoted ${promoted} new lead(s) to active`);

  const dailyLimit = getDailyLimit();
  let emailsSentToday = database.getEmailsSentToday();
  console.log(`  → Daily email limit: ${dailyLimit} | Sent today: ${emailsSentToday}`);

  const leads = database.getActiveLeads();
  console.log(`  → Active leads: ${leads.length}`);

  let emails = 0, reminders = 0, skipped = 0;

  for (const lead of leads) {
    const nextStep = database.getNextStep(lead.id);

    if (nextStep >= outreachConfig.sequence.length) {
      database.updateLeadStatus(lead.id, 'closed');
      continue;
    }

    const seq = outreachConfig.sequence[nextStep];

    if (nextStep > 0) {
      const step0 = database.getOutreachStep(lead.id, 0);
      if (!step0 || daysSince(step0.sent_at) < seq.dayOffset) {
        skipped++;
        continue;
      }
    }

    if (seq.channel === 'email') {
      if (!lead.email) { skipped++; continue; }

      if (emailsSentToday >= dailyLimit) {
        console.log(`  ⚠️  Daily limit reached (${dailyLimit}) — stopping`);
        break;
      }

      const template = getEmailTemplate(nextStep, lead);
      if (dryRun) {
        console.log(`  [DRY] Step ${nextStep} email → ${lead.email} | "${template.subject}"`);
      } else {
        try {
          await sendEmail(lead, nextStep);
          database.logOutreach(lead.id, 'email', nextStep, 'sent', template.subject);
          emailsSentToday++;
          emails++;
          await sleep(3000); // 3-second gap between sends to avoid spam filters
        } catch (err) {
          console.error(`  ❌ Email failed for ${lead.email}: ${err.message}`);
          database.logOutreach(lead.id, 'email', nextStep, 'failed', err.message.slice(0, 120));
        }
      }
    } else if (seq.channel === 'call_reminder') {
      if (dryRun) {
        console.log(`  [DRY] Call reminder → ${lead.first_name} ${lead.last_name} | ${lead.phone || 'no phone'}`);
      } else {
        database.addCallReminder(
          lead.id,
          `${lead.first_name} ${lead.last_name}`.trim(),
          lead.phone,
          lead.property_address
        );
        database.logOutreach(lead.id, 'call_reminder', nextStep, 'sent', 'Dashboard reminder created');
        reminders++;
      }
    }
  }

  console.log(`  ✅ Done: ${emails} emails, ${reminders} call reminders, ${skipped} skipped\n`);
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  runCampaign(dryRun)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runCampaign };
