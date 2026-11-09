/* BAEDO Journeys · team page, phase 1 additions */
(function () {
  'use strict';
  const sb = window.BAEDO && BAEDO.sb; if (!sb) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const err = (e) => { if (e) { alert('Something went wrong: ' + e.message); console.error(e); return true; } return false; };
  const v = (f, n) => { const el = f.elements[n]; if (!el) return undefined; if (el.type === 'checkbox') return el.checked; const x = String(el.value || '').trim(); return x === '' ? null : x; };
  const dt = (s) => s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const KINDS = ['sport', 'coaching', 'transfer', 'dining', 'hotel', 'leisure', 'meeting', 'other'];
  const CATS = { booking: 'Booking confirmation', invoice: 'Invoice', receipt: 'Payment receipt', flight: 'Flight information', hotel: 'Hotel voucher', transfer: 'Transfer voucher', itinerary: 'Travel itinerary', insurance: 'Insurance', guide: 'Practical guide', other: 'Other' };
  const RS = { received: 'Received', in_progress: 'In progress', awaiting_confirmation: 'Awaiting confirmation', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };
  const TABS = [['programme', 'Programme'], ['bookings', 'Bookings'], ['concierge', 'Concierge'], ['wallet', 'Wallet'], ['coaching', 'Coaching']];
  let trips = [], tripId = null;

  const css = `.a2-bar{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:24px 0}.a2-bar .field{min-width:280px}
  .a2 h3{font-family:var(--serif);font-weight:400;font-size:24px;margin:0 0 12px}.a2 .panel{margin-bottom:28px}
  .a2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px 18px}.a2-grid .wide{grid-column:1/-1}
  .a2 input,.a2 select,.a2 textarea{font:300 15px var(--sans);padding:8px 10px;border:1px solid var(--hairline);background:#fff;color:var(--ink);border-radius:4px;width:100%;box-sizing:border-box}
  .a2 label.l{display:flex;flex-direction:column;gap:5px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#4E5D54}
  .a2 .chk{display:flex;gap:8px;align-items:center;font-size:14px}.a2 .chk input{width:auto}
  .a2-day{border-top:1px solid var(--hairline);padding:18px 0}.a2-day h4{font-family:var(--serif);font-weight:400;font-size:20px;margin:0 0 10px}
  .a2-act{display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:start;padding:10px 0;border-top:1px dashed var(--sand)}
  .a2-act .t{font-family:var(--serif)}.a2-act small{color:#4E5D54;display:block}
  .a2-btns{display:flex;gap:8px;flex-wrap:wrap}.a2-btns button,.a2 .mini{font:400 11px var(--sans);letter-spacing:.14em;text-transform:uppercase;padding:7px 12px;border:1px solid var(--ink);background:transparent;border-radius:999px;cursor:pointer;color:var(--ink)}
  .a2 .mini.primary{background:var(--signal-strong);border-color:var(--signal-strong);color:var(--cream)}
  .a2 details{margin-top:10px}.a2 summary{cursor:pointer;font-size:12px;letter-spacing:.16em;text-transform:uppercase}
  .a2 form.box{background:var(--linen);padding:16px;margin-top:10px;display:flex;flex-direction:column;gap:12px}
  .a2-thread{display:flex;flex-direction:column;gap:10px;margin:12px 0}.a2-thread div{padding:10px 14px;background:var(--linen);max-width:80%}.a2-thread .baedo{align-self:flex-end;background:var(--sand)}
  .a2-pill{display:inline-block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--sand)}
  .a2-pill.warn{background:var(--signal-strong);color:var(--cream)}`;

  function init() {
    const tabs = document.querySelector('#view-admin .tabs'); if (!tabs || $('tab-programme')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const host = $('panel-photos').parentNode;
    TABS.forEach(([k, l]) => {
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false'); b.dataset.tab2 = k; b.id = 'tab-' + k; b.textContent = l; tabs.appendChild(b);
      const p = document.createElement('div'); p.id = 'panel-' + k; p.className = 'hidden a2'; p.setAttribute('role', 'tabpanel'); host.appendChild(p);
      b.addEventListener('click', () => show(k));
    });
    tabs.querySelectorAll('button:not([data-tab2])').forEach(b => b.addEventListener('click', () => TABS.forEach(([k]) => $('panel-' + k).classList.add('hidden'))));
  }
  async function show(k) {
    document.querySelectorAll('#view-admin .tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab2 === k ? 'true' : 'false'));
    ['requests', 'trips', 'list', 'photos'].forEach(t => $('panel-' + t) && $('panel-' + t).classList.add('hidden'));
    TABS.forEach(([x]) => $('panel-' + x).classList.toggle('hidden', x !== k));
    const { data } = await sb.from('trips').select('*').order('start_date'); trips = data || [];
    if (!tripId && trips.length) tripId = trips[0].id;
    ({ programme, bookings, concierge, wallet, coaching })[k]();
  }
  const tripPicker = (k) => trips.length ? `<div class="a2-bar"><label class="l field">Journey<select data-pick="${k}">${trips.map(t => `<option value="${t.id}" ${t.id === tripId ? 'selected' : ''}>${esc(t.title)} · ${esc(t.start_date || '')}</option>`).join('')}</select></label></div>` : '<p class="muted" style="margin:24px 0">Create a journey first under Journeys &amp; guests.</p>';
  function bindPicker(el, k) { const s = el.querySelector('[data-pick]'); if (s) s.addEventListener('change', () => { tripId = s.value; show(k); }); }

  // ---------- programme ----------
  async function programme() {
    const el = $('panel-programme'); const t = trips.find(x => x.id === tripId);
    if (!t) { el.innerHTML = tripPicker('programme'); return; }
    const [days, acts, resp] = await Promise.all([
      sb.from('trip_days').select('*').eq('trip_id', t.id).order('day_number'),
      sb.from('trip_activities').select('*').eq('trip_id', t.id).order('sort').order('start_time'),
      sb.from('activity_responses').select('activity_id,response')
    ]);
    const counts = {}; (resp.data || []).forEach(r => { counts[r.activity_id] = counts[r.activity_id] || { in: 0, skip: 0 }; counts[r.activity_id][r.response]++; });
    const actForm = (a, dayId) => `<form class="box" data-act="${a ? a.id : ''}" data-day="${dayId}"><div class="a2-grid">
      <label class="l">Start<input type="time" name="start_time" value="${a ? (a.start_time || '').slice(0, 5) : ''}"></label>
      <label class="l">End<input type="time" name="end_time" value="${a ? (a.end_time || '').slice(0, 5) : ''}"></label>
      <label class="l">Kind<select name="kind">${KINDS.map(k => `<option ${a && a.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="l">Order<input type="number" name="sort" value="${a ? a.sort : 0}"></label>
      <label class="l wide">Title<input name="title" required value="${esc(a ? a.title : '')}"></label>
      <label class="l">Location<input name="location" value="${esc(a ? a.location : '')}"></label>
      <label class="l">Address<input name="address" value="${esc(a ? a.address : '')}"></label>
      <label class="l">Meeting point<input name="meeting_point" value="${esc(a ? a.meeting_point : '')}"></label>
      <label class="l">Dress code<input name="dress_code" value="${esc(a ? a.dress_code : '')}"></label>
      <label class="l">Coach or guide<input name="coach" value="${esc(a ? a.coach : '')}"></label>
      <label class="l">Latitude<input name="lat" inputmode="decimal" value="${a && a.lat != null ? a.lat : ''}"></label>
      <label class="l">Longitude<input name="lng" inputmode="decimal" value="${a && a.lng != null ? a.lng : ''}"></label>
      <label class="l wide">Description<textarea name="description" rows="2">${esc(a ? a.description : '')}</textarea></label>
      <label class="l wide">Practical instructions<textarea name="instructions" rows="2">${esc(a ? a.instructions : '')}</textarea></label>
      <label class="chk"><input type="checkbox" name="optional" ${a && a.optional ? 'checked' : ''}> Optional: guests say if they join</label>
      </div><div class="a2-btns"><button class="mini primary" type="submit">${a ? 'Save' : 'Add activity'}</button></div></form>`;
    el.innerHTML = tripPicker('programme') + `
      <div class="panel"><h3>Journey settings</h3><form class="box" data-f="trip"><div class="a2-grid">
        <label class="l">Programme<select name="itinerary_status"><option value="draft" ${t.itinerary_status !== 'published' ? 'selected' : ''}>Draft (shown as provisional)</option><option value="published" ${t.itinerary_status === 'published' ? 'selected' : ''}>Final, published</option></select></label>
        <label class="l">Host name<input name="host_name" value="${esc(t.host_name)}"></label>
        <label class="l">Host phone<input name="host_phone" value="${esc(t.host_phone)}"></label>
        <label class="l">Time zone<input name="timezone" placeholder="Atlantic/Canary" value="${esc(t.timezone)}"></label>
        <label class="l">Latitude<input name="lat" value="${t.lat ?? ''}"></label><label class="l">Longitude<input name="lng" value="${t.lng ?? ''}"></label>
        <label class="l">Sport<input name="discipline" value="${esc(t.discipline)}"></label>
        <label class="l">Cover photo URL<input name="cover_url" value="${esc(t.cover_url)}"></label>
        <label class="l wide">Welcome message<textarea name="welcome_message" rows="2">${esc(t.welcome_message)}</textarea></label>
        <label class="chk"><input type="checkbox" name="challenges_enabled" ${t.challenges_enabled ? 'checked' : ''}> Scores and challenges on this journey</label>
      </div><div class="a2-btns"><button class="mini primary" type="submit">Save settings</button></div></form></div>
      <div class="panel"><h3>Day by day</h3>
        ${(days.data || []).map(d => `<div class="a2-day"><h4>Day ${d.day_number}${d.day_date ? ' · ' + esc(d.day_date) : ''} · ${esc(d.title || '')}</h4>
          ${(acts.data || []).filter(a => a.day_id === d.id).map(a => `<div class="a2-act"><span class="t">${(a.start_time || '').slice(0, 5) || '—'}</span><div>${esc(a.title)}<small>${esc([a.kind, a.location, a.optional ? 'optional' : ''].filter(Boolean).join(' · '))}${a.optional && counts[a.id] ? ` · ${counts[a.id].in} in, ${counts[a.id].skip} skip` : ''}</small>
            <details><summary>Edit</summary>${actForm(a, d.id)}</details></div><div class="a2-btns"><button type="button" data-del-act="${a.id}">Delete</button></div></div>`).join('')}
          <details><summary>+ Add activity</summary>${actForm(null, d.id)}</details></div>`).join('')}
        <form class="box" data-f="day"><div class="a2-grid"><label class="l">Date<input type="date" name="day_date"></label><label class="l wide">Title of the day<input name="title" placeholder="Links and long lunch."></label></div><div class="a2-btns"><button class="mini" type="submit">Add a day</button></div></form>
      </div>
      <div class="panel"><h3>Preparation checklist</h3><p class="caption">Everyone sees the standard list. Add items for this journey only.</p><div id="a2-check"></div></div>`;
    bindPicker(el, 'programme');
    el.querySelector('[data-f="trip"]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      const row = { itinerary_status: v(f, 'itinerary_status'), host_name: v(f, 'host_name'), host_phone: v(f, 'host_phone'), timezone: v(f, 'timezone'), lat: v(f, 'lat') == null ? null : Number(v(f, 'lat')), lng: v(f, 'lng') == null ? null : Number(v(f, 'lng')), discipline: v(f, 'discipline') || 'golf', cover_url: v(f, 'cover_url'), welcome_message: v(f, 'welcome_message'), challenges_enabled: v(f, 'challenges_enabled') };
      const { error } = await sb.from('trips').update(row).eq('id', t.id); if (!err(error)) show('programme');
    });
    el.querySelectorAll('form[data-day]').forEach(f => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = (x) => v(f, x) == null ? null : Number(v(f, x));
      const row = { trip_id: t.id, day_id: f.dataset.day, start_time: v(f, 'start_time'), end_time: v(f, 'end_time'), kind: v(f, 'kind'), sort: n('sort') || 0, title: v(f, 'title'), location: v(f, 'location'), address: v(f, 'address'), meeting_point: v(f, 'meeting_point'), dress_code: v(f, 'dress_code'), coach: v(f, 'coach'), lat: n('lat'), lng: n('lng'), description: v(f, 'description'), instructions: v(f, 'instructions'), optional: v(f, 'optional') };
      if (!row.title) return alert('Give the activity a title.');
      const q = f.dataset.act ? sb.from('trip_activities').update(row).eq('id', f.dataset.act) : sb.from('trip_activities').insert(row);
      const { error } = await q; if (!err(error)) show('programme');
    }));
    el.querySelectorAll('[data-del-act]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this activity?')) return; const { error } = await sb.from('trip_activities').delete().eq('id', b.dataset.delAct); if (!err(error)) show('programme'); }));
    el.querySelector('[data-f="day"]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const nr = (days.data || []).reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
      const { error } = await sb.from('trip_days').insert({ trip_id: t.id, day_number: nr, day_date: v(f, 'day_date'), title: v(f, 'title') }); if (!err(error)) show('programme');
    });
    const items = (await sb.from('checklist_items').select('*').order('sort')).data || [];
    const own = items.filter(i => i.trip_id === t.id);
    $('a2-check').innerHTML = `<ul style="margin:10px 0;padding-left:18px">${items.filter(i => !i.trip_id).map(i => `<li class="caption">${esc(i.label)}</li>`).join('')}${own.map(i => `<li>${esc(i.label)} <button class="mini" data-del-item="${i.id}">Remove</button></li>`).join('')}</ul>
      <form class="box" data-f="item"><div class="a2-grid"><label class="l wide">New item<input name="label" required></label><label class="l">Kind<select name="category"><option>practical</option><option>documents</option><option>gear</option><option>performance</option></select></label></div><div class="a2-btns"><button class="mini" type="submit">Add</button></div></form>`;
    $('a2-check').querySelector('form').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; const { error } = await sb.from('checklist_items').insert({ trip_id: t.id, label: v(f, 'label'), category: v(f, 'category'), sort: 50 + own.length }); if (!err(error)) show('programme'); });
    $('a2-check').querySelectorAll('[data-del-item]').forEach(b => b.addEventListener('click', async () => { const { error } = await sb.from('checklist_items').delete().eq('id', b.dataset.delItem); if (!err(error)) show('programme'); }));
  }

  // ---------- bookings ----------
  async function bookings() {
    const el = $('panel-bookings'); const t = trips.find(x => x.id === tripId);
    if (!t) { el.innerHTML = tripPicker('bookings'); return; }
    const [guests, bks] = await Promise.all([sb.from('trip_guests').select('*').eq('trip_id', t.id), sb.from('bookings').select('*').eq('trip_id', t.id)]);
    const ids = (bks.data || []).map(b => b.id);
    const pays = ids.length ? ((await sb.from('payment_items').select('*').in('booking_id', ids).order('due_date')).data || []) : [];
    const today = new Date().toISOString().slice(0, 10);
    el.innerHTML = tripPicker('bookings') + `<p class="caption" style="margin-bottom:18px">There is no online payment yet: guests see this overview and pay by bank transfer. Mark payments as paid here.</p>` +
      (bks.data || []).map(b => `<div class="panel"><h3>${esc(b.guest_email)} <span class="a2-pill">${esc(b.status)}</span></h3>
        <form class="box" data-bk="${b.id}"><div class="a2-grid"><label class="l">Reference<input name="reference" value="${esc(b.reference)}"></label><label class="l">Status<select name="status">${['option', 'confirmed', 'cancelled'].map(s => `<option ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="l">Total (EUR)<input name="total_amount" inputmode="decimal" value="${b.total_amount ?? ''}"></label><label class="l">Booked and invoiced by<input name="managed_by" value="${esc(b.managed_by)}"></label><label class="l wide">Terms (link)<input name="terms_url" value="${esc(b.terms_url)}"></label></div><div class="a2-btns"><button class="mini primary" type="submit">Save booking</button></div></form>
        <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Payment</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
        ${pays.filter(p => p.booking_id === b.id).map(p => `<tr><td>${esc(p.label)}</td><td>€ ${Number(p.amount).toFixed(2)}</td><td>${esc(p.due_date || '')}</td><td>${p.status === 'due' && p.due_date && p.due_date < today ? '<span class="a2-pill warn">overdue</span>' : esc(p.status)}${p.paid_at ? ' · ' + esc(p.paid_at) : ''}</td><td class="a2-btns">${p.status !== 'paid' ? `<button data-paid="${p.id}">Mark paid</button>` : `<button data-unpaid="${p.id}">Undo</button>`}<button data-del-pay="${p.id}">Delete</button></td></tr>`).join('')}
        </tbody></table></div>
        <form class="box" data-pay="${b.id}"><div class="a2-grid"><label class="l">Label<input name="label" placeholder="Deposit" required></label><label class="l">Amount (EUR)<input name="amount" inputmode="decimal" required></label><label class="l">Due date<input type="date" name="due_date"></label></div><div class="a2-btns"><button class="mini" type="submit">Add payment</button></div></form></div>`).join('') +
      `<div class="panel"><h3>New booking</h3><form class="box" data-f="newbk"><div class="a2-grid"><label class="l">Guest<select name="guest_email">${(guests.data || []).map(g => `<option>${esc(g.email)}</option>`).join('')}</select></label><label class="l">Reference<input name="reference"></label><label class="l">Total (EUR)<input name="total_amount" inputmode="decimal"></label></div><div class="a2-btns"><button class="mini primary" type="submit">Create booking</button></div></form></div>`;
    bindPicker(el, 'bookings');
    const num = (x) => x == null ? null : Number(String(x).replace(',', '.'));
    el.querySelectorAll('form[data-bk]').forEach(f => f.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('bookings').update({ reference: v(f, 'reference'), status: v(f, 'status'), total_amount: num(v(f, 'total_amount')), managed_by: v(f, 'managed_by') || 'BAEDO Journeys', terms_url: v(f, 'terms_url') }).eq('id', f.dataset.bk); if (!err(error)) show('bookings'); }));
    el.querySelectorAll('form[data-pay]').forEach(f => f.addEventListener('submit', async (e) => { e.preventDefault(); const amt = num(v(f, 'amount')); if (amt == null || isNaN(amt)) return alert('Add an amount.'); const { error } = await sb.from('payment_items').insert({ booking_id: f.dataset.pay, label: v(f, 'label'), amount: amt, due_date: v(f, 'due_date') }); if (!err(error)) show('bookings'); }));
    el.querySelectorAll('[data-paid]').forEach(b => b.addEventListener('click', async () => { const { error } = await sb.from('payment_items').update({ status: 'paid', paid_at: new Date().toISOString().slice(0, 10) }).eq('id', b.dataset.paid); if (!err(error)) show('bookings'); }));
    el.querySelectorAll('[data-unpaid]').forEach(b => b.addEventListener('click', async () => { const { error } = await sb.from('payment_items').update({ status: 'due', paid_at: null }).eq('id', b.dataset.unpaid); if (!err(error)) show('bookings'); }));
    el.querySelectorAll('[data-del-pay]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this payment line?')) return; const { error } = await sb.from('payment_items').delete().eq('id', b.dataset.delPay); if (!err(error)) show('bookings'); }));
    const nb = el.querySelector('[data-f="newbk"]'); if (nb) nb.addEventListener('submit', async (e) => { e.preventDefault(); if (!v(nb, 'guest_email')) return alert('Add the guest to the journey first.'); const { error } = await sb.from('bookings').insert({ trip_id: t.id, guest_email: v(nb, 'guest_email'), reference: v(nb, 'reference'), total_amount: num(v(nb, 'total_amount')) }); if (!err(error)) show('bookings'); });
  }

  // ---------- concierge ----------
  let openReq = null;
  async function concierge() {
    const el = $('panel-concierge');
    const { data } = await sb.from('concierge_requests').select('*').order('created_at', { ascending: false });
    const reqs = data || [];
    if (openReq) {
      const r = reqs.find(x => x.id === openReq);
      const msgs = (await sb.from('concierge_messages').select('*').eq('request_id', openReq).order('created_at')).data || [];
      el.innerHTML = `<p style="margin:24px 0"><button class="mini" data-back>← All requests</button></p><div class="panel"><h3>${esc(r.subject)}</h3>
        <p class="caption">${esc(r.email)} · ${esc(r.category)} · ${dt(r.created_at)}${r.preferred_date ? ' · for ' + esc(r.preferred_date) : ''}${r.trip_id ? ' · ' + esc((trips.find(t => t.id === r.trip_id) || {}).title || '') : ''}</p>
        ${r.details ? `<p style="margin-top:12px;white-space:pre-line">${esc(r.details)}</p>` : ''}
        <form class="box" data-f="status"><label class="l">Status<select name="status">${Object.entries(RS).map(([k, l]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p class="caption">Only choose “Confirmed” once the reservation is really confirmed.</p><div class="a2-btns"><button class="mini primary" type="submit">Save status</button></div></form>
        <div class="a2-thread">${msgs.map(m => `<div class="${m.author_role}">${esc(m.body).replace(/\n/g, '<br>')}<br><small class="caption">${m.author_role === 'baedo' ? 'BAEDO' : 'Guest'} · ${dt(m.created_at)}</small></div>`).join('') || '<p class="caption">No messages yet.</p>'}</div>
        <form class="box" data-f="reply"><label class="l">Reply to the guest<textarea name="body" rows="3" required></textarea></label><div class="a2-btns"><button class="mini primary" type="submit">Send reply</button></div></form></div>`;
      el.querySelector('[data-back]').addEventListener('click', () => { openReq = null; concierge(); });
      el.querySelector('[data-f="status"]').addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('concierge_requests').update({ status: v(e.target, 'status'), updated_at: new Date().toISOString() }).eq('id', r.id); if (!err(error)) concierge(); });
      el.querySelector('[data-f="reply"]').addEventListener('submit', async (e) => { e.preventDefault(); const body = v(e.target, 'body'); if (!body) return; const { error } = await sb.from('concierge_messages').insert({ request_id: r.id, body, author_role: 'baedo' }); if (err(error)) return; if (r.status === 'received') await sb.from('concierge_requests').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', r.id); else await sb.from('concierge_requests').update({ updated_at: new Date().toISOString() }).eq('id', r.id); concierge(); });
      return;
    }
    el.innerHTML = `<div class="panel" style="margin-top:24px"><h3>Concierge requests</h3><div class="table-wrap"><table class="table"><thead><tr><th>Received</th><th>Guest</th><th>Request</th><th>Status</th><th></th></tr></thead><tbody>
      ${reqs.map(r => `<tr><td>${dt(r.created_at)}</td><td>${esc(r.email)}</td><td>${esc(r.subject)}<br><span class="caption">${esc(r.category)}</span></td><td><span class="a2-pill ${r.status === 'received' ? 'warn' : ''}">${RS[r.status]}</span></td><td><button class="mini" data-open-req="${r.id}">Open</button></td></tr>`).join('') || '<tr><td colspan="5" class="caption">No requests yet.</td></tr>'}
      </tbody></table></div></div>`;
    el.querySelectorAll('[data-open-req]').forEach(b => b.addEventListener('click', () => { openReq = b.dataset.openReq; concierge(); }));
  }

  // ---------- wallet ----------
  async function wallet() {
    const el = $('panel-wallet'); const t = trips.find(x => x.id === tripId);
    if (!t) { el.innerHTML = tripPicker('wallet'); return; }
    const [files, guests] = await Promise.all([sb.from('trip_files').select('*').eq('trip_id', t.id).order('published_at', { ascending: false }), sb.from('trip_guests').select('email').eq('trip_id', t.id)]);
    const gopts = (sel) => `<option value="">Everyone on this journey</option>${(guests.data || []).map(g => `<option ${sel && sel.toLowerCase() === g.email.toLowerCase() ? 'selected' : ''}>${esc(g.email)}</option>`).join('')}`;
    el.innerHTML = tripPicker('wallet') + `<div class="panel"><h3>Upload a document</h3><p class="caption">Never upload passports or ID documents.</p>
      <form class="box" data-f="up"><div class="a2-grid"><label class="l wide">File<input type="file" name="file" required></label><label class="l">Title<input name="title" required></label><label class="l">Category<select name="category">${Object.entries(CATS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label class="l">Visible to<select name="guest_email">${gopts()}</select></label></div><div class="a2-btns"><button class="mini primary" type="submit">Upload</button></div></form></div>
      <div class="panel"><h3>Documents</h3><div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Category</th><th>Visible to</th><th>Version</th><th></th></tr></thead><tbody>
      ${(files.data || []).map(f => `<tr><td><input data-k="title" data-id="${f.id}" value="${esc(f.title)}"></td><td><select data-k="category" data-id="${f.id}">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${f.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><select data-k="guest_email" data-id="${f.id}">${gopts(f.guest_email)}</select></td><td><input data-k="version" data-id="${f.id}" type="number" min="1" value="${f.version}" style="width:70px"></td><td><button class="mini" data-del-file="${f.id}" data-path="${esc(f.storage_path)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="caption">No documents yet.</td></tr>'}
      </tbody></table></div><p class="caption">Changes save automatically.</p></div>`;
    bindPicker(el, 'wallet');
    el.querySelectorAll('[data-k]').forEach(i => i.addEventListener('change', async () => { const val = i.value === '' ? null : (i.dataset.k === 'version' ? Number(i.value) : i.value); const { error } = await sb.from('trip_files').update({ [i.dataset.k]: val, ...(i.dataset.k === 'version' ? { published_at: new Date().toISOString() } : {}) }).eq('id', i.dataset.id); err(error); }));
    el.querySelectorAll('[data-del-file]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this document?')) return; await sb.storage.from('trip-files').remove([b.dataset.path]); const { error } = await sb.from('trip_files').delete().eq('id', b.dataset.delFile); if (!err(error)) show('wallet'); }));
    el.querySelector('[data-f="up"]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const file = f.elements.file.files[0]; if (!file) return;
      const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Uploading…';
      const path = `${t.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await sb.storage.from('trip-files').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (err(up.error)) { btn.disabled = false; btn.textContent = 'Upload'; return; }
      const { error } = await sb.from('trip_files').insert({ trip_id: t.id, kind: /^image\//.test(file.type) ? 'photo' : 'document', title: v(f, 'title'), category: v(f, 'category'), guest_email: v(f, 'guest_email'), storage_path: path });
      if (!err(error)) show('wallet');
    });
  }

  // ---------- coaching ----------
  async function coaching() {
    const el = $('panel-coaching'); const t = trips.find(x => x.id === tripId);
    if (!t) { el.innerHTML = tripPicker('coaching'); return; }
    const [sess, guests] = await Promise.all([sb.from('coaching_sessions').select('*').eq('trip_id', t.id).order('starts_at'), sb.from('trip_guests').select('email,full_name').eq('trip_id', t.id)]);
    const emails = (guests.data || []).map(g => g.email.toLowerCase());
    const profs = emails.length ? ((await sb.from('profiles').select('id,email,full_name').in('email', emails)).data || []) : [];
    const goals = profs.length ? ((await sb.from('performance_goals').select('*').in('user_id', profs.map(p => p.id))).data || []) : [];
    const who = (uid) => { const p = profs.find(x => x.id === uid); return p ? (p.full_name || p.email) : 'Whole group'; };
    const popts = (sel) => `<option value="">Whole group</option>${profs.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.full_name || p.email)}</option>`).join('')}`;
    el.innerHTML = tripPicker('coaching') + `<div class="panel"><h3>Coaching sessions</h3>
      ${(sess.data || []).map(s => `<div class="a2-act"><span class="t">${dt(s.starts_at)}</span><div>${esc(s.title)}<small>${esc(who(s.user_id))}${s.coach ? ' · ' + esc(s.coach) : ''}${s.location ? ' · ' + esc(s.location) : ''}</small>
        <details><summary>Edit or add feedback</summary><form class="box" data-sess="${s.id}"><div class="a2-grid"><label class="l">Title<input name="title" value="${esc(s.title)}"></label><label class="l">Coach<input name="coach" value="${esc(s.coach)}"></label><label class="l">Location<input name="location" value="${esc(s.location)}"></label><label class="l wide">Content<textarea name="content" rows="2">${esc(s.content)}</textarea></label><label class="l wide">Feedback for the guest<textarea name="feedback" rows="3">${esc(s.feedback)}</textarea></label></div><div class="a2-btns"><button class="mini primary" type="submit">Save</button></div></form></details></div>
        <div class="a2-btns"><button data-del-sess="${s.id}">Delete</button></div></div>`).join('') || '<p class="caption">No sessions yet.</p>'}
      <form class="box" data-f="sess"><div class="a2-grid"><label class="l">Date and time (local)<input type="datetime-local" name="starts_at" required></label><label class="l">Duration (min)<input type="number" name="duration_min" value="60"></label><label class="l">For<select name="user_id">${popts()}</select></label><label class="l">Title<input name="title" required placeholder="Swing check"></label><label class="l">Coach<input name="coach"></label><label class="l">Location<input name="location"></label><label class="l wide">Content<textarea name="content" rows="2"></textarea></label></div><div class="a2-btns"><button class="mini primary" type="submit">Add session</button></div></form></div>
      <div class="panel"><h3>Goals of the guests</h3>
      ${goals.map(g => `<div class="a2-act"><span class="t">${esc(g.status)}</span><div>${esc(g.title)}<small>${esc(who(g.user_id))} · set by ${esc(g.set_by)}</small></div><div class="a2-btns"><button data-goal="${g.id}" data-v="${g.status === 'achieved' ? 'active' : 'achieved'}">${g.status === 'achieved' ? 'Reopen' : 'Achieved'}</button></div></div>`).join('') || '<p class="caption">No goals yet.</p>'}
      <form class="box" data-f="goal"><div class="a2-grid"><label class="l">Guest<select name="user_id" required>${profs.map(p => `<option value="${p.id}">${esc(p.full_name || p.email)}</option>`).join('')}</select></label><label class="l wide">Goal set with the coach<input name="title" required></label></div><div class="a2-btns"><button class="mini" type="submit">Add goal</button></div></form></div>`;
    bindPicker(el, 'coaching');
    el.querySelector('[data-f="sess"]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const local = v(f, 'starts_at'); if (!local) return;
      const { error } = await sb.from('coaching_sessions').insert({ trip_id: t.id, user_id: v(f, 'user_id'), starts_at: new Date(local).toISOString(), duration_min: Number(v(f, 'duration_min')) || 60, title: v(f, 'title'), coach: v(f, 'coach'), location: v(f, 'location'), content: v(f, 'content') }); if (!err(error)) show('coaching');
    });
    el.querySelectorAll('form[data-sess]').forEach(f => f.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('coaching_sessions').update({ title: v(f, 'title'), coach: v(f, 'coach'), location: v(f, 'location'), content: v(f, 'content'), feedback: v(f, 'feedback') }).eq('id', f.dataset.sess); if (!err(error)) show('coaching'); }));
    el.querySelectorAll('[data-del-sess]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Delete this session?')) return; const { error } = await sb.from('coaching_sessions').delete().eq('id', b.dataset.delSess); if (!err(error)) show('coaching'); }));
    el.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', async () => { const { error } = await sb.from('performance_goals').update({ status: b.dataset.v }).eq('id', b.dataset.goal); if (!err(error)) show('coaching'); }));
    const gf = el.querySelector('[data-f="goal"]'); gf.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('performance_goals').insert({ user_id: v(gf, 'user_id'), trip_id: t.id, title: v(gf, 'title'), set_by: 'coach' }); if (!err(error)) show('coaching'); });
  }

  const wait = setInterval(() => { const va = $('view-admin'); if (va && !va.classList.contains('hidden')) { clearInterval(wait); init(); } }, 300);
  setTimeout(() => clearInterval(wait), 30000);
})();
