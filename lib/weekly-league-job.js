// This job is intentionally not scheduled until promotion rules and recovery are defined.
const schedule = Object.freeze({cron: '0 0 * * 1', timezone: 'Europe/Istanbul'});

async function runWeeklyLeagueJob() {
  throw new Error('Lig kuralları ve güvenli haftalık geçiş uygulanmadan görev çalıştırılamaz.');
}

module.exports = {schedule, runWeeklyLeagueJob};
