'use strict';

// Public student gateway :8080; dedicated coach :4174; member backend :4173.
function readPorts(env = process.env) {
  const values = {
    gateway: Number(env.PORT || 8080),
    coach: Number(env.COACH_PORT || 4174),
    member: Number(env.MEMBER_PORT || 4173)
  };
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isInteger(value) || value < (name === 'gateway' ? 0 : 1) || value > 65535) {
      throw new Error(`Invalid ${name} port: ${value}`);
    }
  }
  const active = Object.values(values).filter(Boolean);
  if (new Set(active).size !== active.length) {
    throw new Error('PORT, COACH_PORT and MEMBER_PORT must be different (defaults: 8080, 4174, 4173).');
  }
  return values;
}
module.exports = { readPorts };
