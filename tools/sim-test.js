// index.html の SIM 部分だけを取り出して、ブラウザなしでレースを回すテスト
// 使い方: node tools/sim-test.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.slice(html.indexOf('// === SIM START ==='), html.indexOf('// === SIM END ==='));
const api = new Function(src + '\nreturn { COURSES, PLAYER_HORSES, createRace, stepRace, STYLES, JUMP_T, trackOf, makeFences, typeof_TRK: typeof TRK, ...(typeof SIM_EXPORTS === "object" ? SIM_EXPORTS : {}) };')();

function run(courseId, horseId, diff = 'normal', ground = 'ryo', policy = 'smart', extra = {}) {
  const course = api.COURSES.find(c => c.id === courseId);
  const def = api.PLAYER_HORSES.find(h => h.id === horseId);
  const race = api.createRace(Object.assign({ course, diff, ground, players: [def] }, extra));
  race.emit = () => {};
  race.openAt = 1;
  const humans = race.humans;
  for (const p of humans) p.startDelay = 0.15;
  let guard = 0;
  while (race.runners.some(r => !r.finished) && guard++ < 200000) {
    for (const p of humans) {
      if (p.finished) continue;
      const rem = race.D - p.p;
      if (policy === 'smart') {
        const ST = api.STYLES[p.style];
        const frac = p.rank / (race.N - 1);
        let e = p.style === 'nige' ? 0.62 : 0.5;
        if (frac > ST.band[1]) e += 0.12; if (frac < ST.band[0]) e -= 0.12;
        if (p.temper === 'zubui') e += 0.12;
        if (rem < p.zone - 30) e = 1;
        p.effort = e; p.soothing = p.agit > 50;
        if (rem < 350 && p.whips > 0 && Math.random() < 0.02) p.whip(race);
        // 障害：滞空のまん中で越えるように踏み切る（少しばらつかせる）
        const F = race.fences, fl = Math.max(8, p.v) * api.JUMP_T;
        if (p.jt < 0 && p.nextJ < F.length && F[p.nextJ] - p.p <= fl * (0.5 + (Math.random() - 0.5) * 0.3)) p.jump(race);
      } else p.effort = 0.5;
    }
    api.stepRace(race, 1 / 60);
  }
  const fin = race.runners.slice().sort((a, b) => a.ft - b.ft);
  return { race, fin, places: humans.map(p => fin.indexOf(p) + 1) };
}
module.exports = { api, run };
if (require.main === module) {
  const courses = process.argv[2] ? [process.argv[2]] : api.COURSES.map(c => c.id);
  for (const c of courses) {
    const line = [];
    for (const h of api.PLAYER_HORSES) {
      let sum = 0, wins = 0, n = 30;
      for (let i = 0; i < n; i++) { const { places } = run(c, h.id); sum += places[0]; if (places[0] === 1) wins++; }
      line.push(`${h.id}:${(sum / n).toFixed(1)}(${wins})`);
    }
    const { fin, race } = run(c, 'hoshi');
    console.log(c.padEnd(12), `winTime=${(fin[0].ft - race.openAt).toFixed(1)}s`, line.join(' '));
  }
}
