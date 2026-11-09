/* BAEDO Journeys · My Journeys member portal (phase 1) */
(function () {
  'use strict';
  const sb = window.BAEDO && BAEDO.sb;
  const root = document.getElementById('portal');
  if (!root) return;
  if (!sb) { root.innerHTML = '<div class="pt-wrap pt-pad"><p>My Journeys is not available right now. Please try again later.</p></div>'; return; }

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const $ = (sel, el) => (el || root).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || root).querySelectorAll(sel));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const d12 = (iso) => new Date(iso + 'T12:00:00');
  const fmt = (iso, o) => iso ? d12(iso).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const fmtShort = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (t) => t ? String(t).slice(0, 5) : '';
  const money = (n, cur) => n == null ? '' : new Intl.NumberFormat('en-BE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n));
  const range = (t) => {
    if (!t.start_date) return 'Dates to follow';
    if (!t.end_date) return fmt(t.start_date);
    const s = d12(t.start_date), e = d12(t.end_date);
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return s.getDate() + ' – ' + fmt(t.end_date);
    if (s.getFullYear() === e.getFullYear()) return fmt(t.start_date, { day: 'numeric', month: 'long' }) + ' – ' + fmt(t.end_date);
    return fmt(t.start_date) + ' – ' + fmt(t.end_date);
  };
  const nights = (t) => (t.start_date && t.end_date) ? Math.round((d12(t.end_date) - d12(t.start_date)) / 864e5) : null;
  const IMG = 'https://ijmeuqjcsgepoxjxmbjb.supabase.co/storage/v1/object/public/site-images/';
  const imgFor = (t) => {
    if (t.cover_url) return t.cover_url;
    const s = ((t.destination || '') + ' ' + (t.title || '')).toLowerCase();
    if (/tenerif|canar/.test(s)) return IMG + 'tenerife';
    if (/lofoten|norw/.test(s)) return IMG + 'lofoten';
    if (/moroc|maroc|marrak|agadir/.test(s)) return IMG + 'morocco';
    if (['perform', 'discover', 'relax'].includes(t.formula)) return IMG + 'f-' + t.formula;
    return IMG + 'tailor';
  };
  const phaseOf = (t) => {
    const td = todayISO();
    if (t.end_date && t.end_date < td) return 'progress';
    if (t.start_date && t.start_date <= td && (!t.end_date || t.end_date >= td)) return 'perform';
    return 'prepare';
  };
  const toast = (msg) => {
    let el = document.getElementById('pt-toast');
    if (!el) { el = document.createElement('div'); el.id = 'pt-toast'; el.className = 'pt-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2600);
  };
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const KIND = { sport: 'On the course', coaching: 'Coaching', transfer: 'Transfer', dining: 'Dining', hotel: 'Stay', leisure: 'Leisure', meeting: 'Meeting', other: '' };
  const DOC = { booking: 'Booking confirmations', invoice: 'Invoices', receipt: 'Payment receipts', flight: 'Flight information', hotel: 'Hotel vouchers', transfer: 'Transfer vouchers', itinerary: 'Travel itinerary', insurance: 'Insurance', guide: 'Practical guides', other: 'Other documents' };
  const REQ = { restaurant: 'Restaurant reservation', transfer: 'Private transfer', wellness: 'Wellness', excursion: 'Extra excursion', coaching: 'Private coaching', room: 'Room wish', occasion: 'Special occasion', change: 'Change an activity', question: 'A question' };
  const REQSTATUS = { received: 'Received', in_progress: 'In progress', awaiting_confirmation: 'Awaiting confirmation', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };

  // ---------- state ----------
  const S = { user: null, profile: {}, admin: false, trips: [], guests: [], days: [], acts: [], resp: {}, bookings: [], pays: [], docs: [], urls: {}, reqs: [], msgs: {}, goals: [], sessions: [], items: [], checks: new Set(), results: [], view: { dayIdx: {}, mode: {} }, wx: {} };

  // ---------- login ----------
  function otpBoxes(id, label, type) {
    return `<div class="pt-otp" id="${id}" role="group" aria-label="${label}">${[1, 2, 3, 4, 5, 6].map(i => `<input type="${type || 'text'}" inputmode="numeric" maxlength="1" ${i === 1 && !type ? 'autocomplete="one-time-code"' : 'autocomplete="off"'} aria-label="${label}, digit ${i}">`).join('')}</div>`;
  }
  function wireOtp(group, onFull) {
    const ins = Array.from(group.querySelectorAll('input'));
    const fill = (d, from) => { d.slice(0, 6 - from).split('').forEach((c, k) => ins[from + k].value = c); (ins.find(x => !x.value) || ins[5]).focus(); if (ins.every(x => x.value) && onFull) onFull(); };
    ins.forEach((inp, i) => {
      inp.addEventListener('input', () => { const v = inp.value.replace(/\D/g, ''); if (v.length > 1) return fill(v, i); inp.value = v; if (v && ins[i + 1]) ins[i + 1].focus(); if (ins.every(x => x.value) && onFull) onFull(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) { ins[i - 1].focus(); ins[i - 1].value = ''; } });
      inp.addEventListener('paste', e => { e.preventDefault(); fill((e.clipboardData.getData('text') || '').replace(/\D/g, ''), 0); });
    });
    return { get: () => ins.map(x => x.value).join(''), clear: () => ins.forEach(x => x.value = ''), focus: () => ins[0].focus(), shake: () => { group.classList.remove('shake'); void group.offsetWidth; group.classList.add('shake'); } };
  }
  function renderLogin() {
    document.body.classList.add('pt-is-login');
    root.innerHTML = `<section class="pt-login">
      <div class="pt-login-photo" style="background-image:url(${IMG}rest)"><div class="pt-login-quote"><p class="pt-k">My Journeys</p><p class="pt-quote">Your journey begins <em>long before departure.</em></p></div></div>
      <div class="pt-login-panel"><div class="pt-login-inner">
        <div data-step="email">
          <p class="pt-step"><span>01</span> Your email</p>
          <h1>Welcome <em>back.</em></h1>
          <p class="pt-muted pt-intro">Enter your email address. We send you a six-digit code. Or use your PIN.</p>
          <form id="f-email" class="pt-form" novalidate>
            <div class="pt-field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
            <button class="pt-btn primary wide" type="submit">Email me a code</button>
            <button class="pt-btn wide" type="button" data-a="to-pin">Log in with my PIN</button>
            <p class="pt-msg" id="m-email" role="status" aria-live="polite"></p>
          </form>
        </div>
        <div data-step="code" hidden>
          <p class="pt-step"><span>02</span> Your code</p>
          <h1>Check your <em>inbox.</em></h1>
          <p class="pt-muted pt-intro">We sent a code to <strong data-email></strong>. Type it below, or use the link in the email.</p>
          <form id="f-code" class="pt-form" novalidate>${otpBoxes('o-code', 'Six-digit code')}
            <button class="pt-btn primary wide" type="submit">Log in</button>
            <p class="pt-msg" id="m-code" role="status" aria-live="polite"></p>
            <p class="pt-small"><button type="button" class="pt-link" data-a="resend">Send a new code</button> · <button type="button" class="pt-link" data-a="to-email">Use another email</button></p>
          </form>
        </div>
        <div data-step="pin" hidden>
          <p class="pt-step"><span>02</span> Your PIN</p>
          <h1>Welcome <em>back.</em></h1>
          <p class="pt-muted pt-intro">Your six-digit PIN for <strong data-email></strong>.</p>
          <form id="f-pin" class="pt-form" novalidate>${otpBoxes('o-pin', 'PIN', 'password')}
            <button class="pt-btn primary wide" type="submit">Log in</button>
            <p class="pt-msg" id="m-pin" role="status" aria-live="polite"></p>
            <p class="pt-small"><button type="button" class="pt-link" data-a="pin-forgot">Forgot your PIN? Email me a code</button> · <button type="button" class="pt-link" data-a="to-email">Use another email</button></p>
          </form>
        </div>
        <p class="pt-small pt-muted pt-help">Trouble logging in? Mail <a href="mailto:info@baedojourneys.com">info@baedojourneys.com</a></p>
      </div></div></section>`;
    const step = (n) => { $$('[data-step]').forEach(s => s.hidden = s.dataset.step !== n); };
    const email = () => $('#l-email').value.trim();
    const msg = (id, t, err) => { const m = $('#' + id); m.textContent = t; m.className = 'pt-msg' + (err ? ' err' : ''); };
    const code = wireOtp($('#o-code'), () => $('#f-code').requestSubmit());
    const pin = wireOtp($('#o-pin'), () => $('#f-pin').requestSubmit());
    const send = async () => {
      const { error } = await sb.auth.signInWithOtp({ email: email(), options: { emailRedirectTo: location.origin + '/my-journeys.html' } });
      return error;
    };
    $('#f-email').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validEmail(email())) return msg('m-email', 'Enter a valid email address.', true);
      msg('m-email', 'Sending…');
      const err = await send();
      if (err) return msg('m-email', /rate|seconds/i.test(err.message || '') ? 'Wait a minute before asking for a new code.' : 'We couldn’t send the code just now. Try again in a few minutes.', true);
      msg('m-email', ''); $$('[data-email]').forEach(x => x.textContent = email()); step('code'); code.clear(); code.focus();
    });
    let busy = false;
    $('#f-code').addEventListener('submit', async (e) => {
      e.preventDefault(); if (busy) return;
      if (code.get().length < 6) return msg('m-code', 'Type the six digits from the email.', true);
      busy = true; msg('m-code', 'Checking…');
      const { error } = await sb.auth.verifyOtp({ email: email(), token: code.get(), type: 'email' });
      busy = false;
      if (error) { msg('m-code', 'That code didn’t work. It may have expired, so ask for a new one.', true); code.shake(); code.clear(); code.focus(); }
    });
    $('#f-pin').addEventListener('submit', async (e) => {
      e.preventDefault(); if (busy) return;
      if (pin.get().length < 6) return msg('m-pin', 'Type all six digits.', true);
      busy = true; msg('m-pin', 'Checking…');
      const { error } = await sb.auth.signInWithPassword({ email: email(), password: pin.get() });
      busy = false;
      if (error) { msg('m-pin', /rate|many/i.test(error.message || '') ? 'Too many attempts. Wait a few minutes, or email yourself a code.' : 'That PIN isn’t right. Try again, or email yourself a code.', true); pin.shake(); pin.clear(); pin.focus(); }
    });
    root.querySelector('.pt-login').addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'to-email') { step('email'); $('#l-email').focus(); }
      if (act === 'to-pin') { if (!validEmail(email())) { msg('m-email', 'Enter your email address first.', true); return $('#l-email').focus(); } msg('m-email', ''); $$('[data-email]').forEach(x => x.textContent = email()); step('pin'); pin.clear(); pin.focus(); }
      if (act === 'pin-forgot') { step('email'); $('#f-email').requestSubmit(); }
      if (act === 'resend') { msg('m-code', 'Sending…'); const err = await send(); msg('m-code', err ? 'Wait a minute before asking for a new code.' : 'A new code is on its way.', !!err); }
    });
    setTimeout(() => $('#l-email') && $('#l-email').focus(), 50);
  }

  // ---------- data ----------
  async function loadAll() {
    const uid = S.user.id, email = (S.user.email || '').toLowerCase();
    const [prof, guests, admin, bookings, reqs, goals, checks, items] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('trip_guests').select('*').eq('email', email),
      sb.rpc('is_admin'),
      sb.from('bookings').select('*').eq('guest_email', email),
      sb.from('concierge_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      sb.from('performance_goals').select('*').eq('user_id', uid).order('created_at'),
      sb.from('checklist_checks').select('*').eq('user_id', uid),
      sb.from('checklist_items').select('*').order('sort')
    ]);
    S.profile = prof.data || {};
    S.admin = admin.data === true;
    S.guests = (guests.data || []).filter(g => g.status !== 'cancelled');
    S.bookings = (bookings.data || []).filter(b => b.status !== 'cancelled');
    S.reqs = reqs.data || [];
    S.goals = goals.data || [];
    S.checks = new Set((checks.data || []).map(c => c.item_id + '|' + c.trip_id));
    S.items = items.data || [];
    const ids = S.guests.map(g => g.trip_id);
    if (ids.length) {
      const [trips, days, acts, resp, docs, sessions, results] = await Promise.all([
        sb.from('trips').select('*').in('id', ids),
        sb.from('trip_days').select('*').in('trip_id', ids).order('day_number'),
        sb.from('trip_activities').select('*').in('trip_id', ids).order('sort').order('start_time'),
        sb.from('activity_responses').select('*').eq('user_id', uid),
        sb.from('trip_files').select('*').in('trip_id', ids).order('published_at', { ascending: false }),
        sb.from('coaching_sessions').select('*').order('starts_at'),
        sb.from('round_results').select('*').in('trip_id', ids).order('round_date')
      ]);
      S.trips = (trips.data || []).sort((a, b) => (a.start_date || '9') < (b.start_date || '9') ? -1 : 1);
      S.days = days.data || []; S.acts = acts.data || []; S.docs = docs.data || []; S.sessions = sessions.data || []; S.results = results.data || [];
      S.resp = {}; (resp.data || []).forEach(r => S.resp[r.activity_id] = r);
    } else { S.trips = []; S.days = []; S.acts = []; S.docs = []; S.sessions = (await sb.from('coaching_sessions').select('*').order('starts_at')).data || []; S.results = []; S.resp = {}; }
    const bids = S.bookings.map(b => b.id);
    S.pays = bids.length ? ((await sb.from('payment_items').select('*').in('booking_id', bids).order('due_date')).data || []) : [];
  }
  async function signedUrl(f) {
    if (S.urls[f.id]) return S.urls[f.id];
    const { data } = await sb.storage.from('trip-files').createSignedUrl(f.storage_path, 3600);
    if (data) S.urls[f.id] = data.signedUrl;
    return S.urls[f.id];
  }

  // ---------- derived ----------
  const tripById = (id) => S.trips.find(t => t.id === id);
  const guestOf = (t) => S.guests.find(g => g.trip_id === t.id);
  const bookingOf = (t) => S.bookings.find(b => b.trip_id === t.id);
  const daysOf = (t) => S.days.filter(d => d.trip_id === t.id).sort((a, b) => a.day_number - b.day_number);
  const actsOf = (dayId) => S.acts.filter(a => a.day_id === dayId).sort((a, b) => (a.sort - b.sort) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const checklistOf = (t) => {
    const own = S.items.filter(i => i.trip_id === t.id);
    return S.items.filter(i => !i.trip_id).concat(own).sort((a, b) => a.sort - b.sort);
  };
  const isChecked = (item, t) => S.checks.has(item.id + '|' + t.id);
  const nextTrip = () => {
    const td = todayISO();
    return S.trips.filter(t => !t.end_date || t.end_date >= td)[0] || null;
  };
  const firstName = () => (S.profile.first_name || (S.profile.full_name || '').split(' ')[0] || '').trim();
  function progressSteps(t) {
    const g = guestOf(t), b = bookingOf(t), td = todayISO();
    const prepStarted = checklistOf(t).some(i => isChecked(i, t)) || S.goals.some(x => x.trip_id === t.id);
    const docsReady = S.docs.some(d => d.trip_id === t.id && ['flight', 'hotel', 'transfer', 'itinerary'].includes(d.category));
    return [
      { label: 'Booking confirmed', done: (b && b.status === 'confirmed') || (g && g.status === 'confirmed') },
      { label: 'Profile completed', done: !!S.profile.onboarded_at },
      { label: 'Preparation started', done: prepStarted },
      { label: 'Travel documents ready', done: docsReady },
      { label: 'Final itinerary published', done: t.itinerary_status === 'published' },
      { label: 'Departure', done: !!t.start_date && t.start_date <= td },
      { label: 'Journey completed', done: !!t.end_date && t.end_date < td }
    ];
  }
  function moments() {
    const out = [], td = todayISO(), soon = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10), recent = new Date(Date.now() - 21 * 864e5).toISOString();
    S.pays.filter(p => p.status === 'due').forEach(p => {
      const b = S.bookings.find(x => x.id === p.booking_id); const t = b && tripById(b.trip_id);
      out.push({ when: p.due_date || '9999', label: p.due_date && p.due_date < td ? 'Overdue payment' : 'Payment due', title: p.label + (Number(p.amount) ? ' · ' + money(p.amount, b && b.currency) : ''), meta: p.due_date ? 'Due ' + fmt(p.due_date) : '', href: '#/payments', warn: p.due_date && p.due_date < td });
    });
    S.docs.filter(d => d.published_at >= recent).forEach(d => out.push({ when: d.published_at.slice(0, 10), label: 'New document', title: d.title || DOC[d.category], meta: (tripById(d.trip_id) || {}).title || '', href: '#/wallet' }));
    S.reqs.filter(r => ['in_progress', 'awaiting_confirmation', 'confirmed'].includes(r.status)).forEach(r => out.push({ when: r.updated_at.slice(0, 10), label: 'Concierge', title: r.subject, meta: REQSTATUS[r.status], href: '#/concierge/' + r.id }));
    S.trips.forEach(t => {
      if (t.itinerary_status === 'published' && t.start_date >= td) out.push({ when: t.start_date, label: 'Itinerary', title: 'Your final programme is ready', meta: t.title, href: '#/journey/' + t.id });
    });
    S.sessions.filter(s => s.starts_at.slice(0, 10) >= td && s.starts_at.slice(0, 10) <= soon).forEach(s => out.push({ when: s.starts_at.slice(0, 10), label: 'Coaching', title: s.title, meta: new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), href: '#/performance' }));
    return out.sort((a, b) => a.when < b.when ? -1 : 1).slice(0, 6);
  }

  // ---------- time zones and calendar ----------
  function tzOffsetMin(date, tz) {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).reduce((o, x) => (o[x.type] = x.value, o), {});
      return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 6e4;
    } catch (e) { return 0; }
  }
  function localToUTC(dateISO, hhmm, tz) {
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    const guess = new Date(Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10), h, m));
    return new Date(guess.getTime() - tzOffsetMin(guess, tz || 'UTC') * 6e4);
  }
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  function icsFor(t, acts) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAEDO Journeys//My Journeys//EN', 'CALSCALE:GREGORIAN'];
    acts.forEach(a => {
      const day = S.days.find(d => d.id === a.day_id); if (!day || !day.day_date) return;
      const start = localToUTC(day.day_date, time(a.start_time), t.timezone);
      const end = a.end_time ? localToUTC(day.day_date, time(a.end_time), t.timezone) : new Date(start.getTime() + 60 * 6e4);
      lines.push('BEGIN:VEVENT', 'UID:' + a.id + '@baedojourneys.com', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
        'SUMMARY:' + icsEsc(a.title), 'LOCATION:' + icsEsc([a.location, a.address].filter(Boolean).join(', ')),
        'DESCRIPTION:' + icsEsc([a.meeting_point && 'Meeting point: ' + a.meeting_point, a.dress_code && 'Dress code: ' + a.dress_code, a.instructions].filter(Boolean).join('\n') + '\n' + t.title), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (acts.length === 1 ? acts[0].title : t.title).replace(/[^\w\- ]+/g, '').trim() + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const mapLink = (a) => (a.lat && a.lng) ? `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}` : (a.address || a.location) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.location, a.address].filter(Boolean).join(', '))}` : '';
  async function weather(t) {
    if (!t.lat || !t.lng) return null;
    if (S.wx[t.id]) return S.wx[t.id];
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${t.lat}&longitude=${t.lng}&current=temperature_2m,weather_code&timezone=auto`);
      const j = await r.json();
      const c = j.current || {}; const w = c.weather_code;
      const word = w === 0 ? 'Clear' : w <= 2 ? 'Mostly sunny' : w === 3 ? 'Cloudy' : w <= 48 ? 'Misty' : w <= 67 ? 'Rain' : w <= 77 ? 'Snow' : w <= 82 ? 'Showers' : 'Stormy';
      S.wx[t.id] = { temp: Math.round(c.temperature_2m), word };
      return S.wx[t.id];
    } catch (e) { return null; }
  }
  const localTime = (tz) => { try { return new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  // ---------- shell ----------
  const NAV = [['', 'Home'], ['journeys', 'Journeys'], ['concierge', 'Concierge'], ['wallet', 'Wallet'], ['profile', 'Profile']];
  function shell(active, inner) {
    const sub = [['performance', 'Performance'], ['payments', 'Payments']];
    return `<div class="pt-app">
      <nav class="pt-nav" aria-label="My Journeys"><div class="pt-wrap pt-nav-in">
        ${NAV.map(([k, l]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
        <span class="pt-nav-sep" aria-hidden="true"></span>
        ${sub.map(([k, l]) => `<a href="#/${k}" class="pt-nav-sub ${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
        ${S.admin ? '<a href="/admin.html" class="pt-nav-sub">Manage</a>' : ''}
      </div></nav>
      <main class="pt-main" id="pt-main" tabindex="-1">${inner}</main>
      <nav class="pt-tabs" aria-label="My Journeys">${NAV.map(([k, l]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    </div>`;
  }
  const head = (kicker, title, sub) => `<header class="pt-head pt-wrap"><p class="pt-k pt-accent">${kicker}</p><h1>${title}</h1>${sub ? `<p class="pt-lede">${sub}</p>` : ''}</header>`;

  // ---------- dashboard ----------
  function viewHome() {
    const t = nextTrip(), name = firstName();
    const phase = t ? phaseOf(t) : null;
    if (t && phase === 'perform') return viewToday(t);
    const past = S.trips.filter(x => phaseOf(x) === 'progress');
    let html = `<header class="pt-head pt-wrap"><p class="pt-k pt-accent">My Journeys</p><h1>${name ? `Welcome back, <em>${esc(name)}.</em>` : 'Welcome <em>back.</em>'}</h1><p class="pt-lede">${t ? 'Your next chapter awaits.' : past.length ? 'Welcome home. Where to next?' : 'Your first journey starts here.'}</p></header>`;
    if (t) {
      const g = guestOf(t), b = bookingOf(t);
      const status = (b && b.status === 'confirmed') || (g && g.status === 'confirmed') ? 'Confirmed' : 'Requested';
      html += `<section class="pt-hero" style="background-image:url(${esc(imgFor(t))})" aria-label="Your next journey">
        <div class="pt-hero-in pt-wrap">
          <div><p class="pt-k pt-glow">${esc(t.destination || '')} · ${status}</p><h2>${esc(t.title)}</h2><p class="pt-hero-sub">${range(t)}${nights(t) ? ' · ' + nights(t) + ' nights' : ''}</p>
          <a class="pt-btn light" href="#/journey/${t.id}">Explore your journey</a></div>
          <div class="pt-count" data-countdown="${t.start_date || ''}" data-tz="${esc(t.timezone || '')}"></div>
        </div></section>`;
      const steps = progressSteps(t), cur = steps.findIndex(s => !s.done);
      html += `<section class="pt-wrap pt-sec"><p class="pt-k pt-muted">Journey progress</p>
        <ol class="pt-steps">${steps.map((s, i) => `<li class="${s.done ? 'done' : i === cur ? 'cur' : ''}"><span class="pt-dot" aria-hidden="true"></span><span>${s.label}</span><span class="sr-only">${s.done ? ' (done)' : i === cur ? ' (next)' : ''}</span></li>`).join('')}</ol></section>`;
      const list = checklistOf(t), next = list.find(i => !isChecked(i, t)), done = list.filter(i => isChecked(i, t)).length;
      html += `<section class="pt-wrap pt-sec pt-split">
        <div><p class="pt-k pt-muted">Before you go · ${done} of ${list.length}</p>
          ${next ? `<a class="pt-next" href="#/journey/${t.id}/prepare"><span>${esc(next.label)}</span><span class="pt-arrow" aria-hidden="true">→</span></a>` : `<p class="pt-statement">All set. <em>Enjoy.</em></p>`}
          <div class="pt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${done}" aria-label="Preparation"><i style="width:${Math.round(done / Math.max(1, list.length) * 100)}%"></i></div></div>
        <div class="pt-wx" data-wx="${t.id}"></div>
      </section>`;
    } else {
      html += `<section class="pt-wrap pt-sec pt-empty"><img src="/assets/monogram.svg" alt="" width="56" height="56"><h2>No journey planned <em>yet.</em></h2><p class="pt-muted">Once we confirm a journey with you, it appears here: your programme, documents and everything to prepare.</p><p class="pt-row"><a class="pt-btn primary" href="/journeys.html">Perform journeys 2027</a><a class="pt-btn" href="/tailor-made.html">Design your own</a></p></section>`;
    }
    const ms = moments();
    html += `<section class="pt-wrap pt-sec pt-two">
      <div><p class="pt-k pt-muted">Upcoming moments</p>${ms.length ? `<ul class="pt-list">${ms.map(m => `<li><a href="${m.href}"><span class="pt-k ${m.warn ? 'pt-accent' : 'pt-muted'}">${m.label}</span><span class="pt-li-title">${esc(m.title)}</span>${m.meta ? `<span class="pt-muted pt-small">${esc(m.meta)}</span>` : ''}</a></li>`).join('')}</ul>` : '<p class="pt-muted pt-gap">Nothing needs your attention. We’ll let you know when something does.</p>'}</div>
      <div>${perfSnapshot()}</div>
    </section>
    <section class="pt-wrap pt-sec pt-concierge"><p class="pt-statement">Is there anything we can <em>arrange for you?</em></p><a class="pt-btn" href="#/concierge/new">Ask the concierge</a></section>
    ${curated()}`;
    return shell('', html);
  }
  function perfSnapshot() {
    const active = S.goals.filter(g => g.status === 'active');
    const next = S.sessions.find(s => s.starts_at >= new Date().toISOString());
    return `<p class="pt-k pt-muted">Your performance</p>
      ${active.length ? `<ul class="pt-list">${active.slice(0, 3).map(g => `<li><a href="#/performance"><span class="pt-li-title">${esc(g.title)}</span>${g.set_by === 'coach' ? '<span class="pt-muted pt-small">Set with your coach</span>' : ''}</a></li>`).join('')}</ul>` : `<p class="pt-gap"><a class="pt-next sm" href="#/performance"><span>Set a goal for your next journey</span><span class="pt-arrow" aria-hidden="true">→</span></a></p>`}
      ${next ? `<p class="pt-small pt-muted pt-gap">Next coaching: ${esc(next.title)}, ${new Date(next.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>` : ''}`;
  }
  function curated() {
    const own = S.trips.map(t => (t.destination || '').toLowerCase()).join(' ');
    const all = [['tenerife', 'Tenerife', 'Sun, sea and a pro by your side.'], ['lofoten', 'Lofoten', 'Golf under the midnight sun.'], ['morocco', 'Morocco', 'Desert light, green fairways.']].filter(x => !own.includes(x[0]));
    if (!all.length) return '';
    return `<section class="pt-wrap pt-sec"><p class="pt-k pt-muted">Perform journeys 2027</p><div class="pt-cur">${all.map(([k, n, l]) => `<a class="pt-cur-card" href="/journeys/${k}.html"><span class="pt-cur-img" style="background-image:url(${IMG + k})"></span><span class="pt-cur-t">${n}</span><span class="pt-muted pt-small">${l}</span></a>`).join('')}</div></section>`;
  }

  // ---------- today (travel companion) ----------
  function viewToday(t) {
    const td = todayISO(), day = daysOf(t).find(d => d.day_date === td);
    const acts = day ? actsOf(day.id) : [];
    const nowHM = localTime(t.timezone || undefined) || new Date().toTimeString().slice(0, 5);
    const next = acts.find(a => time(a.start_time) >= nowHM) || null;
    const name = firstName();
    let html = `<header class="pt-head pt-wrap"><p class="pt-k pt-accent">${esc(t.destination || '')}${day ? ' · Day ' + day.day_number : ''}</p><h1>${greet()}${name ? ', <em>' + esc(name) + '.</em>' : '.'}</h1><p class="pt-lede">Here’s what awaits you today.</p></header>`;
    if (next) {
      html += `<section class="pt-wrap pt-sec pt-now"><p class="pt-k pt-muted">Next · ${time(next.start_time)}</p><h2>${esc(next.title)}</h2>
        <dl class="pt-dl">${next.location ? `<dt>Where</dt><dd>${esc(next.location)}${mapLink(next) ? ` · <a href="${mapLink(next)}" target="_blank" rel="noopener">Open map</a>` : ''}</dd>` : ''}${next.meeting_point ? `<dt>Meet</dt><dd>${esc(next.meeting_point)}</dd>` : ''}${next.coach ? `<dt>With</dt><dd>${esc(next.coach)}</dd>` : ''}${next.dress_code ? `<dt>Wear</dt><dd>${esc(next.dress_code)}</dd>` : ''}${next.instructions ? `<dt>Note</dt><dd>${nl(next.instructions)}</dd>` : ''}</dl></section>`;
    } else html += `<section class="pt-wrap pt-sec"><p class="pt-statement">The rest of today is <em>yours.</em></p></section>`;
    html += `<section class="pt-wrap pt-sec"><p class="pt-k pt-muted">Today</p>${dayList(t, acts)}</section>
      <section class="pt-wrap pt-sec pt-split"><div><p class="pt-k pt-muted">Your host</p><p class="pt-li-title">${esc(t.host_name || 'BAEDO Journeys')}</p>${t.host_phone ? `<p class="pt-row"><a class="pt-btn" href="tel:${esc(t.host_phone.replace(/\s/g, ''))}">Call</a><a class="pt-btn" href="https://wa.me/${esc(t.host_phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a></p>` : `<p class="pt-row"><a class="pt-btn" href="#/concierge/new?trip=${t.id}">Message us</a></p>`}</div><div class="pt-wx" data-wx="${t.id}"></div></section>
      <section class="pt-wrap pt-sec"><a class="pt-next" href="#/journey/${t.id}"><span>The full journey</span><span class="pt-arrow" aria-hidden="true">→</span></a></section>`;
    return shell('', html);
  }

  // ---------- journeys ----------
  function card(t) {
    const g = guestOf(t), b = bookingOf(t), confirmed = (b && b.status === 'confirmed') || (g && g.status === 'confirmed');
    return `<a class="pt-card" href="#/journey/${t.id}"><span class="pt-card-img" style="background-image:url(${esc(imgFor(t))})"></span>
      <span class="pt-card-b"><span class="pt-k pt-muted">${esc(t.destination || '')} · ${confirmed ? 'Confirmed' : 'Requested'}</span><span class="pt-card-t">${esc(t.title)}</span><span class="pt-muted pt-small">${range(t)}${nights(t) ? ' · ' + nights(t) + ' nights' : ''}${t.host_name ? ' · ' + esc(t.host_name) : ''}</span></span></a>`;
  }
  function viewJourneys() {
    const groups = [['perform', 'Current journey'], ['prepare', 'Upcoming'], ['progress', 'Past journeys']];
    let html = head('My Journeys', 'Your <em>journeys.</em>');
    if (!S.trips.length) html += `<section class="pt-wrap pt-sec pt-empty"><h2>No journeys <em>yet.</em></h2><p class="pt-muted">Your confirmed journeys appear here.</p><p class="pt-row"><a class="pt-btn primary" href="/journeys.html">Discover Perform journeys</a></p></section>`;
    groups.forEach(([ph, label]) => {
      const list = S.trips.filter(t => phaseOf(t) === ph); if (ph === 'progress') list.reverse();
      if (list.length) html += `<section class="pt-wrap pt-sec"><p class="pt-k pt-muted">${label}</p><div class="pt-grid">${list.map(card).join('')}</div></section>`;
    });
    return shell('journeys', html);
  }

  // ---------- journey detail ----------
  function viewJourney(id, tab) {
    const t = tripById(id);
    if (!t) return shell('journeys', `<section class="pt-wrap pt-sec pt-empty"><h2>Journey not <em>found.</em></h2><p class="pt-row"><a class="pt-btn" href="#/journeys">All journeys</a></p></section>`);
    const g = guestOf(t), b = bookingOf(t), confirmed = (b && b.status === 'confirmed') || (g && g.status === 'confirmed');
    const showScores = t.challenges_enabled || S.results.some(r => r.trip_id === t.id);
    const tabs = [['itinerary', 'Itinerary'], ['essentials', 'Essentials'], ['prepare', 'Prepare'], ['wallet', 'Documents'], ['payments', 'Payments']].concat(showScores ? [['scores', 'Scores']] : []);
    tab = tabs.some(x => x[0] === tab) ? tab : 'itinerary';
    const body = { itinerary: tabItinerary, essentials: tabEssentials, prepare: tabPrepare, wallet: (x) => walletList(S.docs.filter(d => d.trip_id === x.id)), payments: (x) => paymentsList(S.bookings.filter(bk => bk.trip_id === x.id)), scores: tabScores }[tab](t);
    const html = `<section class="pt-jhero" style="background-image:url(${esc(imgFor(t))})"><div class="pt-wrap pt-jhero-in">
        <a class="pt-back" href="#/journeys">← All journeys</a>
        <p class="pt-k pt-glow">${esc(t.destination || '')} · ${confirmed ? 'Confirmed' : 'Requested'}${t.itinerary_status === 'published' ? '' : ' · Programme provisional'}</p>
        <h1>${esc(t.title)}</h1>
        <p class="pt-hero-sub">${range(t)}${nights(t) ? ' · ' + nights(t) + ' nights' : ''}</p>
        ${phaseOf(t) === 'prepare' ? `<div class="pt-count sm" data-countdown="${t.start_date || ''}" data-tz="${esc(t.timezone || '')}"></div>` : ''}
      </div></section>
      ${t.welcome_message ? `<section class="pt-wrap pt-sec"><p class="pt-welcome">${nl(t.welcome_message)}</p></section>` : ''}
      <nav class="pt-tabbar" aria-label="Journey sections"><div class="pt-wrap">${tabs.map(([k, l]) => `<a href="#/journey/${t.id}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</div></nav>
      <div class="pt-wrap pt-sec pt-fade">${body}</div>`;
    return shell('journeys', html);
  }
  function actRow(a, t) {
    const r = S.resp[a.id], isIn = a.optional ? (r ? r.response === 'in' : false) : true;
    const ml = mapLink(a);
    const details = [a.description && `<p>${nl(a.description)}</p>`,
      (a.location || a.address) && `<p><span class="pt-k pt-muted">Where</span> ${esc([a.location, a.address].filter(Boolean).join(', '))}${ml ? ` · <a href="${ml}" target="_blank" rel="noopener">Open map</a>` : ''}</p>`,
      a.meeting_point && `<p><span class="pt-k pt-muted">Meet</span> ${esc(a.meeting_point)}</p>`,
      a.coach && `<p><span class="pt-k pt-muted">With</span> ${esc(a.coach)}</p>`,
      a.dress_code && `<p><span class="pt-k pt-muted">Wear</span> ${esc(a.dress_code)}</p>`,
      a.instructions && `<p><span class="pt-k pt-muted">Note</span> ${nl(a.instructions)}</p>`].filter(Boolean).join('');
    return `<li class="pt-act ${a.optional && !isIn ? 'off' : ''}">
      <details><summary><span class="pt-act-time">${time(a.start_time) || '—'}</span><span class="pt-act-main"><span class="pt-act-t">${esc(a.title)}</span><span class="pt-muted pt-small">${esc([KIND[a.kind], a.location].filter(Boolean).join(' · '))}</span></span><span class="pt-chev" aria-hidden="true"></span></summary>
      <div class="pt-act-more">${details || '<p class="pt-muted">More details follow.</p>'}
        <p class="pt-row">${a.optional ? `<button type="button" class="pt-btn sm ${isIn ? 'dark' : ''}" data-a="rsvp" data-id="${a.id}" data-v="${isIn ? 'skip' : 'in'}" aria-pressed="${isIn}">${isIn ? 'You’re in' : 'Join'}</button>` : ''}<button type="button" class="pt-btn sm" data-a="ics-one" data-trip="${t.id}" data-id="${a.id}">Add to calendar</button></p>
      </div></details></li>`;
  }
  const dayList = (t, acts) => acts.length ? `<ol class="pt-acts">${acts.map(a => actRow(a, t)).join('')}</ol>` : '<p class="pt-muted">The programme for this day follows soon.</p>';
  function tabItinerary(t) {
    const days = daysOf(t);
    if (!days.length) return `<p class="pt-statement">Your programme is being <em>prepared.</em></p><p class="pt-muted pt-gap">We publish it here as soon as it’s ready.</p>`;
    const mode = S.view.mode[t.id] || 'day';
    let idx = S.view.dayIdx[t.id];
    if (idx == null) { const td = todayISO(); const i = days.findIndex(d => d.day_date === td); idx = i >= 0 ? i : 0; }
    const switcher = `<div class="pt-seg" role="group" aria-label="View">${[['day', 'Day'], ['timeline', 'Timeline'], ['calendar', 'Calendar']].map(([k, l]) => `<button type="button" data-a="mode" data-trip="${t.id}" data-v="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>`;
    const tools = `<div class="pt-it-tools">${switcher}<button type="button" class="pt-link" data-a="ics-all" data-trip="${t.id}">Add all to calendar</button></div>`;
    if (mode === 'timeline') return tools + days.map(d => `<section class="pt-tl-day"><header><span class="pt-tl-n">${String(d.day_number).padStart(2, '0')}</span><span><span class="pt-k pt-muted">${d.day_date ? fmtShort(d.day_date) : 'Day ' + d.day_number}</span><span class="pt-tl-title">${esc(d.title || '')}</span></span></header>${dayList(t, actsOf(d.id))}</section>`).join('');
    if (mode === 'calendar') {
      return tools + `<div class="pt-cal">${days.map((d, i) => { const n = actsOf(d.id).length; return `<button type="button" class="pt-cal-d" data-a="pick-day" data-trip="${t.id}" data-v="${i}"><span class="pt-k pt-muted">${d.day_date ? d12(d.day_date).toLocaleDateString('en-GB', { weekday: 'short' }) : 'Day'}</span><span class="pt-cal-n">${d.day_date ? d12(d.day_date).getDate() : d.day_number}</span><span class="pt-small pt-muted">${n} ${n === 1 ? 'moment' : 'moments'}</span></button>`; }).join('')}</div>`;
    }
    const d = days[idx];
    return tools + `<div class="pt-day">
      <div class="pt-day-head"><button type="button" class="pt-circ" data-a="day" data-trip="${t.id}" data-v="${idx - 1}" ${idx === 0 ? 'disabled' : ''} aria-label="Previous day">←</button>
        <div><p class="pt-k pt-muted">Day ${d.day_number} of ${days.length}${d.day_date ? ' · ' + fmtShort(d.day_date) : ''}</p><h2>${esc(d.title || 'Day ' + d.day_number)}</h2></div>
        <button type="button" class="pt-circ" data-a="day" data-trip="${t.id}" data-v="${idx + 1}" ${idx === days.length - 1 ? 'disabled' : ''} aria-label="Next day">→</button></div>
      ${[d.morning && ['Morning', d.morning], d.afternoon && ['Afternoon', d.afternoon], d.evening && ['Evening', d.evening]].filter(Boolean).map(p => `<p class="pt-daynote"><span class="pt-k pt-muted">${p[0]}</span> ${nl(p[1])}</p>`).join('')}
      ${dayList(t, actsOf(d.id))}
      <div class="pt-dots" role="group" aria-label="Choose a day">${days.map((x, i) => `<button type="button" data-a="day" data-trip="${t.id}" data-v="${i}" aria-label="Day ${x.day_number}" ${i === idx ? 'aria-current="true"' : ''}><i></i></button>`).join('')}</div>
    </div>`;
  }
  function tabEssentials(t) {
    const rows = [['Where you stay', t.stay], ['Practical', t.practical], ['What to pack', t.packing_list], ['On site', t.on_site_contact]].filter(x => x[1]);
    const flights = S.docs.filter(d => d.trip_id === t.id && ['flight', 'hotel', 'transfer'].includes(d.category));
    return `${t.summary ? `<p class="pt-welcome">${nl(t.summary)}</p>` : ''}
      <dl class="pt-ess">${rows.map(([h, v]) => `<div><dt class="pt-k pt-muted">${h}</dt><dd>${nl(v)}</dd></div>`).join('')}
        <div><dt class="pt-k pt-muted">Your host</dt><dd>${esc(t.host_name || 'BAEDO Journeys')}${t.host_phone ? `<br><a href="tel:${esc(t.host_phone.replace(/\s/g, ''))}">${esc(t.host_phone)}</a>` : ''}<br><a href="mailto:info@baedojourneys.com">info@baedojourneys.com</a></dd></div>
      </dl>
      ${flights.length ? `<p class="pt-k pt-muted pt-gap-l">Travel documents</p>${walletList(flights, true)}` : ''}`;
  }
  function tabPrepare(t) {
    const list = checklistOf(t), done = list.filter(i => isChecked(i, t)).length;
    const cats = { documents: 'Documents', practical: 'Practical', gear: 'Equipment', performance: 'Performance' };
    return `<p class="pt-statement">${done} of ${list.length} <em>${done === list.length ? 'ready. Enjoy.' : 'ready.'}</em></p>
      <div class="pt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${done}" aria-label="Preparation"><i style="width:${Math.round(done / Math.max(1, list.length) * 100)}%"></i></div>
      <ul class="pt-check">${list.map(i => { const on = isChecked(i, t); return `<li><button type="button" data-a="check" data-trip="${t.id}" data-id="${i.id}" aria-pressed="${on}" class="${on ? 'on' : ''}"><span class="pt-ring" aria-hidden="true"></span><span class="pt-check-l">${esc(i.label)}</span><span class="pt-k pt-muted">${cats[i.category] || ''}</span></button></li>`; }).join('')}</ul>
      <p class="pt-small pt-muted pt-gap">We never ask you to upload a passport or ID here.</p>`;
  }
  function tabScores(t) {
    const rows = S.results.filter(r => r.trip_id === t.id);
    const tot = {}; rows.forEach(r => { const k = r.player_name; tot[k] = tot[k] || { name: k, sf: 0, n: 0, me: (r.player_email || '').toLowerCase() === (S.user.email || '').toLowerCase() }; if (r.stableford != null) tot[k].sf += r.stableford; tot[k].n++; });
    const rank = Object.values(tot).sort((a, b) => b.sf - a.sf);
    return `${rank.length ? `<p class="pt-statement">${esc(rank[0].me ? 'You' : rank[0].name)} <em>${rank[0].me ? 'lead.' : 'leads.'}</em></p><ol class="pt-board">${rank.map((p, i) => `<li class="${p.me ? 'me' : ''}"><span class="pt-muted">${i + 1}</span><span>${esc(p.me ? 'You' : p.name)}</span><span class="pt-muted pt-small">${p.n} ${p.n === 1 ? 'round' : 'rounds'}</span><span class="pt-num">${p.sf}</span></li>`).join('')}</ol>` : '<p class="pt-statement">No scores <em>yet.</em></p>'}
      <form class="pt-form pt-score" data-f="score" data-trip="${t.id}"><p class="pt-k pt-muted">Add your score</p>
        <div class="pt-grid3"><div class="pt-field"><label for="sc-date">Date</label><input id="sc-date" name="round_date" type="date" value="${todayISO()}" required></div>
        <div class="pt-field"><label for="sc-course">Course</label><input id="sc-course" name="course" required></div>
        <div class="pt-field"><label for="sc-sf">Stableford points</label><input id="sc-sf" name="stableford" type="number" inputmode="numeric" min="0" max="60" required></div></div>
        <p class="pt-row"><button class="pt-btn primary" type="submit">Save score</button><span class="pt-msg" role="status" aria-live="polite"></span></p></form>`;
  }

  // ---------- wallet ----------
  function walletList(docs, compact) {
    if (!docs.length) return '<p class="pt-muted">No documents yet. We add them here and let you know.</p>';
    const by = {}; docs.forEach(d => (by[d.category] = by[d.category] || []).push(d));
    return Object.keys(DOC).filter(k => by[k]).map(k => `${compact ? '' : `<p class="pt-k pt-muted pt-gap-l">${DOC[k]}</p>`}<ul class="pt-docs">${by[k].map(d => `<li><button type="button" data-a="doc" data-id="${d.id}"><span class="pt-doc-ic" aria-hidden="true"></span><span class="pt-doc-m"><span>${esc(d.title || DOC[k])}</span><span class="pt-small pt-muted">${esc((tripById(d.trip_id) || {}).title || '')}${d.version > 1 ? ' · Version ' + d.version : ''} · ${fmt(d.published_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}${d.guest_email ? ' · Personal' : ''}</span></span><span class="pt-k pt-accent">Open</span></button></li>`).join('')}</ul>`).join('');
  }
  const viewWallet = () => shell('wallet', head('Travel wallet', 'Your <em>documents.</em>', 'Confirmations, vouchers, invoices and guides, safely in one place.') + `<section class="pt-wrap pt-sec">${walletList(S.docs)}</section>`);

  // ---------- payments ----------
  function paymentsList(bookings) {
    if (!bookings.length) return '<p class="pt-muted">No bookings to show yet.</p>';
    const td = todayISO();
    return bookings.map(b => {
      const t = tripById(b.trip_id) || {}, items = S.pays.filter(p => p.booking_id === b.id && p.status !== 'cancelled');
      const paid = items.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
      const open = items.filter(p => p.status === 'due').reduce((s, p) => s + Number(p.amount || 0), 0);
      const sample = /voorbeeld/i.test((b.reference || '') + (b.notes || ''));
      return `<article class="pt-book">
        <header><p class="pt-k pt-muted">${esc(t.title || 'Journey')}${b.reference ? ' · ' + esc(b.reference) : ''}</p><p class="pt-k ${b.status === 'confirmed' ? '' : 'pt-accent'}">${b.status === 'confirmed' ? 'Confirmed' : 'Option'}</p></header>
        ${sample ? '<p class="pt-note">Sample booking for testing. No real amounts.</p>' : ''}
        <dl class="pt-sums"><div><dt class="pt-k pt-muted">Total</dt><dd>${b.total_amount != null ? money(b.total_amount, b.currency) : '—'}</dd></div><div><dt class="pt-k pt-muted">Paid</dt><dd>${money(paid, b.currency)}</dd></div><div><dt class="pt-k pt-muted">Open</dt><dd>${money(open, b.currency)}</dd></div></dl>
        ${items.length ? `<ul class="pt-pays">${items.map(p => { const late = p.status === 'due' && p.due_date && p.due_date < td; return `<li><span>${esc(p.label)}</span><span class="pt-muted pt-small">${p.status === 'paid' ? 'Paid' + (p.paid_at ? ' ' + fmt(p.paid_at, { day: 'numeric', month: 'short' }) : '') : late ? 'Overdue since ' + fmt(p.due_date, { day: 'numeric', month: 'short' }) : p.due_date ? 'Due ' + fmt(p.due_date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Due'}</span><span class="pt-num ${late ? 'pt-accent' : ''}">${money(p.amount, b.currency)}</span></li>`; }).join('')}</ul>` : ''}
        <p class="pt-small pt-muted pt-gap">Booked and invoiced by ${esc(b.managed_by)}. For now, payments are made by bank transfer with the details on your invoice.${b.terms_url ? ` <a href="${esc(b.terms_url)}" target="_blank" rel="noopener">Terms</a>.` : ''}</p>
      </article>`;
    }).join('');
  }
  const viewPayments = () => shell('payments', head('Payments', 'Bookings and <em>payments.</em>') + `<section class="pt-wrap pt-sec">${paymentsList(S.bookings)}</section>`);

  // ---------- concierge ----------
  function viewConcierge(id, qs) {
    if (id === 'new') {
      const pre = new URLSearchParams(qs || '').get('trip') || '';
      const html = head('Concierge', 'How can we <em>help?</em>', 'Tell us what you’d like. We confirm personally; a request is never a reservation until we say so.') + `<section class="pt-wrap pt-sec"><form class="pt-form pt-narrow" data-f="request" novalidate>
        <fieldset class="pt-chips"><legend class="pt-k pt-muted">What is it about?</legend>${Object.entries(REQ).map(([k, l], i) => `<label><input type="radio" name="category" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
        ${S.trips.length ? `<div class="pt-field"><label for="rq-trip">Journey</label><select id="rq-trip" name="trip_id"><option value="">Not about a specific journey</option>${S.trips.map(t => `<option value="${t.id}" ${t.id === pre ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>` : ''}
        <div class="pt-field"><label for="rq-sub">In a few words</label><input id="rq-sub" name="subject" maxlength="200" required placeholder="Table for four on Friday evening"></div>
        <div class="pt-field"><label for="rq-det">Details <span class="pt-muted">(optional)</span></label><textarea id="rq-det" name="details" rows="4" maxlength="4000"></textarea></div>
        <div class="pt-field"><label for="rq-date">Preferred date <span class="pt-muted">(optional)</span></label><input id="rq-date" name="preferred_date" type="date"></div>
        <p class="pt-row"><button class="pt-btn primary" type="submit">Send request</button><a class="pt-link" href="#/concierge">Cancel</a><span class="pt-msg" role="status" aria-live="polite"></span></p>
      </form></section>`;
      return shell('concierge', html);
    }
    if (id) {
      const r = S.reqs.find(x => x.id === id);
      if (!r) return shell('concierge', `<section class="pt-wrap pt-sec pt-empty"><h2>Request not <em>found.</em></h2><p class="pt-row"><a class="pt-btn" href="#/concierge">All requests</a></p></section>`);
      const msgs = S.msgs[id];
      const order = ['received', 'in_progress', 'awaiting_confirmation', 'confirmed', 'completed'], at = order.indexOf(r.status);
      const html = `<header class="pt-head pt-wrap"><a class="pt-back dark" href="#/concierge">← All requests</a><p class="pt-k pt-accent">${REQ[r.category]}</p><h1>${esc(r.subject)}</h1><p class="pt-lede">${REQSTATUS[r.status]}${r.preferred_date ? ' · for ' + fmt(r.preferred_date) : ''}</p></header>
        <section class="pt-wrap pt-sec">${r.status === 'cancelled' ? '' : `<ol class="pt-steps sm">${order.map((s, i) => `<li class="${i < at || (i === at && s === 'completed') ? 'done' : i === at ? 'cur' : ''}"><span class="pt-dot" aria-hidden="true"></span><span>${REQSTATUS[s]}</span></li>`).join('')}</ol>`}
        ${r.details ? `<p class="pt-welcome">${nl(r.details)}</p>` : ''}
        <div class="pt-thread" aria-live="polite">${msgs ? (msgs.length ? msgs.map(m => `<div class="pt-msgb ${m.author_role}"><p>${nl(m.body)}</p><span class="pt-small pt-muted">${m.author_role === 'baedo' ? 'BAEDO' : 'You'} · ${new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<p class="pt-muted">No messages yet. We reply here.</p>') : '<p class="pt-muted">Loading…</p>'}</div>
        ${['completed', 'cancelled'].includes(r.status) ? '' : `<form class="pt-form pt-narrow" data-f="msg" data-id="${r.id}"><div class="pt-field"><label for="m-body">Add a message</label><textarea id="m-body" name="body" rows="3" maxlength="4000" required></textarea></div><p class="pt-row"><button class="pt-btn" type="submit">Send</button><span class="pt-msg" role="status" aria-live="polite"></span></p></form>`}
        </section>`;
      if (!msgs) sb.from('concierge_messages').select('*').eq('request_id', id).order('created_at').then(({ data }) => { S.msgs[id] = data || []; if (location.hash.startsWith('#/concierge/' + id)) render(); });
      return shell('concierge', html);
    }
    const html = head('Concierge', 'Is there anything we can <em>arrange for you?</em>') + `<section class="pt-wrap pt-sec"><p class="pt-row"><a class="pt-btn primary" href="#/concierge/new">New request</a></p>
      ${S.reqs.length ? `<ul class="pt-list pt-gap-l">${S.reqs.map(r => `<li><a href="#/concierge/${r.id}"><span class="pt-k ${['awaiting_confirmation'].includes(r.status) ? 'pt-accent' : 'pt-muted'}">${REQSTATUS[r.status]} · ${REQ[r.category]}</span><span class="pt-li-title">${esc(r.subject)}</span><span class="pt-small pt-muted">${fmt(r.created_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</span></a></li>`).join('')}</ul>` : '<p class="pt-muted pt-gap-l">A dinner, a transfer, a surprise for someone special. Ask us anything.</p>'}</section>`;
    return shell('concierge', html);
  }

  // ---------- performance ----------
  function viewPerformance() {
    const p = S.profile.performance || {};
    const up = S.sessions.filter(s => s.starts_at >= new Date().toISOString()), past = S.sessions.filter(s => s.starts_at < new Date().toISOString()).reverse();
    const sess = (s) => `<li><div><span class="pt-k pt-muted">${new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${s.location ? ' · ' + esc(s.location) : ''}</span><span class="pt-li-title">${esc(s.title)}</span>${s.coach ? `<span class="pt-small pt-muted">With ${esc(s.coach)}</span>` : ''}${s.content ? `<p class="pt-small">${nl(s.content)}</p>` : ''}${s.feedback ? `<p class="pt-quote-s">${nl(s.feedback)}</p>` : ''}</div></li>`;
    const html = head('Performance', 'Your <em>game.</em>', p.discipline ? esc([p.discipline, p.level].filter(Boolean).join(' · ')) : 'Tell us about your sport in your profile, so we can prepare.') +
      `<section class="pt-wrap pt-sec pt-two"><div><p class="pt-k pt-muted">Goals</p>
        <ul class="pt-goals">${S.goals.map(g => `<li class="${g.status}"><div><span class="pt-li-title">${esc(g.title)}</span><span class="pt-small pt-muted">${g.status === 'achieved' ? 'Achieved' : g.status === 'paused' ? 'Paused' : 'Active'}${g.set_by === 'coach' ? ' · set with your coach' : ''}${g.trip_id && tripById(g.trip_id) ? ' · ' + esc(tripById(g.trip_id).title) : ''}</span></div>
          <span class="pt-row">${g.status !== 'achieved' ? `<button type="button" class="pt-link" data-a="goal" data-id="${g.id}" data-v="achieved">Achieved</button>` : `<button type="button" class="pt-link" data-a="goal" data-id="${g.id}" data-v="active">Reopen</button>`}${g.set_by === 'member' ? `<button type="button" class="pt-link" data-a="goal-del" data-id="${g.id}">Remove</button>` : ''}</span></li>`).join('') || '<li class="pt-muted">No goals yet.</li>'}</ul>
        <form class="pt-form" data-f="goal"><div class="pt-field"><label for="g-t">A new goal</label><input id="g-t" name="title" maxlength="200" required placeholder="Break 90 on a links course"></div>
          ${S.trips.length ? `<div class="pt-field"><label for="g-trip">For</label><select id="g-trip" name="trip_id"><option value="">In general</option>${S.trips.filter(t => phaseOf(t) !== 'progress').map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></div>` : ''}
          <p class="pt-row"><button class="pt-btn" type="submit">Add goal</button><span class="pt-msg" role="status" aria-live="polite"></span></p></form></div>
        <div><p class="pt-k pt-muted">Coaching sessions</p>${up.length ? `<ul class="pt-sess">${up.map(sess).join('')}</ul>` : '<p class="pt-muted pt-gap">No sessions planned yet.</p>'}
          ${past.length ? `<p class="pt-k pt-muted pt-gap-l">Earlier, with feedback</p><ul class="pt-sess">${past.map(sess).join('')}</ul>` : ''}</div></section>
      <section class="pt-wrap pt-sec pt-note-s"><p class="pt-small pt-muted">Coming next: preparation exercises, coach feedback with video and measurements your coach chooses for your sport.</p></section>`;
    return shell('performance', html);
  }

  // ---------- profile ----------
  function viewProfile() {
    const p = S.profile, tp = p.travel_prefs || {}, pf = p.performance || {}, has = S.user.user_metadata && S.user.user_metadata.pin_set;
    const f = (id, label, val, attrs) => `<div class="pt-field"><label for="${id}">${label}</label><input id="${id}" name="${id}" value="${esc(val || '')}" ${attrs || ''}></div>`;
    const html = head('Profile', 'Your <em>details.</em>', esc(S.user.email || '')) + `<section class="pt-wrap pt-sec">
      <form class="pt-form pt-pform" data-f="profile" novalidate>
        <fieldset><legend class="pt-k pt-muted">Personal details</legend><div class="pt-grid2">
          ${f('first_name', 'First name', p.first_name, 'autocomplete="given-name"')}${f('last_name', 'Last name', p.last_name, 'autocomplete="family-name"')}
          ${f('phone', 'Phone', p.phone, 'type="tel" autocomplete="tel"')}${f('country', 'Country of residence', p.country, 'autocomplete="country-name"')}
          <div class="pt-field"><label for="language">Preferred language</label><select id="language" name="language">${[['en', 'English'], ['nl', 'Nederlands'], ['fr', 'Français']].map(([k, l]) => `<option value="${k}" ${p.language === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          ${f('handicap', 'Handicap, if you play golf', p.handicap ?? '', 'inputmode="decimal"')}
          ${f('emergency_name', 'Emergency contact', p.emergency_name)}${f('emergency_phone', 'Emergency phone', p.emergency_phone, 'type="tel"')}
        </div></fieldset>
        <fieldset><legend class="pt-k pt-muted">Travel preferences</legend><div class="pt-grid2">
          ${f('tp_room', 'Room', tp.room, 'placeholder="Twin beds, quiet side"')}${f('tp_diet', 'Dietary wishes', tp.diet, 'placeholder="Vegetarian, no shellfish"')}
          ${f('tp_interests', 'Interests beside the sport', tp.interests, 'placeholder="Wine, walking, art"')}${f('tp_destinations', 'Dream destinations', tp.destinations)}
        </div><div class="pt-field"><label for="preferences">Anything else we should know</label><textarea id="preferences" name="preferences" rows="3">${esc(p.preferences || '')}</textarea></div></fieldset>
        <fieldset><legend class="pt-k pt-muted">Performance profile</legend><div class="pt-grid2">
          ${f('pf_discipline', 'Sport', pf.discipline, 'placeholder="Golf"')}<div class="pt-field"><label for="pf_level">Level</label><select id="pf_level" name="pf_level">${['', 'Starting out', 'Improving', 'Experienced', 'Competitive'].map(l => `<option ${pf.level === l ? 'selected' : ''} value="${l}">${l || 'Choose'}</option>`).join('')}</select></div>
          ${f('pf_goals', 'What you want to work on', pf.goals)}<div class="pt-field"><label for="pf_coaching">Coaching</label><select id="pf_coaching" name="pf_coaching">${['', 'One to one', 'In the group', 'Both'].map(l => `<option ${pf.coaching === l ? 'selected' : ''} value="${l}">${l || 'Choose'}</option>`).join('')}</select></div>
        </div></fieldset>
        <fieldset><legend class="pt-k pt-muted">Privacy</legend>
          <label class="pt-toggle"><input type="checkbox" name="visible_to_group" ${p.visible_to_group ? 'checked' : ''}><span>Show my first name and sport to fellow travellers on the same journey</span></label>
          <label class="pt-toggle"><input type="checkbox" name="news_consent" ${p.news_consent ? 'checked' : ''}><span>Tell me about new journeys before they’re public</span></label>
        </fieldset>
        <p class="pt-row"><button class="pt-btn primary" type="submit">Save changes</button><span class="pt-msg" role="status" aria-live="polite"></span></p>
      </form></section>
      <section class="pt-wrap pt-sec pt-two">
        <div><p class="pt-k pt-muted">Quicker login</p><p class="pt-li-title">${has ? 'Change your PIN' : 'Create a PIN'}</p><p class="pt-small pt-muted">Log in with your email and a six-digit PIN, without waiting for an email.</p>
          <form class="pt-form" data-f="pin"><div><p class="pt-small">Choose a PIN</p>${otpBoxes('pin-a', 'New PIN', 'password')}</div><div><p class="pt-small">Repeat it</p>${otpBoxes('pin-b', 'Repeat PIN', 'password')}</div><p class="pt-row"><button class="pt-btn" type="submit">Save PIN</button><span class="pt-msg" role="status" aria-live="polite"></span></p></form></div>
        <div><p class="pt-k pt-muted">Security</p><p class="pt-row pt-col"><button type="button" class="pt-btn" data-a="logout">Log out</button><button type="button" class="pt-btn" data-a="logout-all">Log out on all devices</button></p>
          <p class="pt-small pt-muted pt-gap">Want us to delete your data? Mail <a href="mailto:info@baedojourneys.com?subject=Delete%20my%20data">info@baedojourneys.com</a> and we handle it personally.</p></div>
      </section>`;
    return shell('profile', html);
  }

  // ---------- onboarding ----------
  let ob = 0;
  function viewOnboarding() {
    const p = S.profile, tp = p.travel_prefs || {}, pf = p.performance || {};
    const steps = ['About you', 'How you travel', 'Your sport', 'Quicker login'];
    const f = (id, label, val, attrs) => `<div class="pt-field"><label for="ob-${id}">${label}</label><input id="ob-${id}" name="${id}" value="${esc(val || '')}" ${attrs || ''}></div>`;
    const bodies = [
      `<h1>Let’s get to <em>know you.</em></h1><p class="pt-lede">Only what we need to prepare well.</p><div class="pt-grid2">${f('first_name', 'First name', p.first_name || (p.full_name || '').split(' ')[0], 'required autocomplete="given-name"')}${f('last_name', 'Last name', p.last_name || (p.full_name || '').split(' ').slice(1).join(' '), 'autocomplete="family-name"')}${f('phone', 'Phone', p.phone, 'type="tel" autocomplete="tel"')}${f('country', 'Country of residence', p.country, 'autocomplete="country-name"')}</div>
        <div class="pt-field"><label for="ob-language">Preferred language</label><select id="ob-language" name="language">${[['en', 'English'], ['nl', 'Nederlands'], ['fr', 'Français']].map(([k, l]) => `<option value="${k}" ${p.language === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`,
      `<h1>How you like to <em>travel.</em></h1><p class="pt-lede">All optional. Skip what you like.</p><div class="pt-grid2">${f('tp_room', 'Room', tp.room, 'placeholder="Twin beds, quiet side"')}${f('tp_diet', 'Dietary wishes', tp.diet, 'placeholder="Vegetarian, no shellfish"')}${f('tp_interests', 'Interests beside the sport', tp.interests, 'placeholder="Wine, walking, art"')}${f('tp_destinations', 'Dream destinations', tp.destinations)}</div>`,
      `<h1>Your <em>sport.</em></h1><p class="pt-lede">So our pro can prepare for you. Optional.</p><div class="pt-grid2">${f('pf_discipline', 'Sport', pf.discipline || 'Golf')}<div class="pt-field"><label for="ob-pf_level">Level</label><select id="ob-pf_level" name="pf_level">${['', 'Starting out', 'Improving', 'Experienced', 'Competitive'].map(l => `<option ${pf.level === l ? 'selected' : ''} value="${l}">${l || 'Choose'}</option>`).join('')}</select></div>${f('pf_goals', 'What you want to work on', pf.goals, 'placeholder="Consistency off the tee"')}<div class="pt-field"><label for="ob-pf_coaching">Coaching</label><select id="ob-pf_coaching" name="pf_coaching">${['', 'One to one', 'In the group', 'Both'].map(l => `<option ${pf.coaching === l ? 'selected' : ''} value="${l}">${l || 'Choose'}</option>`).join('')}</select></div></div>`,
      `<h1>Create your <em>PIN.</em></h1><p class="pt-lede">Next time, log in with your email and six digits. No waiting for an email. Optional.</p><div class="pt-gap"><p class="pt-small">Choose a PIN</p>${otpBoxes('pin-a', 'New PIN', 'password')}</div><div class="pt-gap"><p class="pt-small">Repeat it</p>${otpBoxes('pin-b', 'Repeat PIN', 'password')}</div>`
    ];
    return `<section class="pt-ob"><div class="pt-ob-in">
      <div class="pt-ob-prog" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${ob + 1}" aria-label="Step ${ob + 1} of 4">${steps.map((s, i) => `<span class="${i <= ob ? 'on' : ''}"><i></i><em>${s}</em></span>`).join('')}</div>
      <form class="pt-form" data-f="onboard" novalidate><p class="pt-k pt-accent">Step ${ob + 1} of 4</p>${bodies[ob]}
        <p class="pt-row pt-ob-act">${ob > 0 ? '<button type="button" class="pt-link" data-a="ob-back">Back</button>' : ''}${ob > 0 ? '<button type="button" class="pt-link" data-a="ob-skip">Skip</button>' : ''}<button class="pt-btn primary" type="submit">${ob === 3 ? 'Finish' : 'Continue'}</button><span class="pt-msg" role="status" aria-live="polite"></span></p>
      </form></div></section>`;
  }

  // ---------- router ----------
  function render() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    let html;
    if (!S.profile.onboarded_at && parts[0] !== 'profile') html = viewOnboarding();
    else if (!parts.length) html = viewHome();
    else if (parts[0] === 'journeys') html = viewJourneys();
    else if (parts[0] === 'journey') html = viewJourney(parts[1], parts[2]);
    else if (parts[0] === 'wallet') html = viewWallet();
    else if (parts[0] === 'payments') html = viewPayments();
    else if (parts[0] === 'concierge') html = viewConcierge(parts[1], qs);
    else if (parts[0] === 'performance') html = viewPerformance();
    else if (parts[0] === 'profile') html = viewProfile();
    else html = viewHome();
    const sameView = root.dataset.v === parts.slice(0, 2).join('/');
    root.innerHTML = html;
    root.dataset.v = parts.slice(0, 2).join('/');
    afterRender(sameView);
  }
  function afterRender(sameView) {
    document.body.classList.remove('pt-is-login');
    if (!sameView) { window.scrollTo({ top: 0 }); const m = $('#pt-main'); if (m && document.activeElement === document.body) m.focus({ preventScroll: true }); }
    tick();
    $$('[data-wx]').forEach(async (el) => {
      const t = tripById(el.dataset.wx); if (!t) return;
      const lt = t.timezone ? localTime(t.timezone) : '';
      const w = await weather(t);
      el.innerHTML = `${w ? `<p class="pt-wx-t">${w.temp}°</p><p class="pt-muted pt-small">${w.word} in ${esc(t.destination || '')}</p>` : ''}${lt ? `<p class="pt-muted pt-small">${lt} local time</p>` : ''}`;
    });
    if ($('#pin-a')) bindPin();
  }
  function tick() {
    $$('[data-countdown]').forEach(el => {
      const d = el.dataset.countdown; if (!d) { el.innerHTML = ''; return; }
      const start = localToUTC(d, '09:00', el.dataset.tz || undefined);
      const ms = start - Date.now();
      if (ms <= 0) { el.innerHTML = ''; return; }
      const days = Math.floor(ms / 864e5), hrs = Math.floor(ms % 864e5 / 36e5);
      el.innerHTML = `<span class="pt-count-n">${days}</span><span class="pt-k">${days === 1 ? 'day' : 'days'}${days < 14 ? ` · ${hrs} h` : ''} to go</span>`;
    });
  }
  setInterval(tick, 60000);
  (function () {
    const h = document.querySelector('.site-header'); if (!h) return;
    const set = () => document.documentElement.style.setProperty('--pt-top', Math.round(h.getBoundingClientRect().height) + 'px');
    set(); window.addEventListener('scroll', set, { passive: true }); window.addEventListener('resize', set);
  })();
  let pinA, pinB;
  function bindPin() { pinA = wireOtp($('#pin-a'), () => pinB.focus()); pinB = wireOtp($('#pin-b')); }
  async function savePin(msgEl) {
    const a = pinA.get(), b = pinB.get();
    if (!a && !b) return true;
    if (a.length < 6) { msgEl.textContent = 'Your PIN needs six digits.'; msgEl.className = 'pt-msg err'; return false; }
    if (a !== b) { pinB.clear(); pinB.focus(); msgEl.textContent = 'The two PINs aren’t the same.'; msgEl.className = 'pt-msg err'; return false; }
    if (/^(\d)\1{5}$/.test(a) || '0123456789'.includes(a) || '9876543210'.includes(a)) { msgEl.textContent = 'Choose a PIN that’s harder to guess.'; msgEl.className = 'pt-msg err'; return false; }
    const { data, error } = await sb.auth.updateUser({ password: a, data: { pin_set: true } });
    if (error) { msgEl.textContent = /reauth|recent/i.test(error.message || '') ? 'For your safety, log in again with an email code, then set your PIN.' : 'Couldn’t save your PIN. Try again.'; msgEl.className = 'pt-msg err'; return false; }
    if (data && data.user) S.user = data.user;
    return true;
  }

  // ---------- actions ----------
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]'); if (!a || !root.contains(a)) return;
    const act = a.dataset.a, id = a.dataset.id, t = a.dataset.trip && tripById(a.dataset.trip);
    if (act === 'day') { S.view.dayIdx[t.id] = Math.max(0, +a.dataset.v); S.view.mode[t.id] = 'day'; render(); }
    if (act === 'pick-day') { S.view.dayIdx[t.id] = +a.dataset.v; S.view.mode[t.id] = 'day'; render(); }
    if (act === 'mode') { S.view.mode[t.id] = a.dataset.v; render(); }
    if (act === 'ics-one') icsFor(t, S.acts.filter(x => x.id === id));
    if (act === 'ics-all') icsFor(t, S.acts.filter(x => x.trip_id === t.id && (!x.optional || (S.resp[x.id] && S.resp[x.id].response === 'in'))));
    if (act === 'rsvp') {
      a.disabled = true;
      const row = { activity_id: id, user_id: S.user.id, response: a.dataset.v, updated_at: new Date().toISOString() };
      const { error } = await sb.from('activity_responses').upsert(row);
      if (error) { a.disabled = false; return toast('Couldn’t save. Try again.'); }
      S.resp[id] = row; const open = a.closest('details'); render(); const again = root.querySelector(`[data-id="${id}"][data-a="rsvp"]`); if (open && again) { again.closest('details').open = true; again.focus(); }
      toast(row.response === 'in' ? 'You’re in.' : 'Noted. We won’t expect you.');
    }
    if (act === 'check') {
      const key = id + '|' + t.id, on = S.checks.has(key);
      on ? S.checks.delete(key) : S.checks.add(key); render(); const b = root.querySelector(`[data-a="check"][data-id="${id}"]`); if (b) b.focus();
      const res = on ? await sb.from('checklist_checks').delete().match({ item_id: id, trip_id: t.id, user_id: S.user.id }) : await sb.from('checklist_checks').insert({ item_id: id, trip_id: t.id, user_id: S.user.id });
      if (res.error) { on ? S.checks.add(key) : S.checks.delete(key); render(); toast('Couldn’t save. Try again.'); }
    }
    if (act === 'doc') {
      const d = S.docs.find(x => x.id === id); const w = window.open('', '_blank');
      const url = await signedUrl(d);
      if (url && w) w.location = url; else if (url) location.href = url; else { if (w) w.close(); toast('This document isn’t available right now.'); }
    }
    if (act === 'goal') { const { error } = await sb.from('performance_goals').update({ status: a.dataset.v }).eq('id', id); if (!error) { S.goals.find(g => g.id === id).status = a.dataset.v; render(); toast(a.dataset.v === 'achieved' ? 'Well played.' : 'Goal reopened.'); } }
    if (act === 'goal-del') { const { error } = await sb.from('performance_goals').delete().eq('id', id); if (!error) { S.goals = S.goals.filter(g => g.id !== id); render(); } }
    if (act === 'logout') { await sb.auth.signOut(); location.hash = ''; }
    if (act === 'logout-all') { await sb.auth.signOut({ scope: 'global' }); location.hash = ''; }
    if (act === 'ob-back') { ob = Math.max(0, ob - 1); render(); }
    if (act === 'ob-skip') { if (ob === 3) return finishOnboarding(); ob++; render(); }
  });
  const prefsFrom = (fd, base) => {
    const tp = Object.assign({}, base.travel_prefs || {}), pf = Object.assign({}, base.performance || {}), row = {};
    for (const [k, v] of fd.entries()) {
      const val = String(v).trim();
      if (k.startsWith('tp_')) tp[k.slice(3)] = val || undefined;
      else if (k.startsWith('pf_')) pf[k.slice(3)] = val || undefined;
      else if (!['visible_to_group', 'news_consent'].includes(k)) row[k] = val || null;
    }
    row.travel_prefs = JSON.parse(JSON.stringify(tp)); row.performance = JSON.parse(JSON.stringify(pf));
    return row;
  };
  async function finishOnboarding() {
    const { error } = await sb.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', S.user.id);
    if (!error) { S.profile.onboarded_at = new Date().toISOString(); ob = 0; location.hash = '#/'; render(); toast('Welcome to My Journeys.'); }
  }
  root.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-f]'); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.f, msg = f.querySelector('.pt-msg'), btn = f.querySelector('button[type="submit"]');
    const say = (t, err) => { if (msg) { msg.textContent = t; msg.className = 'pt-msg' + (err ? ' err' : ''); } };
    const fd = new FormData(f);
    if (btn) btn.disabled = true;
    try {
      if (kind === 'onboard') {
        if (ob === 0 && !String(fd.get('first_name') || '').trim()) { say('Please add your first name.', true); return; }
        if (ob < 3) {
          const row = prefsFrom(fd, S.profile);
          if (row.first_name !== undefined || row.last_name !== undefined) row.full_name = [row.first_name || S.profile.first_name, row.last_name || S.profile.last_name].filter(Boolean).join(' ') || null;
          row.updated_at = new Date().toISOString();
          const { error } = await sb.from('profiles').update(row).eq('id', S.user.id);
          if (error) { say('Couldn’t save. Try again.', true); return; }
          Object.assign(S.profile, row); ob++; render(); return;
        }
        if (await savePin(msg)) finishOnboarding();
      }
      if (kind === 'profile') {
        const row = prefsFrom(fd, S.profile);
        const hcp = row.handicap; delete row.handicap;
        if (hcp != null) { const n = Number(String(hcp).replace(',', '.')); if (isNaN(n) || n < -10 || n > 54) { say('Handicap between -10 and 54, please.', true); return; } row.handicap = n; } else row.handicap = null;
        row.visible_to_group = !!f.querySelector('[name="visible_to_group"]').checked; row.news_consent = !!f.querySelector('[name="news_consent"]').checked;
        row.full_name = [row.first_name, row.last_name].filter(Boolean).join(' ') || null; row.updated_at = new Date().toISOString();
        const { error } = await sb.from('profiles').update(row).eq('id', S.user.id);
        if (error) { say('Couldn’t save. Try again.', true); return; }
        Object.assign(S.profile, row); say('Saved.');
      }
      if (kind === 'pin') { if (!pinA.get()) { say('Choose six digits first.', true); return; } if (await savePin(msg)) { pinA.clear(); pinB.clear(); say('Your PIN is saved.'); } }
      if (kind === 'request') {
        const subject = String(fd.get('subject') || '').trim(); if (!subject) { say('Tell us in a few words what you’d like.', true); return; }
        const row = { category: fd.get('category'), subject, details: String(fd.get('details') || '').trim() || null, preferred_date: fd.get('preferred_date') || null, trip_id: fd.get('trip_id') || null };
        const { data, error } = await sb.from('concierge_requests').insert(row).select().single();
        if (error) { say('Couldn’t send. Try again.', true); return; }
        S.reqs.unshift(data); S.msgs[data.id] = []; location.hash = '#/concierge/' + data.id; toast('Received. We’ll come back to you personally.');
      }
      if (kind === 'msg') {
        const body = String(fd.get('body') || '').trim(); if (!body) return;
        const { data, error } = await sb.from('concierge_messages').insert({ request_id: f.dataset.id, body, author_role: 'member' }).select().single();
        if (error) { say('Couldn’t send. Try again.', true); return; }
        (S.msgs[f.dataset.id] = S.msgs[f.dataset.id] || []).push(data); render();
      }
      if (kind === 'goal') {
        const title = String(fd.get('title') || '').trim(); if (!title) { say('Write your goal first.', true); return; }
        const { data, error } = await sb.from('performance_goals').insert({ title, trip_id: fd.get('trip_id') || null }).select().single();
        if (error) { say('Couldn’t save. Try again.', true); return; }
        S.goals.push(data); render(); toast('Goal added.');
      }
      if (kind === 'score') {
        const sf = parseInt(fd.get('stableford'), 10), course = String(fd.get('course') || '').trim();
        if (!course || isNaN(sf) || sf < 0 || sf > 60) { say('Add the course and your points (0 to 60).', true); return; }
        const name = [S.profile.first_name, S.profile.last_name].filter(Boolean).join(' ') || S.profile.full_name || S.user.email;
        const { data, error } = await sb.from('round_results').insert({ trip_id: f.dataset.trip, round_date: fd.get('round_date'), course, stableford: sf, player_name: name, player_email: (S.user.email || '').toLowerCase() }).select().single();
        if (error) { say('Couldn’t save. Try again.', true); return; }
        S.results.push(data); render(); toast('Score saved.');
      }
    } finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
  });

  // ---------- boot ----------
  let bootedFor = null;
  async function boot(session) {
    if (!session) { bootedFor = null; S.user = null; renderLogin(); return; }
    if (bootedFor === session.user.id) return;
    try { const nx = localStorage.getItem('baedo-next'); if (nx) { localStorage.removeItem('baedo-next'); location.href = nx; return; } } catch (e) {}
    bootedFor = session.user.id; S.user = session.user;
    root.innerHTML = '<div class="pt-wrap pt-loading" aria-busy="true"><span class="pt-k pt-muted">Preparing your journeys…</span></div>';
    try { await loadAll(); } catch (e) { console.error(e); root.innerHTML = '<div class="pt-wrap pt-pad"><p>Something went wrong while loading. Please refresh the page.</p></div>'; return; }
    render();
  }
  try { const nx = new URLSearchParams(location.search).get('next'); if (nx && /^\/[a-z0-9\-\/]*\.html$/.test(nx)) localStorage.setItem('baedo-next', nx); } catch (e) {}
  window.addEventListener('hashchange', () => { if (S.user && bootedFor) render(); });
  sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') boot(s); if (ev === 'USER_UPDATED' && s) S.user = s.user; });
  sb.auth.getSession().then(({ data }) => boot(data.session));
})();
