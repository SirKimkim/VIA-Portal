/**
 * Viraj Form Tutor Portal — Google Apps Script backend (for GitHub Pages hosting).
 * Same login / admin / form-tutor features as the Netlify server.
 * Setup: see SETUP.md in this folder. Data is stored in a private Drive file "viraj-portal-db.json".
 * Optional Script Properties: ADMIN_EMAIL (comma separated), ACCESS_CODE (default Viraj@2026).
 */
var DEFAULT_CODE = 'Viraj@2026';

function doGet() {
  var admins = adminsFrom(openDb());
  return out({ service: 'Viraj Form Tutor Portal (Google backend)', functionRunning: true, storage: 'ok', adminConfigured: admins.length > 0 });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var db = openDb();
    var res;
    try { res = handle(b || {}, db); }
    catch (x) { res = (x && x.fail) ? { error: x.fail } : { error: 'Server error: ' + (x && x.message ? x.message : x) }; }
    db.flush();
    return out(res);
  } catch (err) {
    return out({ error: 'Server error: ' + (err && err.message ? err.message : err) });
  } finally { lock.releaseLock(); }
}

// ───────── helpers ─────────
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail(m) { throw { fail: m }; }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function hex(bytes) { return bytes.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join(''); }
function sha(t) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8)); }
function hashPw(pw, salt) { var h = sha(salt + pw); for (var i = 0; i < 400; i++) h = sha(h + salt + pw); return h; }
function eq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function rnd() { return Utilities.getUuid().replace(/-/g, ''); }
function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function okEmail(e) { return e.length < 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && /^(gmail\.com|yahoo\.com|.*viraj.*)$/.test(e.split('@')[1]); }
function strong(p) { return p.length >= 8 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p); }
var WEAK = 'Password must be 8+ characters with letters and numbers.';
function cleanDob(v) { v = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
function cleanStudent(s, id) { return { id: id || ('s' + rnd().slice(0, 12)), name: clip(s.name, 80), adm: clip(s.adm, 30), dob: cleanDob(s.dob), cls: clip(s.cls, 40), guardian: clip(s.guardian, 80), phone: clip(s.phone, 30), email: clip(s.email, 120) }; }

function openDb() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('DB_FILE'), file;
  if (id) file = DriveApp.getFileById(id);
  else { file = DriveApp.createFile('viraj-portal-db.json', '{}', 'application/json'); props.setProperty('DB_FILE', file.getId()); }
  var data = JSON.parse(file.getBlob().getDataAsString() || '{}'), dirty = false;
  return {
    get: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    set: function (k, v) { data[k] = v; dirty = true; },
    del: function (k) { delete data[k]; dirty = true; },
    keys: function (prefix) { return Object.keys(data).filter(function (k) { return k.indexOf(prefix) === 0; }); },
    flush: function () { if (dirty) { file.setContent(JSON.stringify(data)); dirty = false; } }
  };
}
function envAdmins() { return prop('ADMIN_EMAIL').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); }
function adminsFrom(db) { var e = envAdmins(); if (e.length) return e; var c = db.get('cfg'); return (c && c.admins) || []; }

function loadSchool(db) {
  var s = db.get('school');
  if (!s) { s = { classes: [], students: [], messages: [], rev: 1 }; db.set('school', s); }
  return s;
}
function saveSchool(db, s) { s.rev = (s.rev || 0) + 1; s.updated = Date.now(); db.set('school', s); }

// ───────── request handler ─────────
function handle(b, db) {
  var cfg = db.get('cfg');
  if (!cfg) { cfg = { secret: rnd() + rnd() + rnd(), admins: [] }; db.set('cfg', cfg); }
  var isAdm = function (e) { return adminsFrom(db).indexOf(String(e || '').toLowerCase()) >= 0; };
  var roleOf = function (e) { return isAdm(e) ? 'admin' : 'tutor'; };
  var sign = function (e, v) {
    var p = Utilities.base64EncodeWebSafe(JSON.stringify({ e: e, v: v, exp: Date.now() + 7 * 864e5 }));
    return p + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, cfg.secret));
  };
  var verify = function (t) {
    try {
      var parts = String(t).split('.'), p = parts[0], s = parts[1];
      if (!p || !s || !eq(s, Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, cfg.secret)))) return null;
      var o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p)).getDataAsString());
      return o.exp > Date.now() ? o : null;
    } catch (x) { return null; }
  };
  var ukey = function (e) { return 'u:' + e; };
  var setPw = function (e, pw) {
    var old = db.get(ukey(e)) || {}, salt = rnd(), v = (old.v || 0) + 1;
    db.set(ukey(e), { email: e, salt: salt, hash: hashPw(pw, salt), v: v, created: old.created || new Date().toISOString() });
    return v;
  };
  var email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  var ok = function (e, v) { return { token: sign(e, v), email: e, role: roleOf(e) }; };
  var lk = 'f:' + sha(email);
  var locked = function () { var f = db.get(lk); return f && f.until > Date.now(); };
  var strike = function () { var f = db.get(lk) || { n: 0 }; f.n = (f.n || 0) + 1; if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; } db.set(lk, f); };

  switch (b.a) {
    case 'register': {
      if (!okEmail(email)) fail('Use your Viraj school email, Gmail or Yahoo address.');
      if (locked()) fail('Too many attempts. Try again in 1 minute.');
      var codes = db.get('valid_codes') || [], code = String(b.code || '');
      if (codes.indexOf(code) < 0 && code !== (prop('ACCESS_CODE') || DEFAULT_CODE)) { strike(); fail('Invalid school access code.'); }
      if (!strong(pw)) fail(WEAK);
      if (db.get(ukey(email))) fail('This email is already registered — please sign in.');
      if (codes.indexOf(code) >= 0) db.set('valid_codes', codes.filter(function (c) { return c !== code; }));
      if (!adminsFrom(db).length) { cfg.admins = [email]; db.set('cfg', cfg); }   // first account becomes the administrator
      return ok(email, setPw(email, pw));
    }
    case 'login': {
      if (locked()) fail('Too many attempts. Try again in 1 minute.');
      var u2 = db.get(ukey(email));
      if (!u2 || !eq(hashPw(pw, u2.salt), u2.hash)) { strike(); fail('Incorrect email or password.'); }
      db.del(lk);
      return ok(email, u2.v || 1);
    }
    case 'forgot': fail('Password recovery email is not available on this server. Please ask the administrator to reset your password.');
    case 'reset': fail('Password recovery email is not available on this server. Please ask the administrator to reset your password.');
  }

  var t = verify(b.token), u = t && db.get(ukey(t.e));
  if (!u || (u.v || 1) !== t.v) fail('Session expired — please sign in again.');
  var me = t.e, admin = isAdm(me), act = String(b.a || '');
  if (act.indexOf('admin_') === 0 && !admin) fail('Unauthorized: administrator access required.');

  switch (act) {
    case 'me': return ok(me, u.v || 1);
    case 'load': return { data: db.get('d:' + me) };
    case 'save': {
      var d = b.data;
      if (!d || typeof d !== 'object' || !Array.isArray(d.students) || !Array.isArray(d.behavior) || typeof d.attendance !== 'object' || (d.events && !Array.isArray(d.events))) fail('Invalid data');
      if (d.students.length > 600) fail('Too many students.');
      var q = d.profile || {}, ph = String(q.photo || '');
      var profile = { name: String(q.name || '').slice(0, 80), subject: String(q.subject || '').slice(0, 60), cls: String(q.cls || '').slice(0, 40), emoji: String(q.emoji || '').slice(0, 8), photo: (/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(ph) && ph.length < 80000) ? ph : '' };
      var clean = { students: d.students, attendance: d.attendance, behavior: d.behavior, events: d.events || [], clubs: Array.isArray(d.clubs) ? d.clubs : [], seen: Number(d.seen) || 0, profile: profile };
      if (JSON.stringify(clean).length > 900000) fail('Data too large.');
      db.set('d:' + me, clean);
      return { ok: true };
    }
    case 'changepw': { if (!strong(pw)) fail(WEAK); return ok(me, setPw(me, pw)); }
    case 'sync': {
      var s = loadSchool(db), cls = clip(b.cls, 40), valid = !!cls && s.classes.indexOf(cls) >= 0;
      var classes = s.classes.slice().sort(function (x, y) { return x.localeCompare(y, undefined, { numeric: true }); });
      var students = valid ? s.students.filter(function (x) { return x.cls === cls; }) : [];
      var messages = s.messages.filter(function (m) { return m.target === 'all' || (valid && m.target === cls); }).sort(function (x, y) { return y.at - x.at; }).slice(0, 50);
      return { rev: s.rev || 0, classes: classes, cls: valid ? cls : '', students: students, messages: messages };
    }
    case 'admin_load': return { data: loadSchool(db) };
    case 'admin_add_class': {
      var name = clip(b.name, 40); if (!name) fail('Enter a class name.');
      var s1 = loadSchool(db);
      if (s1.classes.some(function (c) { return c.toLowerCase() === name.toLowerCase(); })) fail('That class already exists.');
      s1.classes.push(name); saveSchool(db, s1); return { data: s1 };
    }
    case 'admin_del_class': {
      var nm = clip(b.name, 40), s2 = loadSchool(db);
      s2.classes = s2.classes.filter(function (c) { return c !== nm; });
      s2.students.forEach(function (x) { if (x.cls === nm) x.cls = ''; });
      s2.messages = s2.messages.filter(function (m) { return m.target !== nm; });
      saveSchool(db, s2); return { data: s2 };
    }
    case 'admin_add_students': {
      var list = Array.isArray(b.students) ? b.students : [];
      if (!list.length) fail('No learners to add.');
      if (list.length > 2000) fail('Import at most 2000 learners at a time.');
      var s3 = loadSchool(db), added = 0, updated = 0, skipped = 0;
      list.forEach(function (raw) {
        var n = cleanStudent(raw || {});
        if (!n.name) { skipped++; return; }
        if (n.cls && s3.classes.indexOf(n.cls) < 0) s3.classes.push(n.cls);
        var hit = null;
        for (var i = 0; i < s3.students.length; i++) { var x = s3.students[i]; if (n.adm ? x.adm === n.adm : (x.name.toLowerCase() === n.name.toLowerCase() && x.cls === n.cls)) { hit = x; break; } }
        if (hit) { ['name', 'dob', 'cls', 'guardian', 'phone', 'email'].forEach(function (k) { if (n[k]) hit[k] = n[k]; }); updated++; }
        else { s3.students.push(n); added++; }
      });
      if (s3.students.length > 3000) fail('Student database is full (3000).');
      saveSchool(db, s3); return { data: s3, added: added, updated: updated, skipped: skipped };
    }
    case 'admin_update_student': {
      var s4 = loadSchool(db), st = null;
      for (var j = 0; j < s4.students.length; j++) if (s4.students[j].id === String(b.id)) st = s4.students[j];
      if (!st) fail('Student not found.');
      var f = b.fields || {}, base = {}; for (var k in st) base[k] = st[k]; for (var k2 in f) base[k2] = f[k2];
      var n2 = cleanStudent(base, st.id);
      if (!n2.name) fail('Name cannot be empty.');
      if (n2.cls && s4.classes.indexOf(n2.cls) < 0) s4.classes.push(n2.cls);
      for (var k3 in n2) st[k3] = n2[k3];
      saveSchool(db, s4); return { data: s4 };
    }
    case 'admin_del_student': {
      var s5 = loadSchool(db), ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map(String);
      s5.students = s5.students.filter(function (x) { return ids.indexOf(x.id) < 0; });
      saveSchool(db, s5); return { data: s5 };
    }
    case 'admin_post_message': {
      var text = clip(b.text, 2000), title = clip(b.title, 80) || 'Announcement';
      if (!text) fail('Write a message first.');
      var s6 = loadSchool(db), target = (b.target === 'all' || !b.target) ? 'all' : clip(b.target, 40);
      if (target !== 'all' && s6.classes.indexOf(target) < 0) fail('Unknown class.');
      s6.messages.unshift({ id: 's' + rnd().slice(0, 12), title: title, text: text, target: target, at: Date.now(), by: me });
      s6.messages = s6.messages.slice(0, 200);
      saveSchool(db, s6); return { data: s6 };
    }
    case 'admin_del_message': {
      var s7 = loadSchool(db); s7.messages = s7.messages.filter(function (m) { return m.id !== String(b.id); });
      saveSchool(db, s7); return { data: s7 };
    }
    case 'admin_list_users': {
      var users = db.keys('u:').map(function (k) {
        var em = k.slice(2), d2 = db.get('d:' + em);
        return { email: em, role: roleOf(em), name: d2 && d2.profile ? d2.profile.name : '', cls: d2 && d2.profile ? d2.profile.cls : '' };
      });
      return { users: users };
    }
    case 'admin_reset_pw': {
      var target2 = String(b.email || '').trim().toLowerCase();
      if (!target2) fail('Target email required');
      if (!db.get(ukey(target2))) fail('No account with that email.');
      var np = String(b.password || ''); if (!strong(np)) fail(WEAK);
      setPw(target2, np); return { ok: true };
    }
    case 'admin_generate_code': {
      var code2 = rnd().slice(0, 10).toUpperCase(), cs = db.get('valid_codes') || [];
      cs.push(code2); db.set('valid_codes', cs); return { code: code2 };
    }
  }
  fail('Unknown action');
}
