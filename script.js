'use strict';
const GH = 'codedbyjayr';
const FORMSPREE_ID = 'YOUR_FORMSPREE_ID'; // https://formspree.io -> paste the ID after /f/
const API = 'https://api.github.com';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const safeUrl = u => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : null;
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; for (const [n, u] of [[86400, 'd'], [3600, 'h'], [60, 'm']]) if (s >= n) return `${Math.floor(s / n)}${u} ago`; return 'just now'; };

// Fetch with 10-minute sessionStorage cache (GitHub's unauthenticated limit is 60 requests/hour)
async function getJSON(url) {
  const key = 'gh:' + url;
  try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < 6e5) return c.d; } catch (e) { }
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) { }
  return d;
}

function setStat(id, bar, value, max) {
  $(id).textContent = value;
  $(bar).style.width = Math.max(4, Math.min(100, (value / max) * 100)) + '%';
}

function renderRepos(repos) {
  const list = $('repo-list');
  const own = repos.filter(r => !r.fork && r.name !== 'myimcc-portal').sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 6);
  if (!own.length) return;
  list.replaceChildren(...own.map(r => {
    const card = el('article', 'card repo');
    const h = el('h3'); const a = el('a', null, r.name); a.href = safeUrl(r.html_url) || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; h.append(a);
    const meta = el('p', 'meta', [r.language, `${r.stargazers_count} stars`, `pushed ${ago(r.pushed_at)}`].filter(Boolean).join(' | '));
    const links = el('div', 'links');
    const home = safeUrl(r.homepage);
    if (home) { const d = el('a', 'btn sm', 'EXECUTE_DEMO'); d.href = home; d.target = '_blank'; d.rel = 'noopener noreferrer'; links.append(d); }
    const c = el('a', 'btn sm alt', 'INSPECT_CODE'); c.href = safeUrl(r.html_url) || '#'; c.target = '_blank'; c.rel = 'noopener noreferrer'; links.append(c);
    card.append(h, el('p', null, r.description || 'No description yet.'), meta, links);
    return card;
  }));
}

function renderHeat(days) {
  const heat = $('heat');
  const first = new Date(days[0].date + 'T00:00:00').getDay(); // pad so rows line up with weekdays
  const frag = document.createDocumentFragment();
  for (let i = 0; i < first; i++) frag.append(el('i'));
  days.forEach(d => { const c = el('i'); c.dataset.l = d.level; c.title = `${d.count} on ${d.date}`; frag.append(c); });
  heat.replaceChildren(frag);
  heat.scrollLeft = heat.scrollWidth;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].count > 0) streak++; else if (i === days.length - 1) continue; else break; }
  $('streak').textContent = `Contribution activity | ${streak} day streak`;
}

function eventText(e) {
  const repo = (e.repo && e.repo.name || '').replace(GH + '/', '');
  const p = e.payload || {};
  switch (e.type) {
    case 'PushEvent': { const m = p.commits && p.commits.length ? p.commits[p.commits.length - 1].message.split('\n')[0] : 'pushed'; return `PUSH ${repo}: ${m}`; }
    case 'CreateEvent': return `CREATE ${p.ref_type} ${p.ref || repo}`;
    case 'WatchEvent': return `STAR ${repo}`;
    case 'IssuesEvent': return `ISSUE ${p.action} in ${repo}`;
    case 'PullRequestEvent': return `PR ${p.action} in ${repo}`;
    case 'ForkEvent': return `FORK ${repo}`;
    default: return `${e.type.replace('Event', '').toUpperCase()} ${repo}`;
  }
}

function renderEvents(events) {
  const box = $('events');
  if (!events.length) { box.replaceChildren(el('p', 'dim', '> no recent public events')); return; }
  box.replaceChildren(...events.slice(0, 10).map(e => {
    const p = el('p'); p.append(el('span', 't', `[${ago(e.created_at)}] `), el('b', 'g', 'INFO: '), document.createTextNode(eventText(e))); return p;
  }));
}

async function loadGitHub() {
  const sync = $('sync');
  const jobs = await Promise.allSettled([
    getJSON(`${API}/users/${GH}`),
    getJSON(`${API}/users/${GH}/repos?per_page=100&sort=pushed`),
    getJSON(`${API}/users/${GH}/events/public?per_page=10`),
    getJSON(`https://github-contributions-api.jogruber.de/v4/${GH}?y=last`)
  ]);
  const [user, repos, events, contrib] = jobs.map(j => j.status === 'fulfilled' ? j.value : null);

  if (user) { setStat('st-repos', 'b-repos', user.public_repos, 50); setStat('st-fol', 'b-fol', user.followers, 50); }
  if (repos) { setStat('st-stars', 'b-stars', repos.reduce((n, r) => n + r.stargazers_count, 0), 50); renderRepos(repos); renderLangs(repos); updatePin(repos); }
  if (contrib && contrib.contributions) {
    const total = contrib.total ? Object.values(contrib.total)[0] : contrib.contributions.reduce((n, d) => n + d.count, 0);
    setStat('st-contrib', 'b-contrib', total, 500);
    renderHeat(contrib.contributions);
  }
  if (!repos) $('repo-list').replaceChildren(el('p', 'dim', '> OFFLINE: could not load repos from GitHub.'));
  if (events) renderEvents(events);
  else $('events').replaceChildren(el('p', 'dim', '> OFFLINE: GitHub API unreachable or rate-limited. Retry in a few minutes.'));

  const ok = jobs.filter(j => j.status === 'fulfilled').length;
  sync.textContent = ok === jobs.length ? 'ONLINE' : ok ? `PARTIAL ${ok}/${jobs.length}` : 'OFFLINE';
  if (!ok) sync.closest('.status').classList.add('off');
}

// Credential vault: data-driven cards, category filter, modal viewer with prev/next
// Add a certificate: drop <name>.jpg and <name>-thumb.jpg in /assets/certs/ and add a line below.
// Add verify:'https://...' only when the issuer gives you a real online verification link.
const SCAN = 'HARD_COPY_SCAN';
const CERTS = [
  { title: "Dean's List, 1st Sem A.Y. 2025-2026 (GPA 1.33)", issuer: 'Iligan Medical Center College', date: '2026-05-06', cat: 'school', type: 'DEAN_LIST', img: 'deans-list-2025-2026', status: SCAN },
  { title: 'Recognition: Outstanding Scholastic Performance (GWA 1.33)', issuer: 'IMCC College of Computer Studies', date: '2026-04-17', cat: 'school', type: 'DEPT_AWARD', img: 'ccs-scholastic-recognition-2026', status: SCAN },
  { title: 'Best in Computer Programming, A.Y. 2023-2024', issuer: 'IMCC College of Computer Studies', date: '2024-05-29', cat: 'school', type: 'DEPT_AWARD', img: 'best-in-computer-programming-2024', status: SCAN },
  { title: "Dean's Lister, A.Y. 2023-2024", issuer: 'IMCC College of Computer Studies', date: '2024-05-29', cat: 'school', type: 'DEAN_LIST', img: 'deans-lister-2024', status: SCAN },
  { title: 'Navigating the AI Frontier', issuer: 'IMCC Center for Research & Development', date: '2026-01-30', cat: 'ai', type: 'SEMINAR', img: 'navigating-ai-frontier-2026', status: SCAN },
  { title: 'AI for Education: Unlocking NotebookLM (4 hrs)', issuer: 'DICT Regional Office IX', date: '2026-01-30', cat: 'ai', type: 'TRAINING', img: 'ai-education-notebooklm-2026', status: SCAN },
  { title: 'Resource Speaker: Hour of AI', issuer: 'DepEd Iligan | DJALMCS', date: '2025-12-05', cat: 'ai', type: 'SPEAKER', img: 'hour-of-ai-speaker-2025', status: SCAN },
  { title: 'Hack4Gov 2025 Regional CTF', issuer: 'DICT Region X', date: '2025-11-10', cat: 'cybersec', type: 'CTF', img: 'hack4gov-ctf-2025', status: SCAN },
  { title: 'Iligan Campus DEVCON 2025: Campus Code Collab', issuer: 'DEVCON Iligan', date: '2025-10-28', cat: 'dev', type: 'VOLUNTEER', img: 'devcon-campus-code-collab-2025', status: SCAN },
  { title: 'HackQuest Iligan 2025: Capture the Flag', issuer: 'City Government of Iligan', date: '2025-10-24', cat: 'cybersec', type: 'CTF', img: 'hackquest-iligan-ctf-2025', status: SCAN },
  { title: 'Pocket Films Forum: Mobile Films in Focus', issuer: 'Digital Creatives Hub Iligan', date: '2025-08-01', cat: 'creative', type: 'FORUM', img: 'pocket-films-forum-2025', status: SCAN },
  { title: 'Google I/O Extended 2025', issuer: 'GDG Cagayan de Oro', date: '2025-07-26', cat: 'dev', type: 'EVENT', img: 'google-io-extended-2025', status: SCAN },
  { title: 'Photography & Mobile Videography Forum', issuer: 'Digital Creatives Hub Iligan', date: '2025-06-28', cat: 'creative', type: 'FORUM', img: 'photo-videography-forum-2025', status: SCAN },
  { title: 'Network Defense', issuer: 'Cisco Networking Academy | DICT-ITU', date: '2025-06-30', cat: 'cybersec', type: 'COURSE', img: 'network-defense-2025', status: SCAN },
  { title: 'AI Fundamentals with IBM SkillsBuild', issuer: 'Cisco Networking Academy | DICT-ITU', date: '2025-06-30', cat: 'ai', type: 'COURSE', img: 'ai-fundamentals-ibm-2025', status: SCAN },
  { title: 'Cyber Threat Management', issuer: 'Cisco Networking Academy | DICT-ITU', date: '2025-06-27', cat: 'cybersec', type: 'COURSE', img: 'cyber-threat-management-2025', status: SCAN },
  { title: 'Introduction to Information Security (20 hrs)', issuer: 'DICT Region 10', date: '2025-06-20', cat: 'cybersec', type: 'TRAINING', img: 'intro-info-security-2025', status: SCAN },
  { title: 'Python Essentials 1', issuer: 'Cisco Networking Academy | Python Institute', date: '2024-12-09', cat: 'dev', type: 'COURSE', img: 'python-essentials-1-2024', status: SCAN }
];
const FILTERS = [['all', 'ALL'], ['school', 'ACADEMIC'], ['cybersec', 'CYBERSEC'], ['ai', 'AI'], ['dev', 'DEV'], ['creative', 'CREATIVE']];
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

function initVault() {
  const grid = $('certs'), tools = $('vault-tools'), count = $('vault-count');
  const m = $('modal'), img = $('m-i'), err = $('m-e'), cap = $('m-cap');
  const all = [...CERTS].sort((a, b) => b.date.localeCompare(a.date));
  let view = all, idx = 0, opener = null;

  function show(i) {
    idx = (i + view.length) % view.length; const c = view[idx];
    err.hidden = true; img.hidden = false; img.src = `./assets/certs/${c.img}.jpg`; img.alt = `Scanned certificate: ${c.title}`;
    $('m-t').textContent = `PROOF ${idx + 1}/${view.length}`;
    cap.textContent = `${c.title} | ${c.issuer} | ${fmtDate(c.date)} | ${c.status}`;
  }

  function render() {
    grid.replaceChildren(...view.map((c, i) => {
      const art = el('article', 'cert'); art.dataset.cat = c.cat;
      const b = el('button', 'cert-thumb'); b.type = 'button'; b.setAttribute('aria-label', `View certificate: ${c.title}`);
      const im = el('img'); im.src = `./assets/certs/${c.img}-thumb.jpg`; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.width = 520; im.height = 390; b.append(im);
      b.addEventListener('click', () => { opener = b; show(i); m.showModal(); });
      const info = el('div', 'cert-info');
      info.append(el('span', 'ctag', c.type), el('h3', null, c.title), el('p', 'cmeta', `${c.issuer} | ${fmtDate(c.date)}`), el('p', 'stat2', c.status));
      const v = safeUrl(c.verify);
      if (v) { const a = el('a', 'btn sm', 'VERIFY_ONLINE'); a.href = v; a.target = '_blank'; a.rel = 'noopener noreferrer'; info.append(a); }
      art.append(b, info); return art;
    }));
    count.textContent = `> SHOWING ${view.length}/${all.length} RECORDS`;
  }

  tools.replaceChildren(...FILTERS.map(([k, label]) => {
    const n = k === 'all' ? all.length : all.filter(c => c.cat === k).length;
    const b = el('button', 'chip-btn', `${label} (${n})`); b.type = 'button'; b.setAttribute('aria-pressed', String(k === 'all'));
    b.addEventListener('click', () => {
      tools.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
      view = k === 'all' ? all : all.filter(c => c.cat === k); render();
    });
    return b;
  }));

  img.addEventListener('error', () => { img.hidden = true; err.hidden = false; err.textContent = `> ERROR: scan file not found: ${img.getAttribute('src')}`; });
  $('m-x').addEventListener('click', () => m.close());
  $('m-prev').addEventListener('click', () => show(idx - 1));
  $('m-next').addEventListener('click', () => show(idx + 1));
  m.addEventListener('click', e => { if (e.target === m) m.close(); });
  m.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1); });
  m.addEventListener('close', () => { img.removeAttribute('src'); if (opener) opener.focus(); });
  // Lets other sections (the experience log) open a scan by its file key
  window.openCert = key => {
    view = all; tools.querySelectorAll('button').forEach((x, n) => x.setAttribute('aria-pressed', String(n === 0))); render();
    const i = view.findIndex(c => c.img === key); if (i < 0) return;
    opener = document.activeElement; show(i); m.showModal();
  };
  render();
}

// Experience log: school achievements, volunteering, competitions, work
// HOW TO EDIT: copy a line and change it.
//   cat   : school | volunteer | competition | work
//   cert  : file key of a scan in the vault (adds a VIEW_SCAN button). Leave '' for none.
//   links : paste any post/profile URLs (https only). Buttons are labelled automatically,
//           e.g. Facebook -> VIEW_ON_FACEBOOK, LinkedIn -> VIEW_ON_LINKEDIN, GitHub -> VIEW_ON_GITHUB.
//           Example: links: ['https://www.facebook.com/your-post-url', 'https://www.linkedin.com/posts/...']
//   draft : true hides an entry from the page. Delete the draft flag when it is ready.
// Tip: set the Facebook post audience to Public, or visitors will hit a login wall.
const XP = [
  { date: '2026-05-06', cat: 'school', title: "Dean's List, 1st Sem A.Y. 2025-2026", org: 'Iligan Medical Center College', desc: "Included in the BSIT Dean's List with a GPA of 1.33, recognized at the 50th IMCC Recognition Day.", cert: 'deans-list-2025-2026', links: [] },
  { date: '2026-04-17', cat: 'school', title: 'College of Computer Studies Recognition', org: 'IMCC College of Computer Studies', desc: 'Recognized by the department for outstanding scholastic performance with a general weighted average of 1.33 in the 1st Semester, A.Y. 2025-2026.', cert: 'ccs-scholastic-recognition-2026', links: [] },
  { date: '2025-12-05', cat: 'volunteer', title: 'Resource Speaker: Hour of AI', org: 'Doña Juana Actub Lluch Memorial Central School', desc: 'Shared AI knowledge as a resource speaker for the Hour of AI at DJALMCS, Iligan City.', cert: 'hour-of-ai-speaker-2025', links: [] },
  { date: '2025-11-10', cat: 'competition', title: 'Hack4Gov 2025 Regional CTF', org: 'DICT Region X', desc: 'Competed in the Regional Hack4Gov Capture-The-Flag competition on the theme Cyber Guardians. And placed 4th place out of 12 teams', cert: 'hack4gov-ctf-2025', links: ['https://www.facebook.com/share/p/19YrDGmABX/'] },
  { date: '2025-10-28', cat: 'volunteer', title: 'Volunteer, Iligan Campus DEVCON 2025', org: 'DEVCON Iligan', desc: 'Volunteered at Campus Code Collab 2025: Empowering Student Innovators, held at MSU-IIT. Received a Certificate of Appreciation. And the Team Lead of Technical Team', cert: 'devcon-campus-code-collab-2025', links: ['https://www.facebook.com/share/p/1MHA66H51T/'] },
  { date: '2025-10-24', cat: 'competition', title: 'HackQuest Iligan 2025 CTF', org: 'City Government of Iligan | DEVCON Iligan', desc: 'Took part in the Capture the Flag challenge for National Cybersecurity Awareness Month. Placed 3rd', cert: 'hackquest-iligan-ctf-2025', links: ['https://www.facebook.com/share/p/19Z7ybJn2C/'] },
  { date: '2025-09-01', cat: 'school', title: 'Capstone 1: myimcc-portal', org: 'Iligan Medical Center College', desc: 'Building an AI-integrated portal that modernizes scheduling, grading and data analysis for students, faculty and admins.', cert: '', links: ['https://github.com/codedbyjayr/myimcc-portal', 'https://myimcc-portal.vercel.app/'] },
  { date: '2024-05-29', cat: 'school', title: 'Best in Computer Programming', org: 'IMCC College of Computer Studies', desc: 'Awarded Best in Computer Programming for Academic Year 2023-2024.', cert: 'best-in-computer-programming-2024', links: [] },
  { date: '2024-05-29', cat: 'school', title: "Dean's Lister, A.Y. 2023-2024", org: 'IMCC College of Computer Studies', desc: "Named a Dean's Lister of the College of Computer Studies for Academic Year 2023-2024.", cert: 'deans-lister-2024', links: [] },
  { date: '2023-05-24', cat: 'work', title: 'On-the-Job Training', org: 'JCreations Digiprints', desc: 'Completed my OJT at JCreations Digiprints.', cert: '', links: [] },
  { date: '2023-06-08', cat: 'school', title: 'Enrolled in BSIT', org: 'Iligan Medical Center College', desc: 'Started my Bachelor of Science in Information Technology.', cert: '', links: [] },

  // ---- VOLUNTEER & SCHOOL EXPERIENCE DRAFTS: edit these, then delete `draft: true` to show them ----
  { draft: true, date: '2025-08-01' /* TODO: set the real date */, cat: 'school', title: 'CCS Student Body Council President', org: 'College of Computer Studies', cert: '', desc: 'Through the CCS orientation, I was elected to be the President', links: ['https://www.facebook.com/share/p/1EsMP27ZXZ/'] },
  { draft: true, date: '2025-08-02' /* TODO: set the real date */, cat: 'school', title: 'CCS Student Body Council, 4th Year Representative', org: 'College of Computer Studies', cert: '', desc: 'Representing the 4th year students of the College of Computer Studies to the Student Body Council.', links: ['https://www.facebook.com/share/p/1M5JqR7G36/'] },
  { draft: true, date: '2025-02-20', cat: 'volunteer', title: 'Volunteer Role Title', org: 'Organization or Event Name', desc: 'One or two sentences about what you did and what it was for.', cert: '', links: [] }
];
const XP_FILTERS = [['all', 'ALL'], ['school', 'SCHOOL'], ['volunteer', 'VOLUNTEER'], ['competition', 'COMPETITIONS'], ['work', 'WORK']];

function initXP() {
  const list = $('xps'), tools = $('xp-tools'), count = $('xp-count');
  if (!list) return;
  const all = [...XP].filter(x => !x.draft).sort((a, b) => b.date.localeCompare(a.date));
  let view = all;
  const HOSTS = [[/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/, 'VIEW_ON_FACEBOOK'], [/(^|\.)linkedin\.com$/, 'VIEW_ON_LINKEDIN'], [/(^|\.)github\.com$/, 'VIEW_ON_GITHUB'], [/(^|\.)instagram\.com$/, 'VIEW_ON_INSTAGRAM'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'WATCH_ON_YOUTUBE'], [/(^|\.)vercel\.app$/, 'OPEN_DEMO']];
  const linkLabel = u => { try { const h = new URL(u).hostname; const m = HOSTS.find(([re]) => re.test(h)); return m ? m[1] : 'VIEW_LINK'; } catch (e) { return 'VIEW_LINK'; } };
  function render() {
    list.replaceChildren(...view.map(x => {
      const li = el('li', 'xp'); li.dataset.cat = x.cat;
      const top = el('div', 'xp-top');
      top.append(el('span', 'ctag', x.cat.toUpperCase()), el('span', null, new Date(x.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })));
      li.append(top, el('h3', null, x.title), el('p', 'xp-org', x.org), el('p', 'xp-desc', x.desc));
      const row = el('div', 'xp-links');
      if (x.cert) { const b = el('button', 'btn sm alt', 'VIEW_SCAN'); b.type = 'button'; b.addEventListener('click', () => window.openCert && window.openCert(x.cert)); row.append(b); }
      [].concat(x.links || x.link || []).forEach(u => {
        const s = safeUrl(u); if (!s) return;
        const a = el('a', 'btn sm', linkLabel(s)); a.href = s; a.target = '_blank'; a.rel = 'noopener noreferrer'; row.append(a);
      });
      if (row.children.length) li.append(row);
      return li;
    }));
    count.textContent = `> SHOWING ${view.length}/${all.length} ENTRIES`;
  }
  tools.replaceChildren(...XP_FILTERS.map(([k, label]) => {
    const n = k === 'all' ? all.length : all.filter(x => x.cat === k).length;
    const b = el('button', 'chip-btn', `${label} (${n})`); b.type = 'button'; b.setAttribute('aria-pressed', String(k === 'all'));
    b.addEventListener('click', () => {
      tools.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
      view = k === 'all' ? all : all.filter(x => x.cat === k); render();
    });
    return b;
  }));
  render();
}

// Contact form (Formspree)
function initForm() {
  const f = $('cf'), s = $('cf-s'), btn = f.querySelector('button');
  const say = (t, c) => { s.textContent = t; s.className = c || ''; };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    let bad = null;
    f.querySelectorAll('[required]').forEach(x => { const b = !x.value.trim() || !x.checkValidity(); x.setAttribute('aria-invalid', b); if (b && !bad) bad = x; });
    if (bad) { say('> ERROR: fill in every field with a valid value.', 'err'); bad.focus(); return; }
    if (FORMSPREE_ID === 'YOUR_FORMSPREE_ID') { say('> ERROR: form not configured yet. Email jrmaghanoy08@gmail.com instead.', 'err'); return; }
    btn.disabled = true; say('> TRANSMITTING...');
    try {
      const r = await fetch(`https://formspree.io/f/xbgdrpzd'}`, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(f) });
      if (!r.ok) throw new Error(r.status);
      f.reset(); say('> MESSAGE_SENT [OK]', 'ok');
    } catch (x) { say('> TRANSMISSION_FAILED. Email jrmaghanoy08@gmail.com instead.', 'err'); }
    finally { btn.disabled = false; }
  });
}

document.addEventListener('DOMContentLoaded', () => { initPin(); initMatrix(); initTyping(); initBreach(); boot(); initAvatar(); initVault(); initXP(); initForm(); loadGitHub(); });

// Language mix from repo metadata (no extra API calls) + last push time
function renderLangs(repos) {
  const own = repos.filter(r => !r.fork);
  if (own.length) $('last-push').textContent = ago(own.reduce((a, r) => new Date(r.pushed_at) > new Date(a) ? r.pushed_at : a, own[0].pushed_at));
  const n = {};
  own.forEach(r => { if (r.language) n[r.language] = (n[r.language] || 0) + 1; });
  const rows = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const cols = ['#00FF41', '#00FFFF', '#FF00FF', '#FFFF00', '#ffffff', '#8a8a8a'];
  const bar = $('langs'), leg = $('legend'); bar.replaceChildren(); leg.replaceChildren();
  rows.forEach(([name, c], i) => {
    const seg = el('i'); seg.style.flex = c; seg.style.background = cols[i]; bar.append(seg);
    const li = el('li'); const sw = el('b'); sw.style.background = cols[i]; li.append(sw, document.createTextNode(`${name} ${c}`)); leg.append(li);
  });
}

// Click the avatar to swap the hacker persona and the real photo
function initAvatar() {
  const a = $('avatar'), bar = document.querySelector('.idbar');
  a.addEventListener('click', () => {
    const on = a.getAttribute('aria-pressed') !== 'true';
    a.setAttribute('aria-pressed', on);
    bar.textContent = on ? 'ID: JRM-08 // IDENTITY: UNMASKED' : 'ID: JRM-08 // CLICK AVATAR TO UNMASK';
  });
}

// ---- Hack intro (once per session; add ?intro to the URL to replay it) ----
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BREACH_EVERY_MS = 60000;   // time between "compromised" takeovers (about 1 minute)
const BREACH_DURATION_MS = 3200; // how long each takeover lasts

function boot() {
  const b = $('boot'), out = $('boot-t');
  const force = new URLSearchParams(location.search).has('intro');
  if ((!force && sessionStorage.getItem('booted')) || REDUCED || !b || !out) {
    if (b) b.classList.remove('on');
    document.dispatchEvent(new Event('booted')); return;
  }
  sessionStorage.setItem('booted', '1');
  const big = el('div', 'boot-big', "YOU'VE BEEN HACKED"); big.dataset.text = "YOU'VE BEEN HACKED"; b.append(big);
  let done = false, t = 0; const timers = [];
  const step = (ms, fn) => { t += ms; timers.push(setTimeout(() => { if (!done) fn(); }, t)); };
  const line = (txt, cls) => { const s = el('span', cls || '', txt + '\n'); out.append(s); return s; };
  const end = () => {
    if (done) return; done = true; timers.forEach(clearTimeout);
    b.classList.remove('on', 'hack'); document.dispatchEvent(new Event('booted'));
    document.removeEventListener('keydown', end); b.removeEventListener('click', end);
  };
  b.classList.add('on'); document.addEventListener('keydown', end); b.addEventListener('click', end);

  step(0, () => line('> BOOTING jayr@portfolio v1.0'));
  step(220, () => line('> mounting /assets ........ [OK]'));
  step(220, () => line('> handshake api.github.com/users/' + GH + ' ... [OK]'));
  step(350, () => { b.classList.add('hack'); line('!! WARNING: UNAUTHORIZED ACCESS DETECTED', 'w'); });
  step(300, () => line('!! SOURCE UNKNOWN // PORT 22 // BRUTE FORCE', 'w'));
  step(300, () => line('> firewall.sys ........ [BYPASSED]', 'w'));
  let bar; step(300, () => { bar = line('', 'w'); });
  for (let p = 0; p <= 100; p += 20) step(150, () => { bar.textContent = `> injecting payload [${'#'.repeat(p / 10).padEnd(10, '.')}] ${p}%\n`; });
  step(300, () => line('> root access ........ [GRANTED]', 'w'));
  step(350, () => big.classList.add('show'));
  step(1500, () => { big.classList.remove('show'); b.classList.remove('hack'); line('> ...just kidding. releasing control.'); });
  step(500, () => line('> ACCESS GRANTED :: welcome to the portfolio'));
  step(700, end);
}

// ---- Periodic "SYSTEM COMPROMISED" takeover, then back to the portfolio ----
function initBreach() {
  if (REDUCED) return;
  const ov = document.createElement('div'); ov.id = 'breach'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = '<div class="br-tear"></div><div class="br-inner"><p class="br-top">!! ALERT // INTRUSION DETECTED</p><div class="br-title" data-text="SYSTEM COMPROMISED">SYSTEM COMPROMISED</div><pre class="br-log"></pre><div class="br-bar"><i></i></div><p class="br-skip">click or press Esc to restore</p></div>';
  document.body.append(ov);
  const log = ov.querySelector('.br-log'), fill = ov.querySelector('.br-bar i');
  const LINES = ['> root shell opened', '> firewall: DISABLED', '> tracing source ... FAILED', '> exfiltrating /home/visitor ... [JUST KIDDING]', '> restoring control ...'];
  let running = false, sched = null, timers = [];
  // Never interrupt while someone is typing in the form or viewing a certificate
  const blocked = () => document.hidden || running || document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  function schedule(ms) { clearTimeout(sched); sched = setTimeout(() => (blocked() ? schedule(5000) : run()), ms); }
  function stop() { timers.forEach(clearTimeout); timers = []; ov.classList.remove('on'); running = false; schedule(BREACH_EVERY_MS); }
  function run() {
    running = true; log.textContent = ''; fill.style.transition = 'none'; fill.style.width = '0'; ov.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transition = `width ${BREACH_DURATION_MS - 600}ms linear`; fill.style.width = '100%'; }));
    LINES.forEach((l, i) => timers.push(setTimeout(() => { log.textContent += l + '\n'; }, 300 + i * ((BREACH_DURATION_MS - 900) / LINES.length))));
    timers.push(setTimeout(stop, BREACH_DURATION_MS));
  }
  ov.addEventListener('click', () => { if (running) stop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && running) stop(); });
  document.addEventListener('booted', () => schedule(BREACH_EVERY_MS), { once: true });
}

// Matrix rain: binary/hex streams, some columns spell hacker words
function initMatrix() {
  const cv = $('matrix'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WORDS = ['BREACH', 'CONTACT', 'ROOT', 'ACCESS', 'EXPLOIT', 'FIREWALL', 'PAYLOAD', 'SUDO', 'ENCRYPT', 'CTF', 'DEVCON', 'ILIGAN', 'ZERO-DAY', 'INJECT', 'BYPASS', 'TRACE', 'DECRYPT', 'PORTFOLIO'];
  const POOL = '01010101ABCDEF23456789';
  const FS = 16; let cols = [], w, h;
  const pick = () => Math.random() < 0.14 ? WORDS[Math.floor(Math.random() * WORDS.length)] : '';
  const fresh = () => ({ y: -Math.floor(Math.random() * 40), word: pick(), i: 0 });
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = `bold ${FS}px "Courier New", monospace`;
    const n = Math.ceil(w / FS); while (cols.length < n) cols.push(fresh()); cols.length = n;
  }
  function tick() {
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(0, 0, w, h);
    cols.forEach((c, k) => {
      if (c.y >= 0) {
        const isWord = c.i < c.word.length;
        const ch = isWord ? c.word[c.i] : POOL[Math.floor(Math.random() * POOL.length)];
        ctx.fillStyle = isWord ? '#d6ffe0' : '#00FF41';
        ctx.fillText(ch, k * FS, c.y * FS); c.i++;
      }
      c.y++;
      if (c.y * FS > h && Math.random() > 0.96) Object.assign(c, fresh());
    });
  }
  size(); addEventListener('resize', size);
  if (reduce) { for (let n = 0; n < 80; n++) tick(); return; }
  let last = 0;
  (function loop(t) { if (t - last > 55) { last = t; tick(); } requestAnimationFrame(loop); })(0);
}

// Typewriter: existing text types itself out the first time it scrolls into view
function typeEl(el) {
  const full = el.dataset.full;
  const a = document.createElement('span'), cur = document.createElement('span'), rest = document.createElement('span');
  cur.className = 'tcur'; cur.setAttribute('aria-hidden', 'true'); rest.className = 'trest'; rest.textContent = full;
  el.classList.remove('pre'); el.textContent = ''; el.append(a, cur, rest);
  let i = 0; const step = Math.max(1, Math.ceil(full.length / 40));
  const t = setInterval(() => {
    i = Math.min(full.length, i + step); a.textContent = full.slice(0, i); rest.textContent = full.slice(i);
    if (i >= full.length) { clearInterval(t); el.textContent = full; }
  }, 30);
}
function initTyping() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const sel = 'h1, h2, .role, .big, #whoami .dim, .chips li, .lbl:not(#streak)';
  const targets = [...document.querySelectorAll(sel)].filter(e => !e.children.length);
  targets.forEach(e => { e.dataset.full = e.textContent; e.classList.add('pre'); });
  const io = new IntersectionObserver(entries => {
    let n = 0;
    entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); setTimeout(() => typeEl(en.target), n++ * 140); } });
  }, { threshold: 0.2 });
  let started = false;
  const start = () => { if (started) return; started = true; targets.forEach(t => io.observe(t)); };
  document.addEventListener('booted', start, { once: true });
  setTimeout(start, 6000); // safety net so text never stays hidden
}

// Keep the pinned project's meta line live (language, stars, last push)
function updatePin(repos) {
  const r = repos.find(x => x.name === 'myimcc-portal'); if (!r) return;
  $('pin-meta').textContent = [r.language, `${r.stargazers_count} stars`, `pushed ${ago(r.pushed_at)}`].filter(Boolean).join(' | ');
}

// Pinned project links live here so they are easy to change (e.g. when you get a permanent domain)
const PIN_LINKS = { demo: 'https://myimcc-portal.vercel.app/', repo: 'https://github.com/codedbyjayr/myimcc-portal' };
function initPin() {
  const a = document.querySelectorAll('#pin .links a');
  if (a.length < 2) { console.warn('Pinned card not found: check that index.html has id="pin" with two links.'); return; }
  [a[0].href, a[1].href] = [PIN_LINKS.demo, PIN_LINKS.repo];
  a.forEach(x => { x.target = '_blank'; x.rel = 'noopener noreferrer'; });
}