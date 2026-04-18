const cron = require('node-cron');
const { runCampaign } = require('./campaign');

function startOutreachScheduler() {
  console.log('📅 Outreach scheduler started — daily at 7:00 AM');
  cron.schedule('0 7 * * *', () => runCampaign(false));
}

module.exports = { startOutreachScheduler };
