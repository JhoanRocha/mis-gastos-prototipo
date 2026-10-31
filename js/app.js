/* Mis Gastos – prototipo funcional
 * Módulos: 1 cuentas · 2 movimientos · 3 categorías · 4 presupuesto y alertas · 5 panel de resumen
 * Los datos se guardan en localStorage (solo en este navegador). */
(function () {
  'use strict';

  /* ================= Utilidades ================= */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  var money = function (n) { return cop.format(Math.round(n || 0)); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var monthOf = function (d) { return d.slice(0, 7); };
  var shiftMonth = function (m, delta) {
    var p = m.split('-'); var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  };
  var monthLabel = function (m) {
    var p = m.split('-');
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date(+p[0], +p[1] - 1, 1));
  };
  var dayLabel = function (iso) {
    var p = iso.split('-');
    return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(+p[0], +p[1] - 1, +p[2]));
  };

  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ICONS = [['aliment', '🍽️'], ['merc', '🛒'], ['transp', '🚌'], ['viviend', '🏠'], ['arrien', '🏠'], ['servic', '💡'], ['salud', '💊'],
    ['ocio', '🎬'], ['educ', '🎓'], ['mascot', '🐾'], ['otro', '✨'], ['rop', '👕'], ['viaj', '✈️'], ['ahorr', '🐖'], ['regalo', '🎁'], ['cafe', '☕']];
  function catIcon(name) {
    var n = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var i = 0; i < ICONS.length; i++) if (n.indexOf(ICONS[i][0]) !== -1) return ICONS[i][1];
    return esc(String(name || '?').charAt(0).toUpperCase());
  }
  /* Cuenta de 0 al valor final; el texto final siempre queda exacto. */
  function runCountUps(root) {
    if (reduced) return;
    $$('[data-count]', root).forEach(function (el) {
      var to = Number(el.dataset.count) || 0, t0 = null, dur = 950;
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = money(to * e);
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      setTimeout(function () { el.textContent = money(to); }, dur + 120);
    });
  }

  /* ================= Almacenamiento ================= */
  var KEY = { users: 'gx_users', session: 'gx_session', data: function (id) { return 'gx_data_' + id; } };
  function read(k, fallback) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast('No se pudo guardar en este navegador (¿modo privado o sin espacio?).', 'error'); return false; }
  }

  var DEFAULT_CATS = [
    ['Alimentación', '#ff7a59'], ['Transporte', '#12b886'], ['Vivienda', '#5b6cff'], ['Servicios', '#f5b301'],
    ['Salud', '#ff6b9a'], ['Ocio', '#a95cff'], ['Educación', '#2ab7ff'], ['Otros', '#8f98ad']
  ];
  function newData() {
    return {
      categories: DEFAULT_CATS.map(function (c) { return { id: uid(), name: c[0], color: c[1], active: true }; }),
      movements: [],
      budgets: {}
    };
  }

  /* ================= Validación de datos guardados ================= */
  var RE_ID = /^[A-Za-z0-9_-]{1,40}$/, RE_DATE = /^\d{4}-\d{2}-\d{2}$/, RE_COLOR = /^#[0-9a-fA-F]{6}$/, RE_MONTH = /^\d{4}-\d{2}$/;
  function sanitizeData(d) {
    var out = newData();
    if (!d || typeof d !== 'object') return out;
    if (Array.isArray(d.categories)) {
      var cats = d.categories.filter(function (c) { return c && RE_ID.test(c.id) && typeof c.name === 'string'; }).map(function (c) {
        return { id: c.id, name: c.name.slice(0, 24), color: RE_COLOR.test(c.color) ? c.color : '#8a8f98', active: c.active !== false };
      });
      if (cats.length) out.categories = cats;
    }
    var ids = {}; out.categories.forEach(function (c) { ids[c.id] = true; });
    if (Array.isArray(d.movements)) {
      out.movements = d.movements.filter(function (m) {
        return m && RE_ID.test(m.id) && (m.type === 'gasto' || m.type === 'ingreso') && isFinite(m.amount) && m.amount > 0 &&
          RE_DATE.test(m.date) && (m.type === 'ingreso' || ids[m.categoryId]);
      }).map(function (m) {
        return { id: m.id, type: m.type, amount: Math.round(m.amount), date: m.date, categoryId: m.type === 'gasto' ? m.categoryId : null, note: String(m.note || '').slice(0, 80) };
      });
    }
    if (d.budgets && typeof d.budgets === 'object') {
      Object.keys(d.budgets).forEach(function (mo) {
        if (!RE_MONTH.test(mo) || !d.budgets[mo] || typeof d.budgets[mo] !== 'object') return;
        out.budgets[mo] = {};
        Object.keys(d.budgets[mo]).forEach(function (id) {
          var v = d.budgets[mo][id];
          if (ids[id] && isFinite(v) && v > 0) out.budgets[mo][id] = Math.round(v);
        });
      });
    }
    return out;
  }

  /* ================= Estado ================= */
  var S = {
    user: null, data: null, view: 'panel',
    month: ymd(new Date()).slice(0, 7),
    filter: { type: '', cat: '' }
  };
  var save = function () { return write(KEY.data(S.user.id), S.data); };

  /* ================= Seguridad de contraseñas ================= */
  function randomSalt() {
    var a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return pad(b.toString(16)).slice(-2); }).join('');
  }
  var toHex = function (buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };
  var hasCrypto = function () { return !!(window.crypto && crypto.subtle && window.TextEncoder); };
  /* kdf: 'pbkdf2' (actual), 'sha256' (cuentas antiguas) o 'weak' (navegador sin Web Crypto). */
  function hashPassword(pw, salt, kdf) {
    var enc = hasCrypto() ? new TextEncoder() : null;
    if (kdf === 'pbkdf2' && enc) {
      return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (key) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 210000 }, key, 256);
      }).then(toHex);
    }
    var text = salt + ':' + pw;
    if (kdf === 'sha256' && enc) return crypto.subtle.digest('SHA-256', enc.encode(text)).then(toHex);
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return Promise.resolve('f' + h.toString(16));
  }
  var bestKdf = function () { return hasCrypto() ? 'pbkdf2' : 'weak'; };

  /* Límite de intentos de inicio de sesión: 5 fallos seguidos bloquean 60 s */
  var LOCK = { key: 'gx_lock', max: 5, secs: 60 };
  function lockLeft() {
    var l = read(LOCK.key, { n: 0, until: 0 });
    return Math.max(0, Math.ceil((l.until - Date.now()) / 1000));
  }
  function lockFail() {
    var l = read(LOCK.key, { n: 0, until: 0 });
    l.n = (l.until && Date.now() > l.until ? 0 : l.n) + 1;
    if (l.n >= LOCK.max) { l.until = Date.now() + LOCK.secs * 1000; l.n = 0; }
    write(LOCK.key, l);
  }
  function lockClear() { try { localStorage.removeItem(LOCK.key); } catch (e) { /* sin acceso */ } }

  /* ================= Cuentas (módulo 1) ================= */
  var validEmail = function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); };

  function register(name, email, pw) {
    name = name.trim(); email = email.trim().toLowerCase();
    if (!name) return Promise.reject('Escribe tu nombre.');
    if (!validEmail(email)) return Promise.reject('Escribe un correo válido.');
    if (pw.length < 6) return Promise.reject('La contraseña debe tener al menos 6 caracteres.');
    var users = read(KEY.users, []);
    if (users.some(function (u) { return u.email === email; })) return Promise.reject('Ya existe una cuenta con ese correo.');
    var salt = randomSalt(), kdf = bestKdf();
    return hashPassword(pw, salt, kdf).then(function (h) {
      var user = { id: uid(), name: name, email: email, salt: salt, kdf: kdf, hash: h };
      users.push(user); write(KEY.users, users);
      write(KEY.data(user.id), newData());
      return user;
    });
  }
  function login(email, pw) {
    email = email.trim().toLowerCase();
    var wait = lockLeft();
    if (wait) return Promise.reject('Demasiados intentos fallidos. Espera ' + wait + ' segundos e inténtalo de nuevo.');
    var users = read(KEY.users, []);
    var user = users.filter(function (u) { return u.email === email; })[0];
    var bad = 'Correo o contraseña incorrectos.';
    if (!user) { lockFail(); return Promise.reject(bad); }
    var kdf = user.kdf || (String(user.hash).charAt(0) === 'f' ? 'weak' : 'sha256');
    return hashPassword(pw, user.salt, kdf).then(function (h) {
      if (h !== user.hash) { lockFail(); throw bad; }
      lockClear();
      if (kdf !== 'pbkdf2' && hasCrypto()) {   // migra cuentas antiguas a PBKDF2
        var salt = randomSalt();
        return hashPassword(pw, salt, 'pbkdf2').then(function (nh) {
          user.salt = salt; user.kdf = 'pbkdf2'; user.hash = nh; write(KEY.users, users);
          return user;
        });
      }
      return user;
    });
  }
  function startSession(user) {
    S.user = user;
    S.data = sanitizeData(read(KEY.data(user.id), null));
    S.month = ymd(new Date()).slice(0, 7);
    S.view = 'panel'; S.filter = { type: '', cat: '' };
    write(KEY.session, user.id);
    showApp();
  }
  function logout() {
    try { localStorage.removeItem(KEY.session); } catch (e) { /* sin acceso */ }
    S.user = null; S.data = null;
    showAuth();
  }

  /* ================= Cálculos ================= */
  var cat = function (id) { return S.data.categories.filter(function (c) { return c.id === id; })[0]; };
  var activeCats = function () { return S.data.categories.filter(function (c) { return c.active; }); };
  var inMonth = function (m) { return S.data.movements.filter(function (x) { return monthOf(x.date) === m; }); };
  function totals(m) {
    var t = { income: 0, expense: 0, byCat: {} };
    inMonth(m).forEach(function (x) {
      if (x.type === 'ingreso') t.income += x.amount;
      else { t.expense += x.amount; t.byCat[x.categoryId] = (t.byCat[x.categoryId] || 0) + x.amount; }
    });
    t.balance = t.income - t.expense;
    return t;
  }
  var budgetOf = function (m, catId) { var b = S.data.budgets[m]; return b && b[catId] ? b[catId] : 0; };
  function status(spent, limit) {
    if (!limit) return 'none';
    var p = spent / limit;
    return p >= 1 ? 'danger' : p >= 0.8 ? 'warn' : 'ok';
  }

  /* ================= Avisos y modal ================= */
  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    var life = kind === 'warn' || kind === 'error' ? 6000 : 3200;
    setTimeout(function () { el.classList.add('out'); }, life - 350);
    setTimeout(function () { el.remove(); }, life);
  }
  var modal = $('#modal');
  function openModal(html, onSubmit) {
    modal.innerHTML = html;
    var form = $('form', modal);
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); onSubmit(form); });
    $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', function () { modal.close(); }); });
    if (!modal.open) modal.showModal();
    var first = $('input:not([type=radio]), select', modal);
    if (first) first.focus();
  }

  /* ================= Movimientos (módulo 2) ================= */
  function movementForm(m) {
    var editing = !!m;
    var x = m || { type: 'gasto', amount: '', date: S.month === ymd(new Date()).slice(0, 7) ? ymd(new Date()) : S.month + '-01', categoryId: '', note: '' };
    var cats = activeCats();
    if (x.categoryId && !cats.some(function (c) { return c.id === x.categoryId; }) && cat(x.categoryId)) cats = cats.concat([cat(x.categoryId)]);
    var opts = cats.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === x.categoryId ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    openModal(
      '<form novalidate><h2 id="modal-title">' + (editing ? 'Editar movimiento' : 'Registrar movimiento') + '</h2>' +
      '<div class="seg" role="radiogroup" aria-label="Tipo">' +
      '<label class="' + (x.type === 'gasto' ? 'on' : '') + '"><input type="radio" name="type" value="gasto"' + (x.type === 'gasto' ? ' checked' : '') + '>Gasto</label>' +
      '<label class="' + (x.type === 'ingreso' ? 'on' : '') + '"><input type="radio" name="type" value="ingreso"' + (x.type === 'ingreso' ? ' checked' : '') + '>Ingreso</label></div>' +
      '<div class="form">' +
      '<label>Valor (COP)<input name="amount" type="number" inputmode="numeric" min="1" step="1" required value="' + esc(x.amount) + '" placeholder="Ej. 15000"></label>' +
      '<label id="cat-field">Categoría<select name="categoryId">' + opts + '</select></label>' +
      '<label>Fecha<input name="date" type="date" required value="' + esc(x.date) + '"></label>' +
      '<label>Nota (opcional)<input name="note" type="text" maxlength="80" value="' + esc(x.note) + '" placeholder="Ej. almuerzo con amigos"></label>' +
      '<p class="error" data-error role="alert"></p></div>' +
      '<div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>',
      function (form) {
        var type = form.type.value;
        var amount = Math.round(Number(form.amount.value));
        var date = form.date.value;
        var err = $('[data-error]', form);
        if (!(amount > 0)) { err.textContent = 'Escribe un valor mayor que cero.'; form.amount.focus(); return; }
        if (!date) { err.textContent = 'Elige una fecha.'; form.date.focus(); return; }
        if (type === 'gasto' && !form.categoryId.value) { err.textContent = 'Crea o activa una categoría primero.'; return; }
        var rec = {
          id: editing ? m.id : uid(), type: type, amount: amount, date: date,
          categoryId: type === 'gasto' ? form.categoryId.value : null, note: form.note.value.trim()
        };
        var before = type === 'gasto' ? (totals(monthOf(date)).byCat[rec.categoryId] || 0) - (editing && m.type === 'gasto' && m.categoryId === rec.categoryId && monthOf(m.date) === monthOf(date) ? m.amount : 0) : 0;
        if (editing) S.data.movements = S.data.movements.map(function (y) { return y.id === m.id ? rec : y; });
        else S.data.movements.push(rec);
        if (!save()) return;
        modal.close();
        toast(editing ? 'Movimiento actualizado.' : 'Movimiento guardado.', 'ok');
        if (type === 'gasto') checkAlert(rec, before);
        render();
      }
    );
    var form = $('form', modal);
    function sync() {
      var isExp = form.type.value === 'gasto';
      $('#cat-field').hidden = !isExp;
      $$('.seg label', form).forEach(function (l) { l.classList.toggle('on', $('input', l).checked); });
    }
    $$('input[name=type]', form).forEach(function (r) { r.addEventListener('change', sync); });
    sync();
  }
  function checkAlert(rec, before) {
    var m = monthOf(rec.date), limit = budgetOf(m, rec.categoryId);
    if (!limit) return;
    var after = totals(m).byCat[rec.categoryId] || 0;
    var name = (cat(rec.categoryId) || {}).name;
    if (before < limit && after >= limit) toast('⚠ Superaste el presupuesto de ' + name + ' (' + money(after) + ' de ' + money(limit) + ').', 'warn');
    else if (before < limit * 0.8 && after >= limit * 0.8) toast('Atención: llevas el ' + Math.round(after / limit * 100) + ' % del presupuesto de ' + name + '.', 'warn');
  }
  function deleteMovement(id) {
    var m = S.data.movements.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    openModal(
      '<form><h2 id="modal-title">¿Eliminar movimiento?</h2><p>' + esc(m.note || (m.type === 'ingreso' ? 'Ingreso' : (cat(m.categoryId) || {}).name)) + ' · <strong>' + money(m.amount) + '</strong> · ' + esc(dayLabel(m.date)) + '</p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn danger" type="submit">Eliminar</button></div></form>',
      function () {
        S.data.movements = S.data.movements.filter(function (x) { return x.id !== id; });
        save(); modal.close(); toast('Movimiento eliminado.'); render();
      }
    );
  }

  /* ================= Categorías (módulo 3) ================= */
  function categoryForm(c) {
    var editing = !!c;
    var x = c || { name: '', color: '#0f766e' };
    openModal(
      '<form novalidate><h2 id="modal-title">' + (editing ? 'Editar categoría' : 'Nueva categoría') + '</h2><div class="form">' +
      '<label>Nombre<input name="name" type="text" maxlength="24" required value="' + esc(x.name) + '" placeholder="Ej. Mascotas"></label>' +
      '<label>Color<input name="color" type="color" value="' + esc(x.color) + '"></label>' +
      '<p class="error" data-error role="alert"></p></div>' +
      '<div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>',
      function (form) {
        var name = form.name.value.trim(), err = $('[data-error]', form);
        if (!name) { err.textContent = 'Escribe un nombre.'; return; }
        var dup = S.data.categories.some(function (k) { return k.name.toLowerCase() === name.toLowerCase() && (!editing || k.id !== c.id); });
        if (dup) { err.textContent = 'Ya existe una categoría con ese nombre.'; return; }
        if (editing) { c.name = name; c.color = form.color.value; }
        else S.data.categories.push({ id: uid(), name: name, color: form.color.value, active: true });
        save(); modal.close(); toast('Categoría guardada.', 'ok'); render();
      }
    );
  }

  /* ================= Vistas ================= */
  function donut(byCat, total) {
    var R = 70, C = 2 * Math.PI * R, offset = 0, parts = '', k = 0;
    Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).forEach(function (id) {
      var c = cat(id) || { color: '#8f98ad' }, len = byCat[id] / total * C;
      parts += '<circle class="seg" r="' + R + '" cx="95" cy="95" fill="none" stroke="' + esc(c.color) + '" stroke-width="24" stroke-dasharray="' + len + ' ' + (C - len) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 95 95)" style="--circ:' + C + 'px;animation-delay:' + (k * 70) + 'ms"/>';
      offset += len; k++;
    });
    return '<svg class="donut" viewBox="0 0 190 190" role="img" aria-label="Gastos por categoría">' +
      '<circle r="' + R + '" cx="95" cy="95" fill="none" stroke="var(--line)" stroke-width="24" opacity=".6"/>' + parts +
      '<text x="95" y="88" text-anchor="middle" font-size="11" opacity=".65">Gastos</text>' +
      '<text x="95" y="110" text-anchor="middle" font-size="16" font-weight="800">' + esc(money(total)) + '</text></svg>';
  }

  function emptyState() {
    return '<div class="card empty"><svg viewBox="0 0 150 120" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe66d"/><stop offset="1" stop-color="#ffb000"/></linearGradient></defs>' +
      '<ellipse cx="75" cy="106" rx="48" ry="8" fill="currentColor" opacity=".08"/><circle cx="75" cy="58" r="40" fill="url(#eg)"/><circle cx="75" cy="58" r="30" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>' +
      '<text x="75" y="72" text-anchor="middle" font-size="40" font-weight="800" fill="#a56a00" font-family="system-ui">$</text><path d="M118 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#a45cff"/><path d="M26 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ff6ba6"/></svg>' +
      '<h2>Aún no tienes movimientos</h2><p>Registra tu primer gasto con el botón <strong>+</strong>, o carga datos de ejemplo para conocer la aplicación.</p>' +
      '<button class="btn primary" data-action="sample">Cargar datos de ejemplo</button></div>';
  }

  function sparkBars(m) {
    var p = m.split('-'), days = new Date(+p[0], +p[1], 0).getDate(), sums = [], max = 0, hi = 0, i;
    for (i = 0; i < days; i++) sums.push(0);
    inMonth(m).forEach(function (x) { if (x.type === 'gasto') sums[+x.date.slice(8, 10) - 1] += x.amount; });
    sums.forEach(function (v, k) { if (v > max) { max = v; hi = k; } });
    return sums.map(function (v, k) {
      var h = max ? Math.max(6, Math.round(v / max * 100)) : 6;
      return '<i class="' + (k === hi && max ? 'hi' : '') + '" style="--h:' + h + '%;--i:' + k + '" title="Día ' + (k + 1) + ': ' + esc(money(v)) + '"></i>';
    }).join('');
  }

  function viewPanel() {
    var t = totals(S.month), p = totals(shiftMonth(S.month, -1));
    if (!S.data.movements.length) return emptyState();
    var first = String(S.user.name || '').split(' ')[0];
    var spentPct = t.income > 0 ? Math.min(999, Math.round(t.expense / t.income * 100)) : (t.expense > 0 ? 100 : 0);
    var delta = '';
    if (p.expense > 0) {
      var d = (t.expense - p.expense) / p.expense * 100;
      delta = '<span class="' + (d > 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '▲' : '▼') + ' ' + Math.abs(Math.round(d)) + ' %</span> frente a ' + esc(monthLabel(shiftMonth(S.month, -1)));
    } else delta = 'Sin datos del mes anterior';
    var days = new Date(+S.month.slice(0, 4), +S.month.slice(5), 0).getDate();

    var html = '<section class="hero" aria-label="Saldo del mes"><span class="hero-blob b1"></span><span class="hero-blob b2"></span>' +
      '<div class="hero-top"><div><p class="hero-hello">Hola, ' + esc(first) + ' 👋</p><p class="hero-label">Saldo de ' + esc(monthLabel(S.month)) + '</p></div>' +
      '<span class="chip">' + spentPct + ' % del ingreso gastado</span></div>' +
      '<div class="hero-value ' + (t.balance < 0 ? 'neg-light' : '') + '" data-count="' + t.balance + '">' + money(t.balance) + '</div>' +
      '<div class="meter" role="img" aria-label="' + spentPct + ' % del ingreso gastado"><span style="--w:' + Math.min(100, spentPct) + '%"></span></div>' +
      '<div class="spark" aria-hidden="true">' + sparkBars(S.month) + '</div><div class="spark-cap"><span>1</span><span>Gasto diario</span><span>' + days + '</span></div></section>';

    html += '<div class="grid cards">' +
      '<div class="card stat"><div class="top"><span class="label">Ingresos</span><span class="badge"><svg aria-hidden="true"><use href="#i-down"/></svg></span></div><div class="value pos" data-count="' + t.income + '">' + money(t.income) + '</div></div>' +
      '<div class="card stat out"><div class="top"><span class="label">Gastos</span><span class="badge"><svg aria-hidden="true"><use href="#i-up"/></svg></span></div><div class="value neg" data-count="' + t.expense + '">' + money(t.expense) + '</div><div class="delta">' + delta + '</div></div></div>';

    var alerts = '';
    activeAndUsed(t).forEach(function (c) {
      var limit = budgetOf(S.month, c.id), spent = t.byCat[c.id] || 0, st = status(spent, limit);
      if (st === 'danger') alerts += '<div class="alert danger"><span>Superaste el presupuesto de <strong>' + esc(c.name) + '</strong>: ' + money(spent) + ' de ' + money(limit) + '.</span></div>';
      else if (st === 'warn') alerts += '<div class="alert warn"><span>Llevas el ' + Math.round(spent / limit * 100) + ' % del presupuesto de <strong>' + esc(c.name) + '</strong> (' + money(spent) + ' de ' + money(limit) + ').</span></div>';
    });
    if (alerts) html += '<div><div class="section-head"><h2>Alertas</h2></div>' + alerts + '</div>';

    html += '<div class="grid two"><div class="card lift"><h2>Gastos por categoría</h2>';
    if (t.expense > 0) {
      html += '<div class="donut-wrap">' + donut(t.byCat, t.expense) + '<ul class="legend">' +
        Object.keys(t.byCat).sort(function (a, b) { return t.byCat[b] - t.byCat[a]; }).map(function (id) {
          var c = cat(id) || { name: 'Sin categoría', color: '#8f98ad' };
          return '<li><span class="dot" style="background:' + esc(c.color) + '"></span>' + esc(c.name) + '<span class="amt">' + money(t.byCat[id]) + ' · ' + Math.round(t.byCat[id] / t.expense * 100) + ' %</span></li>';
        }).join('') + '</ul></div>';
    } else html += '<p class="muted">No hay gastos en este mes.</p>';
    html += '</div><div class="card lift"><div class="section-head" style="margin-top:0"><h2>Últimos movimientos</h2><button class="btn ghost small" data-view="movimientos">Ver todos</button></div>';
    var last = inMonth(S.month).sort(sortDesc).slice(0, 5);
    html += last.length ? '<ul class="list">' + last.map(function (m) { return rowMovement(m, false); }).join('') + '</ul>' : '<p class="muted">Sin movimientos este mes.</p>';
    return html + '</div></div>';
  }
  function activeAndUsed(t) {
    return S.data.categories.filter(function (c) { return budgetOf(S.month, c.id) || t.byCat[c.id]; });
  }
  var sortDesc = function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); };

  function rowMovement(m, actions) {
    var c = m.type === 'gasto' ? (cat(m.categoryId) || { name: 'Sin categoría', color: '#8f98ad' }) : { name: 'Ingreso', color: '#0f9d6b' };
    var icon = m.type === 'gasto' ? catIcon(c.name) : '💰';
    return '<li class="row"><span class="dot" style="background:' + esc(c.color) + '26" aria-hidden="true">' + icon + '</span>' +
      '<div class="main"><div class="title">' + esc(m.note || c.name) + '</div><div class="meta">' + esc(c.name) + ' · ' + esc(dayLabel(m.date)) + '</div></div>' +
      '<div class="amount ' + (m.type === 'ingreso' ? 'pos' : '') + '">' + (m.type === 'ingreso' ? '+' : '−') + money(m.amount) + '</div>' +
      (actions ? '<div class="actions"><button class="icon-btn mini" data-action="edit" data-id="' + esc(m.id) + '" aria-label="Editar">✎</button>' +
        '<button class="icon-btn mini" data-action="del" data-id="' + esc(m.id) + '" aria-label="Eliminar">🗑</button></div>' : '') + '</li>';
  }

  function viewMovimientos() {
    var list = inMonth(S.month).filter(function (m) {
      if (S.filter.type && m.type !== S.filter.type) return false;
      if (S.filter.cat && m.categoryId !== S.filter.cat) return false;
      return true;
    }).sort(sortDesc);
    var catOpts = '<option value="">Todas las categorías</option>' + S.data.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (S.filter.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var html = '<div class="section-head"><h2>Movimientos</h2><button class="btn primary small" data-action="add">+ Nuevo</button></div>' +
      '<div class="filters"><select data-filter="type" aria-label="Tipo"><option value="">Gastos e ingresos</option>' +
      '<option value="gasto"' + (S.filter.type === 'gasto' ? ' selected' : '') + '>Solo gastos</option>' +
      '<option value="ingreso"' + (S.filter.type === 'ingreso' ? ' selected' : '') + '>Solo ingresos</option></select>' +
      '<select data-filter="cat" aria-label="Categoría">' + catOpts + '</select></div>';
    if (!list.length) return html + '<div class="card empty">No hay movimientos con estos filtros en ' + esc(monthLabel(S.month)) + '.</div>';
    var sum = list.reduce(function (a, m) { return a + (m.type === 'ingreso' ? m.amount : -m.amount); }, 0);
    return html + '<div class="card"><ul class="list">' + list.map(function (m) { return rowMovement(m, true); }).join('') + '</ul></div>' +
      '<p class="muted small" style="text-align:right">' + list.length + ' movimientos · neto ' + money(sum) + '</p>';
  }

  /* ----- Presupuesto (módulo 4) ----- */
  function viewPresupuesto() {
    var t = totals(S.month), cats = activeCats();
    var html = '<div class="section-head"><h2>Presupuesto de ' + esc(monthLabel(S.month)) + '</h2>' +
      '<button class="btn small" data-action="copy-budget">Copiar del mes anterior</button></div>' +
      '<p class="muted small" style="margin-top:-.3rem">Define un límite por categoría. Verás una alerta al llegar al 80 % y otra al superar el 100 %.</p><div class="card">';
    if (!cats.length) return html + '<p class="muted">No hay categorías activas.</p></div>';
    html += cats.map(function (c) {
      var limit = budgetOf(S.month, c.id), spent = t.byCat[c.id] || 0, st = status(spent, limit);
      var pct = limit ? Math.min(100, spent / limit * 100) : 0;
      var msg = !limit ? 'Sin límite definido' : st === 'danger' ? 'Superado por ' + money(spent - limit) : st === 'warn' ? 'Cerca del límite (' + Math.round(spent / limit * 100) + ' %)' : 'Disponible: ' + money(limit - spent);
      return '<div class="budget-row"><div class="budget-head"><strong><span aria-hidden="true">' + catIcon(c.name) + '</span>' + esc(c.name) + ' <span class="pill ' + (limit ? (st === 'ok' ? '' : st) : 'none') + '">' + (limit ? Math.round(spent / limit * 100) + ' %' : '—') + '</span></strong>' +
        '<div class="budget-input"><label class="small" for="b-' + esc(c.id) + '">Límite</label><input id="b-' + esc(c.id) + '" type="number" min="0" step="1000" inputmode="numeric" data-budget="' + esc(c.id) + '" value="' + (limit || '') + '" placeholder="0"></div></div>' +
        '<div class="bar ' + (st === 'warn' ? 'warn' : st === 'danger' ? 'danger' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="Avance ' + esc(c.name) + '"><span style="width:' + pct + '%"></span></div>' +
        '<div class="meta small ' + (st === 'danger' ? 'neg' : st === 'warn' ? 'warn' : 'muted') + '">' + money(spent) + (limit ? ' de ' + money(limit) : '') + ' · ' + msg + '</div></div>';
    }).join('');
    return html + '</div>';
  }

  /* ----- Categorías ----- */
  function viewCategorias() {
    var html = '<div class="section-head"><h2>Categorías</h2><button class="btn primary small" data-action="cat-add">+ Nueva</button></div><div class="card"><ul class="list">';
    html += S.data.categories.map(function (c) {
      var used = S.data.movements.filter(function (m) { return m.categoryId === c.id; }).length;
      return '<li class="row"><span class="dot" style="background:' + esc(c.color) + '26' + (c.active ? '' : ';opacity:.45') + '" aria-hidden="true">' + catIcon(c.name) + '</span>' +
        '<div class="main"><div class="title"' + (c.active ? '' : ' style="opacity:.6"') + '>' + esc(c.name) + '</div><div class="meta">' + used + ' movimientos' + (c.active ? '' : ' · desactivada') + '</div></div>' +
        '<div class="actions"><button class="btn small" data-action="cat-edit" data-id="' + esc(c.id) + '">Editar</button>' +
        '<button class="btn small" data-action="cat-toggle" data-id="' + esc(c.id) + '">' + (c.active ? 'Desactivar' : 'Activar') + '</button></div></li>';
    }).join('');
    return html + '</ul></div><p class="muted small">Las categorías no se eliminan para conservar tu historial; puedes desactivarlas y dejarán de aparecer al registrar gastos.</p>';
  }

  var VIEWS = { panel: viewPanel, movimientos: viewMovimientos, presupuesto: viewPresupuesto, categorias: viewCategorias };

  function render(anim) {
    $('#month-label').textContent = monthLabel(S.month);
    $$('.nav-btn').forEach(function (b) {
      var on = b.dataset.view === S.view;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var v = $('#view');
    v.classList.toggle('anim', !!anim && !reduced);
    v.innerHTML = VIEWS[S.view]();
    if (anim) runCountUps(v);
  }

  /* ================= Datos de ejemplo ================= */
  function loadSample() {
    var seed = 7; var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var byName = {}; S.data.categories.forEach(function (c) { byName[c.name] = c.id; });
    var plan = [
      ['Alimentación', 'Mercado', 45000, 85000, 3], ['Alimentación', 'Almuerzo', 9000, 15000, 6], ['Transporte', 'Transporte', 3000, 12000, 8],
      ['Servicios', 'Servicio del hogar', 40000, 110000, 2], ['Ocio', 'Salida', 20000, 90000, 3], ['Salud', 'Droguería', 15000, 70000, 1],
      ['Educación', 'Material de estudio', 20000, 80000, 1], ['Vivienda', 'Arriendo', 600000, 600000, 1], ['Otros', 'Varios', 5000, 40000, 2]
    ];
    var today = new Date();
    [-1, 0].forEach(function (off) {
      var m = shiftMonth(ymd(today).slice(0, 7), off), p = m.split('-');
      var maxDay = off === 0 ? today.getDate() : new Date(+p[0], +p[1], 0).getDate();
      plan.forEach(function (row) {
        for (var i = 0; i < row[4]; i++) {
          var day = Math.max(1, Math.min(maxDay, 1 + Math.floor(rnd() * maxDay)));
          if (row[1] === 'Arriendo') day = 1;
          var amount = Math.round((row[2] + rnd() * (row[3] - row[2])) / 1000) * 1000;
          S.data.movements.push({ id: uid(), type: 'gasto', amount: amount, date: m + '-' + pad(day), categoryId: byName[row[0]], note: row[1] });
        }
      });
      S.data.movements.push({ id: uid(), type: 'ingreso', amount: 1800000, date: m + '-01', categoryId: null, note: 'Salario' });
      S.data.movements.push({ id: uid(), type: 'ingreso', amount: 150000, date: m + '-' + pad(Math.min(maxDay, 15)), categoryId: null, note: 'Ingreso extra' });
    });
    var cur = ymd(today).slice(0, 7), lim = { 'Alimentación': 330000, 'Transporte': 90000, 'Servicios': 250000, 'Ocio': 180000, 'Salud': 100000, 'Educación': 120000, 'Vivienda': 650000, 'Otros': 80000 };
    S.data.budgets[cur] = S.data.budgets[cur] || {};
    Object.keys(lim).forEach(function (n) { S.data.budgets[cur][byName[n]] = lim[n]; });
    save();
    S.month = cur;
    toast('Datos de ejemplo cargados.', 'ok');
    render(true);
  }

  /* ================= Eventos ================= */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-view],[data-action],[data-auth]');
    if (!el) return;
    if (el.dataset.auth) { switchAuth(el.dataset.auth); return; }
    if (el.dataset.view) { S.view = el.dataset.view; render(true); $('#view').focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    var id = el.dataset.id, a = el.dataset.action;
    if (a === 'add') movementForm();
    else if (a === 'edit') movementForm(S.data.movements.filter(function (x) { return x.id === id; })[0]);
    else if (a === 'del') deleteMovement(id);
    else if (a === 'sample') loadSample();
    else if (a === 'cat-add') categoryForm();
    else if (a === 'cat-edit') categoryForm(cat(id));
    else if (a === 'cat-toggle') {
      var c = cat(id);
      if (c.active && activeCats().length === 1) { toast('Debe quedar al menos una categoría activa.', 'warn'); return; }
      c.active = !c.active; save(); render();
    } else if (a === 'copy-budget') {
      var prev = S.data.budgets[shiftMonth(S.month, -1)];
      if (!prev || !Object.keys(prev).length) { toast('El mes anterior no tiene presupuesto definido.', 'warn'); return; }
      S.data.budgets[S.month] = JSON.parse(JSON.stringify(prev)); save(); toast('Presupuesto copiado.', 'ok'); render();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.filter) { S.filter[t.dataset.filter] = t.value; render(); return; }
    if (t.dataset.budget) {
      var v = Math.max(0, Math.round(Number(t.value) || 0));
      S.data.budgets[S.month] = S.data.budgets[S.month] || {};
      if (v) S.data.budgets[S.month][t.dataset.budget] = v; else delete S.data.budgets[S.month][t.dataset.budget];
      save(); render();
      var next = $('[data-budget="' + (window.CSS && CSS.escape ? CSS.escape(t.dataset.budget) : t.dataset.budget) + '"]');
      if (next) next.focus();
    }
  });
  $('#month-prev').addEventListener('click', function () { S.month = shiftMonth(S.month, -1); render(true); });
  $('#month-next').addEventListener('click', function () { S.month = shiftMonth(S.month, 1); render(true); });
  $('#fab-add').addEventListener('click', function () { movementForm(); });
  $('#btn-logout').addEventListener('click', logout);

  /* ================= Autenticación (interfaz) ================= */
  function switchAuth(which) {
    $('#form-login').hidden = which !== 'login';
    $('#form-register').hidden = which !== 'register';
    $$('.tab').forEach(function (t) {
      var on = t.dataset.auth === which;
      t.classList.toggle('active', on); t.setAttribute('aria-selected', on);
    });
    $$('[data-error]').forEach(function (p) { p.textContent = ''; });
  }
  function bindAuth(formId, fn) {
    $(formId).addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = $('[data-error]', f), btn = $('button[type=submit]', f);
      err.textContent = ''; btn.disabled = true;
      fn(f).then(startSession).catch(function (m) {
        err.textContent = typeof m === 'string' ? m : 'Ocurrió un error. Inténtalo de nuevo.';
      }).then(function () { btn.disabled = false; });
    });
  }
  bindAuth('#form-login', function (f) { return login(f.email.value, f.password.value); });
  bindAuth('#form-register', function (f) { return register(f.name.value, f.email.value, f.password.value); });

  function showAuth() {
    $('#app').hidden = true; $('#auth').hidden = false;
    $('#form-login').reset(); $('#form-register').reset(); switchAuth('login');
  }
  function showApp() {
    $('#auth').hidden = true; $('#app').hidden = false;
    $('#user-name').textContent = S.user.name;
    $('#user-avatar').textContent = String(S.user.name || '?').trim().charAt(0).toUpperCase();
    render(true);
  }

  /* ================= Inicio ================= */
  var sid = read(KEY.session, null);
  var sessionUser = sid && read(KEY.users, []).filter(function (u) { return u.id === sid; })[0];
  if (sessionUser) startSession(sessionUser); else showAuth();
})();
