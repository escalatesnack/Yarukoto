// やることリスト — データはこの端末のブラウザ(localStorage)に保存されます
(() => {
  'use strict';

  const STORAGE_KEY = 'yarukoto-data-v1';
  const WEEKDAYS = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'];

  // ===== データ =====
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function defaultData() {
    const tasks = () => [
      { id: uid(), emoji: '🧸', name: 'かたづけ', points: 1 },
      { id: uid(), emoji: '📒', name: 'しゅくだい', points: 2 },
      { id: uid(), emoji: '🎒', name: 'あしたの じゅんび', points: 1 },
      { id: uid(), emoji: '🪥', name: 'はみがき', points: 1 },
    ];
    return {
      children: [
        { id: uid(), name: 'おにいちゃん', emoji: '🦁', color: '#ff8a3d', tasks: tasks() },
        { id: uid(), name: 'いもうと', emoji: '🐰', color: '#e86aa6', tasks: tasks() },
      ],
      // できたこと: { childId, taskId, name, emoji, points, date: 'YYYY-MM-DD', at: ISO文字列 }
      log: [],
    };
  }

  // 保存されたデータを読む(なければ・読めなければ null)
  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.children) && Array.isArray(d.log)) return d;
      }
    } catch (e) {
      console.warn('データを読みこめませんでした', e);
    }
    return null;
  }

  let data = loadStored() || defaultData();
  let storageOk = true; // 最後の保存がうまくいったか

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      storageOk = true;
    } catch (e) {
      console.warn('データを保存できませんでした', e);
      storageOk = false;
    }
    $('save-warning').hidden = storageOk;
    return storageOk;
  }

  // 別のタブで変わっているかもしれないので、保存されている最新を読んでから変更して保存する
  // (保存に失敗しているあいだは、画面の中のデータを正とする)
  function update(fn) {
    if (storageOk) data = loadStored() || data;
    fn(data);
    return save();
  }

  // ===== 日付 =====
  function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function labelOf(key) {
    const d = parseKey(key);
    const today = dateKey();
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const prefix = key === today ? 'きょう ' : key === dateKey(yest) ? 'きのう ' : '';
    return `${prefix}${d.getMonth() + 1}がつ${d.getDate()}にち(${WEEKDAYS[d.getDay()]})`;
  }

  // ===== 計算 =====
  const childLog = (childId) => data.log.filter((l) => l.childId === childId);
  const sumPts = (list) => list.reduce((s, l) => s + (Number(l.points) || 0), 0);
  const findChild = (id) => data.children.find((c) => c.id === id);

  // ===== 画面切りかえ =====
  const $ = (id) => document.getElementById(id);
  const screens = { home: $('screen-home'), child: $('screen-child'), parent: $('screen-parent') };
  let currentChildId = null;
  let calMonth = new Date(); // カレンダーに出している つき(1日)
  calMonth.setDate(1);
  let shownDate = dateKey(); // 画面に出している日付

  function show(name) {
    Object.entries(screens).forEach(([k, el]) => (el.hidden = k !== name));
    $('btn-back').hidden = name === 'home';
    $('btn-parent').hidden = name === 'parent';
    if (name === 'home') {
      $('title').textContent = 'やることリスト';
      document.documentElement.style.setProperty('--child-color', '#ff8a3d');
      renderHome();
    } else if (name === 'parent') {
      $('title').textContent = 'おうちのひと 設定';
      renderParent();
    }
    window.scrollTo(0, 0);
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach((c) => c != null && e.append(c));
    return e;
  }

  // ===== だれがつかう? =====
  function renderHome() {
    const box = $('child-cards');
    box.replaceChildren();
    const today = dateKey();
    data.children.forEach((c) => {
      const log = childLog(c.id);
      const doneToday = log.filter((l) => l.date === today).length;
      box.append(
        el('button', { class: 'child-card', type: 'button', style: `--c:${c.color}`, onclick: () => openChild(c.id) },
          el('span', { class: 'emoji', text: c.emoji }),
          el('span', { class: 'text' },
            el('span', { class: 'name', text: c.name }),
            el('br'),
            el('span', { class: 'info', text: `きょう ${doneToday}/${c.tasks.length} できた ・ ${sumPts(log)}てん` }),
          ),
        ),
      );
    });
  }

  // ===== こどもの画面 =====
  function openChild(id) {
    currentChildId = id;
    calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const c = findChild(id);
    if (!c) return show('home');
    show('child');
    $('title').textContent = `${c.name} の やること`;
    document.documentElement.style.setProperty('--child-color', c.color);
    selectTab('todo');
    renderChild();
  }

  function renderChild() {
    const c = findChild(currentChildId);
    if (!c) return;
    const today = dateKey();
    const log = childLog(c.id);
    const todayLog = log.filter((l) => l.date === today);

    $('child-face').textContent = c.emoji;
    $('points-today').textContent = sumPts(todayLog);
    $('points-total').textContent = sumPts(log);

    const list = $('task-list');
    list.replaceChildren();
    if (c.tasks.length === 0) {
      list.append(el('p', { class: 'empty', text: 'やることが まだ ないよ。おうちのひとに いれてもらおう!' }));
    }
    c.tasks.forEach((t) => {
      const done = todayLog.some((l) => l.taskId === t.id);
      list.append(
        el('button', {
          class: 'task' + (done ? ' is-done' : ''),
          type: 'button',
          'aria-pressed': String(done),
          onclick: () => toggleTask(c.id, t.id),
        },
          el('span', { class: 't-emoji', text: t.emoji }),
          el('span', { class: 't-body' },
            el('span', { class: 't-name', text: t.name }),
            el('span', { class: 't-pt', text: done ? 'できた!' : `${t.points}てん` }),
          ),
          el('span', { class: 't-check', text: '✓' }),
        ),
      );
    });
    $('all-done').hidden = !(c.tasks.length > 0 && c.tasks.every((t) => todayLog.some((l) => l.taskId === t.id)));

    renderHistory(c);
  }

  // 押したときに、最新のデータと「いまの日付」で できた/まだ を決める
  function toggleTask(childId, taskId) {
    const today = dateKey();
    if (storageOk) data = loadStored() || data;
    const t = findChild(childId)?.tasks.find((x) => x.id === taskId);
    if (!t) return renderChild();
    const isMine = (l) => l.childId === childId && l.taskId === taskId && l.date === today;
    const done = data.log.some(isMine);

    if (done) {
      if (!confirm(`「${t.name}」を まだ やってないに もどす?`)) return renderChild();
      update((d) => { d.log = d.log.filter((l) => !isMine(l)); });
    } else {
      update((d) => {
        if (d.log.some(isMine)) return;
        d.log.push({
          childId, taskId, name: t.name, emoji: t.emoji,
          points: Number(t.points) || 0, date: today, at: new Date().toISOString(),
        });
      });
      celebrate(t);
    }
    renderChild();
  }

  function celebrate(t) {
    const box = $('celebrate');
    box.replaceChildren(el('div', { class: 'burst' }, `${t.emoji} できた!`, el('small', { text: `+${t.points}てん` })));
    const stars = ['⭐', '🌟', '✨', '💖', '🎉'];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const dist = 140 + Math.random() * 80;
      box.append(el('span', {
        class: 'star',
        text: stars[i % stars.length],
        style: `--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px`,
      }));
    }
    box.hidden = false;
    clearTimeout(celebrate.timer);
    celebrate.timer = setTimeout(() => (box.hidden = true), 1300);
  }

  // ===== おこづかいの ひ =====
  // allowance: { type: 'none' | 'monthly' | 'weekly', day: 1〜28 か 'last'(月の さいごの日), weekday: 0〜6 }
  const allowance = () => ({ type: 'none', day: 25, weekday: 6, ...(data.allowance || {}) });

  function isAllowanceDay(d) {
    const a = allowance();
    if (a.type === 'weekly') return d.getDay() === Number(a.weekday);
    if (a.type === 'monthly') {
      // その日が ない つき(2がつ30にち など)は、その つきの さいごの ひ にする
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const target = a.day === 'last' ? lastDay : Math.min(Number(a.day), lastDay);
      return d.getDate() === target;
    }
    return false;
  }

  // きょうから いちばん ちかい おこづかいの ひ(なければ null)
  function nextAllowanceDay() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 62; i++) {
      if (isAllowanceDay(d)) return { date: new Date(d), inDays: i };
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  // ===== きろく(つきごとの カレンダー) =====
  function renderHistory(c) {
    const log = childLog(c.id);
    const byDate = {};
    log.forEach((l) => (byDate[l.date] ||= []).push(l));

    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const now = new Date();
    const isThisMonth = y === now.getFullYear() && m === now.getMonth();
    const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
    const monthKeys = Object.keys(byDate).filter((k) => k.startsWith(monthPrefix)).sort().reverse();

    $('month-label').textContent = `${y}ねん ${m + 1}がつ`;
    $('points-month').textContent = sumPts(monthKeys.flatMap((k) => byDate[k]));

    // つぎの おこづかいの ひ
    const next = nextAllowanceDay();
    $('allowance-next').hidden = !next;
    if (next) {
      $('allowance-next').textContent = next.inDays === 0
        ? '💰 きょうは おこづかいの ひ!'
        : `💰 つぎの おこづかいの ひ: ${next.date.getMonth() + 1}がつ${next.date.getDate()}にち(あと ${next.inDays}にち)`;
    }

    // カレンダー
    const cal = $('calendar');
    cal.replaceChildren();
    WEEKDAYS.forEach((w, i) => cal.append(el('div', { class: `cal-head wd-${i}`, text: w })));
    const first = new Date(y, m, 1);
    for (let i = 0; i < first.getDay(); i++) cal.append(el('div', { class: 'cal-cell is-blank' }));
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayKey = dateKey();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day);
      const k = dateKey(d);
      const pts = byDate[k] ? sumPts(byDate[k]) : 0;
      const cls = ['cal-cell', `wd-${d.getDay()}`];
      if (k === todayKey) cls.push('is-today');
      if (k > todayKey) cls.push('is-future');
      if (byDate[k]) cls.push('has-done');
      if (isAllowanceDay(d)) cls.push('is-allowance');
      const label = `${m + 1}がつ${day}にち` + (byDate[k] ? ` ${pts}てん` : '') + (isAllowanceDay(d) ? ' おこづかいの ひ' : '');
      const attrs = { class: cls.join(' '), 'aria-label': label };
      if (byDate[k]) {
        attrs.type = 'button';
        attrs.onclick = () => document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      cal.append(el(byDate[k] ? 'button' : 'div', attrs,
        el('span', { class: 'cal-day', text: day }),
        isAllowanceDay(d) ? el('span', { class: 'cal-money', text: '💰' }) : null,
        byDate[k] ? el('span', { class: 'cal-pt', text: `⭐${pts}` }) : null,
      ));
    }

    // その つきの ひごとの リスト(あたらしい じゅん)
    const list = $('history-list');
    list.replaceChildren();
    if (monthKeys.length === 0) {
      const isFuture = new Date(y, m, 1) > now;
      list.append(el('p', { class: 'empty', text: isThisMonth ? 'こんげつは まだ きろくが ないよ。やることを がんばろう!'
        : isFuture ? 'この つきは これからだよ' : 'この つきは きろくが ないよ' }));
      return;
    }
    monthKeys.forEach((k) => {
      const items = byDate[k];
      list.append(el('div', { class: 'day-card', id: `day-${k}` },
        el('h3', {}, labelOf(k), el('span', { text: `${sumPts(items)}てん` })),
        el('ul', {}, items.map((l) => el('li', { text: `${l.emoji} ${l.name}` }))),
      ));
    });
  }

  function moveMonth(dir) {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + dir, 1);
    renderHistory(findChild(currentChildId));
  }
  $('month-prev').addEventListener('click', () => moveMonth(-1));
  $('month-next').addEventListener('click', () => moveMonth(1));

  function selectTab(name) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    $('tab-todo').hidden = name !== 'todo';
    $('tab-history').hidden = name !== 'history';
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

  // ===== おうちのひと確認 =====
  let gateAnswer = 0;
  function openGate() {
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    gateAnswer = a * b;
    $('gate-q').textContent = `${a} × ${b} = ?`;
    $('gate-a').value = '';
    $('gate-err').hidden = true;
    $('gate-dialog').showModal();
    $('gate-a').focus();
  }
  $('gate-form').addEventListener('submit', (e) => {
    if (Number($('gate-a').value) !== gateAnswer) {
      e.preventDefault();
      $('gate-err').hidden = false;
      return;
    }
    show('parent');
  });
  $('gate-cancel').addEventListener('click', () => $('gate-dialog').close());
  $('btn-parent').addEventListener('click', openGate);
  $('btn-back').addEventListener('click', () => show('home'));

  // ===== おうちのひと設定 =====
  // 変更は id で最新データの中から探してあてる(別タブの変更を消さないため)
  function editChild(childId, fn) {
    update((d) => { const c = d.children.find((x) => x.id === childId); if (c) fn(c); });
  }
  function editTask(childId, taskId, fn) {
    editChild(childId, (c) => { const t = c.tasks.find((x) => x.id === taskId); if (t) fn(t, c); });
  }

  function renderParent() {
    const box = $('parent-settings');
    box.replaceChildren();
    data.children.forEach((c, ci) => {
      const tasksBox = el('div', { class: 'p-tasks' });
      c.tasks.forEach((t, ti) => {
        tasksBox.append(el('div', { class: 'p-task' },
          el('input', { class: 'inp inp-emoji', value: t.emoji, 'aria-label': 'えもじ', onchange: (e) => {
            const v = e.target.value.trim() || '⭐';
            editTask(c.id, t.id, (x) => { x.emoji = v; });
          } }),
          el('input', { class: 'inp inp-name', value: t.name, 'aria-label': 'やることの なまえ', onchange: (e) => {
            const v = e.target.value.trim() || 'やること';
            editTask(c.id, t.id, (x) => { x.name = v; });
          } }),
          el('input', { class: 'inp inp-pt', type: 'number', min: '0', max: '99', inputmode: 'numeric', value: t.points, 'aria-label': 'ポイント', onchange: (e) => {
            const v = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0));
            e.target.value = v;
            editTask(c.id, t.id, (x) => { x.points = v; });
          } }),
          el('span', { class: 'pt-unit', text: 'てん' }),
          moveBtn('▲', ti === 0, () => moveTask(c.id, t.id, -1)),
          moveBtn('▼', ti === c.tasks.length - 1, () => moveTask(c.id, t.id, 1)),
          el('button', { class: 'small-btn del', type: 'button', 'aria-label': 'けす', text: '🗑', onclick: () => {
            if (!confirm(`「${t.name}」を けしますか?(これまでの きろくは のこります)`)) return;
            editChild(c.id, (x) => { x.tasks = x.tasks.filter((y) => y.id !== t.id); });
            renderParent();
          } }),
        ));
      });

      box.append(el('div', { class: 'p-child', style: `--c:${c.color}` },
        el('h2', { text: `${ci + 1}にんめ` }),
        el('div', { class: 'p-row' },
          el('input', { class: 'inp inp-emoji', value: c.emoji, 'aria-label': 'えもじ', onchange: (e) => {
            const v = e.target.value.trim() || '🙂';
            editChild(c.id, (x) => { x.emoji = v; });
          } }),
          el('input', { class: 'inp inp-name', value: c.name, 'aria-label': 'なまえ', onchange: (e) => {
            const v = e.target.value.trim() || `${ci + 1}にんめ`;
            editChild(c.id, (x) => { x.name = v; });
          } }),
          el('input', { class: 'inp-color', type: 'color', value: c.color, 'aria-label': 'いろ', onchange: (e) => {
            const v = e.target.value;
            editChild(c.id, (x) => { x.color = v; });
            renderParent();
          } }),
        ),
        el('p', { class: 'note', text: 'やること(えもじ・なまえ・ポイント)' }),
        tasksBox,
        el('button', { class: 'btn btn-add', type: 'button', text: '+ やることを ふやす', onclick: () => {
          editChild(c.id, (x) => { x.tasks.push({ id: uid(), emoji: '⭐', name: 'あたらしい やること', points: 1 }); });
          renderParent();
        } }),
      ));
    });
    box.append(allowanceSettings());
  }

  // おこづかいの ひ の 設定(ふたり きょうつう)
  function allowanceSettings() {
    const a = allowance();
    const setA = (patch) => { update((d) => { d.allowance = { ...allowance(), ...patch }; }); renderParent(); };
    const select = (options, value, label, onchange) => {
      const s = el('select', { class: 'inp', 'aria-label': label, onchange: (e) => onchange(e.target.value) },
        options.map(([v, t]) => el('option', { value: v, text: t })));
      s.value = String(value);
      return s;
    };

    const typeSel = select(
      [['none', 'きめない'], ['monthly', 'まいつき'], ['weekly', 'まいしゅう']],
      a.type, 'おこづかいの ひの きめかた', (v) => setA({ type: v }),
    );
    let detail = null;
    if (a.type === 'monthly') {
      const days = [];
      for (let i = 1; i <= 31; i++) days.push([String(i), `${i}にち`]);
      days.push(['last', 'さいごの ひ(つきまつ)']);
      detail = select(days, a.day, 'なんにち', (v) => setA({ day: v === 'last' ? 'last' : Number(v) }));
    } else if (a.type === 'weekly') {
      detail = select(WEEKDAYS.map((w, i) => [String(i), `${w}ようび`]), a.weekday, 'なんようび', (v) => setA({ weekday: Number(v) }));
    }

    return el('div', { class: 'p-child', style: '--c:#e3b23c' },
      el('h2', { text: '💰 おこづかいの ひ' }),
      el('p', { class: 'note', text: 'きめた ひは、こどもの「きろく」の カレンダーに 💰 が でます(ふたり きょうつう)。' }),
      el('div', { class: 'p-row' }, typeSel, detail),
      a.type === 'monthly' && a.day !== 'last' && Number(a.day) >= 29
        ? el('p', { class: 'note', text: `${a.day}にちが ない つきは、その つきの さいごの ひ に なります。` })
        : null,
    );
  }
  function moveBtn(label, disabled, fn) {
    const b = el('button', { class: 'small-btn', type: 'button', text: label, 'aria-label': label === '▲' ? 'うえへ' : 'したへ', onclick: fn });
    b.disabled = disabled;
    return b;
  }
  function moveTask(childId, taskId, dir) {
    editChild(childId, (c) => {
      const i = c.tasks.findIndex((t) => t.id === taskId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.tasks.length) return;
      [c.tasks[i], c.tasks[j]] = [c.tasks[j], c.tasks[i]];
    });
    renderParent();
  }

  $('btn-clear-log').addEventListener('click', () => {
    if (!confirm('ほんとうに きろくを ぜんぶ けしますか?もとに もどせません。')) return;
    update((d) => { d.log = []; });
    alert('きろくを けしました');
  });

  // いまの画面を、手もとのデータで かきなおす
  function refresh() {
    shownDate = dateKey();
    if (!screens.child.hidden) renderChild();
    else if (!screens.home.hidden) renderHome();
    else if (!screens.parent.hidden) {
      // 入力中は かきなおさない(打っている文字が消えないように)
      const typing = document.activeElement && screens.parent.contains(document.activeElement)
        && document.activeElement.tagName === 'INPUT';
      if (!typing) renderParent();
    }
  }

  // 別のタブで データが変わったら とりこむ
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !storageOk) return;
    data = loadStored() || data;
    refresh();
  });

  // 日付が変わったら(朝ひらいたとき・ひらいたまま 0時をこえたとき)画面を更新
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  setInterval(() => { if (dateKey() !== shownDate) refresh(); }, 30 * 1000);

  // はじめて ひらいたときは 最初のデータを保存しておく(保存できなくても 画面は出す)
  if (!loadStored()) save();
  show('home');
})();
