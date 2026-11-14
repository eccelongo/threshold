/*
  THE LAST ROOM — one evolving composition, five sonic states.

  Everything is synthesised in the browser with the Web Audio API: no audio files, nothing to license.
  The engine starts once (after an explicit click) and never restarts; the journey only moves a
  continuous "state" through it, so scenes crossfade instead of switching tracks.

  Layers (always running, levels automated):
    drone    — detuned low saws and sines through a slowly breathing low-pass       (foundation)
    air      — band-passed noise that breathes                                        (texture)
    metal    — inharmonic struck partials, far away in the reverb                     (metallic resonance)
    machine  — filtered rumble + a distorted 49 Hz hum, slowly auto-panned            (industrial)
    grain    — short grains of noise and metal, density driven by movement           (granular / glitch)
    pulse    — sub kick, industrial hit, deep bass: irregular, then aligning, then hypnotic
    reverse  — reversed swells                                                         (reassembly)
    magnet   — an FM tone whose modulation slowly locks in                             (magnetic resonance)

  States, from scroll progress p:
    0 entrance · 1 transition · 2 deconstruction · 3 reassembly · 4 the last room
*/

const STATES = [
  //            drone metal air  machine grain pulse rev  magnet  cutoff
  /* entrance */ [.9,  .35,  .55, 0,      0,    0,    0,   0,      240],
  /* transition*/[.8,  .45,  .4,  .75,    .18,  .25,  .1,  0,      480],
  /* decon    */ [.6,  .5,   .25, .45,    .95,  .55,  .15, 0,      900],
  /* reassembly*/[.55, .4,   .2,  .2,     .35,  .6,   .65, .7,     680],
  /* last room */[.75, .22,  .15, .3,     .06,  .9,   .08, .25,    360],
];
const LAYERS = ['drone', 'metal', 'air', 'machine', 'grain', 'pulse', 'reverse', 'magnet'];
const smooth = (a, b, v) => { const x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); };

// weights of the five states for a scroll position: overlapping, so every change is a crossfade
export function stateWeights(p){
  const w = [
    1 - smooth(.05, .14, p),
    smooth(.05, .14, p) * (1 - smooth(.2, .3, p)),
    smooth(.2, .3, p) * (1 - smooth(.48, .56, p)),
    smooth(.48, .56, p) * (1 - smooth(.8, .88, p)),
    smooth(.8, .88, p),
  ];
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(v => v / s);
}

export function createSound({ reduced = false, light = false } = {}){
  let ctx = null, master, rev, on = false;
  const bus = {}, state = { p: 0, vel: 0, push: 0, pan: 0, w: stateWeights(0), touchAt: 0 };
  let noise, metalBuf, revBuf, droneF, breath, magIndex, nextNote = 0, step = 0, nextPing = 0, nextGrain = 0, bar = 0, timer = null;

  function makeIR(sec, decay){
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function makeNoise(sec){ const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function makeMetal(sec){ // a struck plate: inharmonic partials with different decays
    const sr = ctx.sampleRate, b = ctx.createBuffer(1, sr * sec, sr), d = b.getChannelData(0), P = [[1, 1, 1.2], [2.76, .6, 2], [5.4, .4, 3.2], [8.93, .25, 5], [13.3, .12, 7]];
    for (let i = 0; i < d.length; i++){ const t = i / sr; let v = 0; for (const [r, a, k] of P) v += Math.sin(2 * Math.PI * 180 * r * t) * a * Math.exp(-t * k); d[i] = v * .35; }
    return b;
  }
  function layer(name, send = .45){
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner(); g.connect(pan); pan.connect(master);
    const s = ctx.createGain(); s.gain.value = send; pan.connect(s); s.connect(rev);
    return (bus[name] = { g, pan, s });
  }

  function init(){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = .01; comp.release.value = .3;
    master.connect(comp); comp.connect(ctx.destination);
    rev = ctx.createConvolver(); rev.buffer = makeIR(light ? 3 : 5, 2.6);
    const revOut = ctx.createGain(); revOut.gain.value = .55; rev.connect(revOut); revOut.connect(master);
    noise = makeNoise(4); metalBuf = makeMetal(3);
    revBuf = ctx.createBuffer(1, noise.length / 2, ctx.sampleRate); { const s = noise.getChannelData(0), d = revBuf.getChannelData(0), n = d.length; for (let i = 0; i < n; i++) d[i] = s[i] * Math.pow(i / n, 3); } // a swell that grows: a "reversed" decay
    LAYERS.forEach(n => layer(n, n === 'metal' ? .9 : n === 'reverse' ? .7 : .4));

    // drone: detuned low voices through a breathing low-pass
    droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 240; droneF.Q.value = .9;
    breath = ctx.createGain(); breath.gain.value = .75; droneF.connect(breath); breath.connect(bus.drone.g);
    [[36.71, 'sawtooth', .16], [36.95, 'sawtooth', .16], [55, 'sine', .14], [73.42, 'sine', .07], [110.3, 'triangle', .03]].forEach(([f, type, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = a; o.connect(g); g.connect(droneF); o.start(); });
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = .07; lfoG.gain.value = .25; lfo.connect(lfoG); lfoG.connect(breath.gain); lfo.start();

    // air: band-passed noise, its centre wandering
    { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .7;
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = .05; lg.gain.value = 500; l.connect(lg); lg.connect(bp.frequency); l.start();
      const g = ctx.createGain(); g.gain.value = .22; src.connect(bp); bp.connect(g); g.connect(bus.air.g); src.start(); }

    // machine: a rumble and a distorted hum, slowly moving across the stereo field
    { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = .5;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 140; bp.Q.value = 2.5;
      const trem = ctx.createGain(); trem.gain.value = .5; const tl = ctx.createOscillator(), tg = ctx.createGain(); tl.frequency.value = 6.5; tg.gain.value = .35; tl.connect(tg); tg.connect(trem.gain); tl.start();
      src.connect(bp); bp.connect(trem); trem.connect(bus.machine.g); src.start();
      const hum = ctx.createOscillator(); hum.type = 'square'; hum.frequency.value = 49;
      const ws = ctx.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i / 512 - 1; curve[i] = Math.tanh(x * 3); } ws.curve = curve;
      const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 320; const hg = ctx.createGain(); hg.gain.value = .05;
      hum.connect(ws); ws.connect(hl); hl.connect(hg); hg.connect(bus.machine.g); hum.start(); }

    // magnet: an FM tone whose modulation index rises as the pieces lock together
    { const car = ctx.createOscillator(), mod = ctx.createOscillator(); car.frequency.value = 110; mod.frequency.value = 110 * 1.5;
      magIndex = ctx.createGain(); magIndex.gain.value = 0; mod.connect(magIndex); magIndex.connect(car.frequency);
      const g = ctx.createGain(); g.gain.value = .08; car.connect(g); g.connect(bus.magnet.g); car.start(); mod.start(); }

    nextNote = nextPing = nextGrain = ctx.currentTime + .1;
    timer = setInterval(schedule, 25);
  }

  /* ---------- one-shot voices ---------- */
  function kick(t, a){ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + .18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9 * a, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(g); g.connect(bus.pulse.g); o.start(t); o.stop(t + .65); }
  function hit(t, a, f = 1800){ const s = ctx.createBufferSource(); s.buffer = noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 4; const g = ctx.createGain();
    g.gain.setValueAtTime(.5 * a, t); g.gain.exponentialRampToValueAtTime(.0001, t + .09); s.connect(bp); bp.connect(g); g.connect(bus.pulse.g); s.start(t, Math.random() * 3, .12); }
  function bass(t, a){ const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 41.2; lp.type = 'lowpass'; lp.frequency.value = 160;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35 * a, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 1.1); o.connect(lp); lp.connect(g); g.connect(bus.pulse.g); o.start(t); o.stop(t + 1.2); }
  function ping(t, a){ const s = ctx.createBufferSource(); s.buffer = metalBuf; s.playbackRate.value = .5 + Math.random() * .9; const g = ctx.createGain(), p = ctx.createStereoPanner();
    g.gain.value = .5 * a; p.pan.value = (Math.random() * 2 - 1) * .8; s.connect(g); g.connect(p); p.connect(bus.metal.g); s.start(t); }
  function grain(t, a){ const s = ctx.createBufferSource(), metal = Math.random() < .45; s.buffer = metal ? metalBuf : noise; s.playbackRate.value = metal ? .6 + Math.random() * 2.2 : .5 + Math.random() * 1.6;
    const d = .015 + Math.random() * .07, g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32 * a, t + d * .3); g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(g); g.connect(p); p.connect(bus.grain.g); s.start(t, Math.random() * (s.buffer.duration - .2), d + .02); }
  function swell(t, a){ const s = ctx.createBufferSource(); s.buffer = revBuf; s.playbackRate.value = .6; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600 + Math.random() * 900; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = .5 * a; s.connect(bp); bp.connect(g); g.connect(bus.reverse.g); s.start(t); }

  /* ---------- the score: a scheduler reading the current state ---------- */
  const BPM = 96, SIXTEENTH = 60 / BPM / 4;
  function schedule(){
    if (!ctx || !on) return;
    const w = state.w, mov = Math.min(1, state.vel * 6 + state.push * .6);
    while (nextNote < ctx.currentTime + .12){
      const t = nextNote, s16 = step % 16, beat = s16 % 4 === 0;
      if (s16 === 0) bar++;
      // transition: sparse mechanical thuds
      if (w[1] > .05 && s16 % 8 === 0 && Math.random() < .55) kick(t, w[1] * .5);
      if (w[1] > .05 && Math.random() < .08 * w[1]) hit(t, w[1] * .4, 300 + Math.random() * 600);
      // deconstruction: irregular, fragmented pulses
      if (w[2] > .05){ if (Math.random() < (.14 + mov * .25) * w[2]) (Math.random() < .5 ? kick : hit)(t, w[2] * (.4 + Math.random() * .6), 1200 + Math.random() * 3000); }
      // reassembly: the same hits, increasingly on the grid
      if (w[3] > .05){ const align = state.align; const p = beat ? .25 + align * .75 : (1 - align) * .12;
        if (Math.random() < p * w[3]) (beat ? kick : hit)(t, w[3] * .7); if (s16 === 0 && Math.random() < .5) swell(t, w[3]); }
      // the last room: a minimal hypnotic pulse, deep bass, and sometimes nothing at all
      if (w[4] > .05 && bar % 8 !== 7){ if (beat) kick(t, w[4] * .85); if (s16 === 0) bass(t, w[4]); if (s16 % 4 === 2) hit(t, w[4] * .22, 5200); }
      nextNote += SIXTEENTH; step++;
    }
    // distant metal: rare at first, closer later
    if (ctx.currentTime > nextPing){ ping(ctx.currentTime + .02, .4 + w[2] * .6); nextPing = ctx.currentTime + (reduced ? 9 : 4) + Math.random() * (w[0] > .5 ? 8 : 4); }
    // grains: density follows movement; when the visitor stops, the field settles
    const rate = (w[1] * 3 + w[2] * 26 + w[3] * 9 + w[4] * 1) * (.25 + mov * 1.6) * (reduced ? .4 : 1) * (light ? .6 : 1);
    while (rate > .2 && nextGrain < ctx.currentTime + .1){ grain(nextGrain, Math.min(1, .5 + mov)); nextGrain += 1 / rate * (.5 + Math.random()); }
    if (nextGrain < ctx.currentTime) nextGrain = ctx.currentTime;
  }

  /* ---------- per-frame: crossfade the layers ---------- */
  function update({ p, vel, push, pan, align }){
    state.p = p; state.vel += (vel - state.vel) * .1; state.push += (push - state.push) * .1; state.align = align; state.w = stateWeights(p);
    if (!ctx || !on) return;
    const T = ctx.currentTime, w = state.w, mov = Math.min(1, state.vel * 6);
    LAYERS.forEach((n, i) => { let lvl = 0; for (let s = 0; s < 5; s++) lvl += w[s] * STATES[s][i]; bus[n].g.gain.setTargetAtTime(lvl * (n === 'grain' ? .5 + mov : 1), T, .6); });
    let cutoff = 0; for (let s = 0; s < 5; s++) cutoff += w[s] * STATES[s][8];
    droneF.frequency.setTargetAtTime(cutoff * (1 + mov * .8), T, .5);
    magIndex.gain.setTargetAtTime(align * 220 * w[3] + w[4] * 40, T, .8);
    // the camera moves through space: the metal and the machine follow it in the stereo field
    const sp = reduced ? pan * .3 : pan;
    bus.metal.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, -sp)), T, .4);
    bus.machine.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, sp * .6 + (reduced ? 0 : Math.sin(T * .2) * .5 * w[1]))), T, .6);
  }

  // a subtle answer when the cursor disturbs the matter (rate-limited, never loud)
  function touch(a){ if (!ctx || !on) return; const T = ctx.currentTime; if (T - state.touchAt < .18) return; state.touchAt = T; grain(T + .01, Math.min(.5, a)); }

  function setOn(v){
    if (v && !ctx) init();
    on = v;
    if (ctx){ if (on) ctx.resume(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(on ? .85 : 0, ctx.currentTime, on ? 1.2 : .4); }
    return on;
  }
  return { setOn, update, touch, get on(){ return on; } };
}
