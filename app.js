// ─── State ───────────────────────────────────────────────────────────────────
const STATE = {
  company: 'ebbing',
  view: 'home',        // home | briefing | protokoll | meeting
  briefingLoading: false,
  protokoll: {
    phase: 'idle',     // idle | recording | processing | done
    seconds: 0,
    result: '',
    displayed: '',
  },
  meeting: {
    phase: 'idle',     // idle | recording
    seconds: 0,
  },
};

// ─── Config ──────────────────────────────────────────────────────────────────
const COMPANIES = {
  ebbing: { name: 'Ebbing Project GmbH', short: 'EP', color: '#c8a96e' },
  kriwet: { name: 'Kriwet Projektmanagement GmbH', short: 'KP', color: '#6e9ec8' },
};

const BRIEFING = {
  kritisch: [
    { projekt: 'Zara München', text: 'Elektroplan fehlt seit 5 Tagen — fällig war 02.06.', icon: '⚡' },
    { projekt: 'Peek & Cloppenburg', text: 'Übergabe in 3 Tagen — Bodenbelag noch nicht bestätigt.', icon: '🚨' },
  ],
  achtung: [
    { projekt: 'H&M Köln', text: 'Bauzeitenplan: Überschneidung Trockenbau / Maler KW 25.', icon: '⚠️' },
    { projekt: 'Zara München', text: 'Subunternehmer Elektro seit 2 Tagen ohne Rückmeldung.', icon: '⚠️' },
  ],
  offen: [
    { projekt: 'Zara München', text: 'Nachtragsfrage vom 12.05. — keine Antwort vom AG.', icon: '📌' },
    { projekt: 'P&C Düsseldorf', text: 'Brandschutzfreigabe — zuständige Person noch nicht benannt.', icon: '📌' },
  ],
};

const PROTOKOLL_RESULT =
`Gespräch mit: Thomas Berger (Elektro-Sub)
Datum: Heute · {TIME} Uhr

Entschieden:
• Elektroplan bis Freitag 12:00 Uhr
• Nachtragsangebot kommt separat

Offen:
• Wer gibt intern Freigabe? → Marcus klären
• Terminverschiebung KW 26 noch unklar

Projekt: Zara München`;

// ─── Audio / Recording ───────────────────────────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;

async function startRecording(type) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();

    timerInterval = setInterval(() => {
      if (type === 'protokoll') {
        STATE.protokoll.seconds++;
      } else {
        STATE.meeting.seconds++;
      }
      render();
    }, 1000);
  } catch (err) {
    alert('Mikrofon-Zugriff verweigert. Bitte in den Einstellungen erlauben.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function nowTime() {
  return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
let twInterval = null;
function startTypewriter(text, onUpdate) {
  let i = 0;
  clearInterval(twInterval);
  twInterval = setInterval(() => {
    i++;
    onUpdate(text.slice(0, i));
    if (i >= text.length) clearInterval(twInterval);
  }, 14);
}

// ─── Actions ─────────────────────────────────────────────────────────────────
const A = {
  setCompany(c) { STATE.company = c; render(); },
  setView(v) { STATE.view = v; render(); },

  async startBriefing() {
    STATE.briefingLoading = true; render();
    await delay(1800);
    STATE.briefingLoading = false;
    STATE.view = 'briefing';
    render();
  },

  // Protokoll
  async protokollStart() {
    STATE.protokoll.phase = 'recording';
    STATE.protokoll.seconds = 0;
    render();
    await startRecording('protokoll');
  },
  async protokollStop() {
    stopRecording();
    STATE.protokoll.phase = 'processing'; render();
    await delay(2000);
    STATE.protokoll.phase = 'done';
    STATE.protokoll.displayed = '';
    render();
    const text = PROTOKOLL_RESULT.replace('{TIME}', nowTime());
    startTypewriter(text, val => {
      STATE.protokoll.displayed = val;
      render();
    });
  },
  protokollReset() {
    STATE.protokoll = { phase: 'idle', seconds: 0, result: '', displayed: '' };
    render();
  },

  // Meeting
  async meetingStart() {
    STATE.meeting.phase = 'recording';
    STATE.meeting.seconds = 0;
    render();
    await startRecording('meeting');
  },
  meetingStop() {
    stopRecording();
    STATE.meeting.phase = 'idle';
    STATE.meeting.seconds = 0;
    alert('Aufnahme gespeichert. Transkription folgt.');
    render();
  },
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Render Helpers ──────────────────────────────────────────────────────────
function co() { return COMPANIES[STATE.company]; }

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'className') e.className = v;
      else e.setAttribute(k, v);
    });
  }
  children.flat().forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

function div(style, ...children) { return el('div', { style }, ...children); }
function btn(style, onClick, ...children) { return el('button', { style, onClick }, ...children); }

// ─── Views ────────────────────────────────────────────────────────────────────

function renderHome() {
  const color = co().color;
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Company switch
  const switchEl = div({ display: 'flex', gap: '8px', marginBottom: '24px' },
    ...Object.entries(COMPANIES).map(([key, c]) =>
      btn({
        flex: '1',
        padding: '10px 12px',
        borderRadius: '14px',
        border: STATE.company === key ? `2px solid ${c.color}` : '2px solid #2a2a2a',
        background: STATE.company === key ? `${c.color}18` : 'transparent',
        color: STATE.company === key ? c.color : '#555',
        fontFamily: "'Syne', sans-serif",
        fontWeight: '700',
        fontSize: '11px',
        letterSpacing: '0.8px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        transition: 'all 0.2s',
      }, () => A.setCompany(key),
      `${c.short} · ${key === 'ebbing' ? 'Ebbing' : 'Kriwet'}`
    )
  );

  // Big briefing button
  const briefingBtn = btn({
    width: '100%',
    padding: STATE.briefingLoading ? '28px 24px' : '28px 24px',
    borderRadius: '24px',
    border: `2px solid ${color}`,
    background: `${color}12`,
    cursor: STATE.briefingLoading ? 'default' : 'pointer',
    textAlign: 'left',
    marginBottom: '16px',
    position: 'relative',
    display: 'block',
  }, STATE.briefingLoading ? null : A.startBriefing);

  if (STATE.briefingLoading) {
    const spinner = div({
      width: '32px', height: '32px',
      border: `3px solid ${color}30`,
      borderTop: `3px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto 12px',
    });
    const txt = div({ fontFamily: "'Syne', sans-serif", fontSize: '12px', color, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'center' }, 'Analysiere Projekte…');
    briefingBtn.appendChild(div({}, spinner, txt));
  } else {
    briefingBtn.appendChild(div({ fontSize: '32px', marginBottom: '12px' }, '🔴'));
    briefingBtn.appendChild(div({ fontFamily: "'Syne', sans-serif", fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '6px' }, 'Tages-Briefing'));
    briefingBtn.appendChild(div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#777', lineHeight: '1.5' }, 'Was muss ich heute wissen? Kritisches · Offenes · Warnungen'));
    const arrow = div({ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '24px', color, opacity: '0.6' }, '→');
    briefingBtn.appendChild(arrow);
  }

  // Quick action grid
  const actions = [
    { icon: '🎤', label: 'Gespräch protokollieren', sub: 'Einsprechen → KI strukturiert', view: 'protokoll' },
    { icon: '🏗️', label: 'Meeting aufnehmen', sub: 'Läuft still im Hintergrund', view: 'meeting' },
    { icon: '💬', label: 'WhatsApp importieren', sub: 'Chat exportieren & zuordnen', view: null },
    { icon: '📧', label: 'Outlook', sub: 'Projektgefiltert', view: null },
  ];

  const grid = div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' },
    ...actions.map(a =>
      btn({
        background: '#1a1a1a',
        border: '2px solid #222',
        borderRadius: '20px',
        padding: '18px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
      }, a.view ? () => A.setView(a.view) : null,
        div({ fontSize: '26px', marginBottom: '10px' }, a.icon),
        div({ fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: '700', color: '#fff', marginBottom: '4px', lineHeight: '1.3' }, a.label),
        div({ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#555', lineHeight: '1.4' }, a.sub),
      )
    )
  );

  // Active company indicator
  const indicator = div({
    background: '#1a1a1a', borderRadius: '16px', padding: '14px 18px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
    div({ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: '0', boxShadow: `0 0 8px ${color}` }),
    div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#666' },
      'Aktiv: ', el('span', { style: { color, fontWeight: '600' } }, co().name)
    )
  );

  // Meeting running indicator (if active)
  let meetingBanner = null;
  if (STATE.meeting.phase === 'recording') {
    meetingBanner = div({
      background: '#1a0000', border: '2px solid #e84545', borderRadius: '16px',
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px',
      marginBottom: '16px', cursor: 'pointer',
    },
      el('span', { className: 'rec-dot' }),
      div({ flex: '1' },
        div({ fontFamily: "'Syne', sans-serif", fontSize: '11px', fontWeight: '800', color: '#e84545', letterSpacing: '1px', textTransform: 'uppercase' }, 'Meeting-Aufnahme läuft'),
        div({ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#777', marginTop: '2px' }, formatTime(STATE.meeting.seconds) + ' · Tippen zum Beenden'),
      )
    );
    meetingBanner.addEventListener('click', () => A.setView('meeting'));
  }

  return div({ padding: '40px 22px 0' },
    div({ fontFamily: "'Syne', sans-serif", fontSize: '10px', color: '#444', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '6px', animation: 'fadeUp 0.4s ease both' }, today),
    div({ fontFamily: "'Syne', sans-serif", fontSize: '28px', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '28px', animation: 'fadeUp 0.4s ease 0.1s both' }, 'Guten Morgen 👋'),
    div({ animation: 'fadeUp 0.4s ease 0.2s both' }, switchEl),
    div({ animation: 'fadeUp 0.4s ease 0.3s both' },
      meetingBanner,
      briefingBtn,
      grid,
      indicator,
    )
  );
}

function renderBriefing() {
  const sections = [
    { key: 'kritisch', title: 'Kritisch · Sofort handeln', color: '#e84545', delay: '0.1s' },
    { key: 'achtung',  title: 'Achtung · Im Auge behalten', color: '#f0a500', delay: '0.25s' },
    { key: 'offen',    title: 'Offen · Noch ungeklärt', color: '#6e9ec8', delay: '0.4s' },
  ];

  const header = div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' },
    div({},
      div({ fontFamily: "'Syne', sans-serif", fontSize: '10px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' },
        new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      ),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: '800', color: '#fff' }, 'Tages-Briefing'),
    ),
    btn({ background: '#1a1a1a', border: 'none', color: '#777', width: '40px', height: '40px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      () => A.setView('home'), '✕')
  );

  const sectionsEl = sections.map(s =>
    div({ marginBottom: '20px', animation: `fadeUp 0.4s ease ${s.delay} both` },
      div({ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: '800', letterSpacing: '2px', color: s.color, textTransform: 'uppercase', marginBottom: '10px' }, s.title),
      ...BRIEFING[s.key].map(item =>
        div({ background: '#1a1a1a', borderRadius: '14px', padding: '12px 16px', marginBottom: '8px', borderLeft: `3px solid ${s.color}`, display: 'flex', gap: '12px', alignItems: 'flex-start' },
          div({ fontSize: '16px', flexShrink: '0', marginTop: '1px' }, item.icon),
          div({},
            div({ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: '700', color: s.color, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }, item.projekt),
            div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#d4cfc8', lineHeight: '1.5' }, item.text),
          )
        )
      )
    )
  );

  return div({ padding: '28px 22px 120px' }, header, ...sectionsEl);
}

function renderProtokoll() {
  const p = STATE.protokoll;
  const header = div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    div({ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: '800', color: '#fff' }, 'Gespräch protokollieren'),
    btn({ background: '#1a1a1a', border: 'none', color: '#777', width: '40px', height: '40px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      () => { stopRecording(); A.protokollReset(); A.setView('home'); }, '✕')
  );

  let body;

  if (p.phase === 'idle') {
    body = div({ textAlign: 'center', paddingTop: '40px' },
      div({ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', color: '#666', marginBottom: '48px', lineHeight: '1.6' }, 'Gespräch gerade beendet?', el('br'), 'Kurz einsprechen — KI strukturiert den Rest.'),
      btn({ width: '120px', height: '120px', borderRadius: '50%', background: '#1a1a1a', border: '3px solid #333', color: '#fff', fontSize: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
        A.protokollStart, '🎤'),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '11px', color: '#444', marginTop: '20px', letterSpacing: '1.5px', textTransform: 'uppercase' }, 'Tippen zum Starten')
    );
  } else if (p.phase === 'recording') {
    body = div({ textAlign: 'center', paddingTop: '40px' },
      div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#e84545', marginBottom: '48px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '700' },
        `⏺ Aufnahme läuft · ${formatTime(p.seconds)}`),
      btn({ width: '120px', height: '120px', borderRadius: '50%', background: '#e84545', border: 'none', color: '#fff', fontSize: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', animation: 'pulse 1.5s infinite' },
        A.protokollStop, '⏹'),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '11px', color: '#555', marginTop: '20px', letterSpacing: '1.5px', textTransform: 'uppercase' }, 'Tippen zum Beenden')
    );
  } else if (p.phase === 'processing') {
    body = div({ textAlign: 'center', paddingTop: '80px' },
      div({ fontSize: '48px', marginBottom: '24px' }, '⚙️'),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '13px', color: '#666', letterSpacing: '1.5px', textTransform: 'uppercase' }, 'KI strukturiert das Gespräch…')
    );
  } else if (p.phase === 'done') {
    const isDone = p.displayed.length >= PROTOKOLL_RESULT.replace('{TIME}', '').length - 5;
    body = div({},
      div({
        background: '#1a1a1a', borderRadius: '18px', padding: '20px',
        borderLeft: '3px solid #c8a96e',
        whiteSpace: 'pre-wrap',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '14px', color: '#d4cfc8', lineHeight: '1.7', minHeight: '200px',
      }, p.displayed, !isDone ? el('span', { style: { opacity: '0.5', animation: 'blink 1s infinite' } }, '▌') : ''),
      isDone ? btn({
        width: '100%', marginTop: '16px', padding: '16px',
        borderRadius: '14px', border: 'none', background: '#c8a96e',
        color: '#111', fontFamily: "'Syne', sans-serif", fontWeight: '800',
        fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
      }, () => alert('Gespeichert ✓'), '✓ Protokoll speichern') : null
    );
  }

  return div({ padding: '28px 22px 120px' }, header, body);
}

function renderMeeting() {
  const m = STATE.meeting;
  const header = div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    div({ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: '800', color: '#fff' }, 'Meeting aufnehmen'),
    btn({ background: '#1a1a1a', border: 'none', color: '#777', width: '40px', height: '40px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      () => { if (m.phase === 'recording') stopRecording(); STATE.meeting = { phase: 'idle', seconds: 0 }; A.setView('home'); }, '✕')
  );

  let body;

  if (m.phase === 'idle') {
    body = div({ textAlign: 'center', paddingTop: '40px' },
      div({ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', color: '#666', marginBottom: '16px', lineHeight: '1.6' }, 'Aufnahme läuft still im Hintergrund.', el('br'), 'Du kannst die App wechseln — die Aufnahme läuft weiter.'),
      div({ background: '#1a1a1a', borderRadius: '14px', padding: '14px 18px', marginBottom: '48px', textAlign: 'left' },
        div({ fontFamily: "'Syne', sans-serif", fontSize: '10px', color: '#f0a500', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }, '⚠️ Hinweis'),
        div({ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#777', lineHeight: '1.5' }, 'Bitte alle Teilnehmer kurz informieren, dass aufgezeichnet wird. "Ich mach mir kurz Notizen."'),
      ),
      btn({ width: '120px', height: '120px', borderRadius: '50%', background: '#1a1a1a', border: '3px solid #333', color: '#fff', fontSize: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
        A.meetingStart, '🏗️'),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '11px', color: '#444', marginTop: '20px', letterSpacing: '1.5px', textTransform: 'uppercase' }, 'Tippen zum Starten')
    );
  } else {
    body = div({ textAlign: 'center', paddingTop: '40px' },
      div({ animation: 'pulse 1.5s infinite', display: 'inline-block', width: '16px', height: '16px', background: '#e84545', borderRadius: '50%', marginBottom: '24px' }),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '8px' }, formatTime(m.seconds)),
      div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#e84545', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '700', marginBottom: '60px' }, 'Aufnahme läuft'),
      div({ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#555', marginBottom: '48px' }, 'App wechseln — Aufnahme läuft still weiter.'),
      btn({ width: '120px', height: '120px', borderRadius: '50%', background: '#e84545', border: 'none', color: '#fff', fontSize: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
        A.meetingStop, '⏹'),
      div({ fontFamily: "'Syne', sans-serif", fontSize: '11px', color: '#555', marginTop: '20px', letterSpacing: '1.5px', textTransform: 'uppercase' }, 'Tippen zum Beenden')
    );
  }

  return div({ padding: '28px 22px 120px' }, header, body);
}

function renderNav() {
  const color = co().color;
  const items = [
    { icon: '🏠', label: 'Home', view: 'home' },
    { icon: '📋', label: 'Projekte', view: null },
    { icon: '💬', label: 'Nachrichten', view: null },
    { icon: '⚙️', label: 'Einstellungen', view: null },
  ];

  return div({
    position: 'fixed', bottom: '0', left: '0', right: '0',
    background: '#0d0d0d', borderTop: '1px solid #1e1e1e',
    display: 'flex', justifyContent: 'space-around',
    padding: '12px 0 28px',
    zIndex: '50',
  },
    ...items.map(item =>
      div({
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
        opacity: STATE.view === item.view ? '1' : '0.35', cursor: 'pointer',
        padding: '0 16px',
      },
        div({ fontSize: '22px' }, item.icon),
        div({
          fontFamily: "'Syne', sans-serif", fontSize: '9px',
          fontWeight: STATE.view === item.view ? '800' : '400',
          color: STATE.view === item.view ? color : '#fff',
          letterSpacing: '0.8px', textTransform: 'uppercase',
        }, item.label)
      )
    )
  );
}

// ─── Main Render ─────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const wrapper = div({ height: '100%', background: '#111', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '80px' });

  if (STATE.view === 'home')      wrapper.appendChild(renderHome());
  if (STATE.view === 'briefing')  wrapper.appendChild(renderBriefing());
  if (STATE.view === 'protokoll') wrapper.appendChild(renderProtokoll());
  if (STATE.view === 'meeting')   wrapper.appendChild(renderMeeting());

  app.appendChild(wrapper);
  app.appendChild(renderNav());
}

render();
