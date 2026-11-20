'use strict';
// Sliding inactivity limits, not a promise of permanent login after cookie deletion.
// Keep privileged management sessions shorter. No passwords or fingerprints on-device.
const DAY_SECONDS = 86400;
const RENEW_INTERVAL_SECONDS = DAY_SECONDS;
function lifetimeSeconds(site) {
  if (!['member', 'coach', 'admin'].includes(site)) throw new Error('Unknown session site');
  return (site === 'admin' ? 30 : 180) * DAY_SECONDS;
}
module.exports = { DAY_SECONDS, RENEW_INTERVAL_SECONDS, lifetimeSeconds };
