// やることリスト — データはこの端末のブラウザ(localStorage)に保存されます
(() => {
  'use strict';

  const STORAGE_KEY = 'yarukoto-data-v1';
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  // ===== データ =====
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function defaultData() {
    const own = () => [{ id: uid(), emoji: '📒', name: 'しゅくだい', points: 2 }];
    return {
      // ふたり きょうつうの やること
      commonTasks: [
        { id: uid(), emoji: '🧸', name: 'かたづけ', points: 1 },
        { id: uid(), emoji: '🪥', name: 'はみがき', points: 1 },
        { id: uid(), emoji: '🎒', name: 'あしたの じゅんび', points: 1 },
      ],
      // tasks は その子だけの やること
      children: [
        { id: uid(), name: 'おにいちゃん', emoji: '🦁', color: '#ff8a3d', tasks: own() },
        { id: uid(), name: 'いもうと', emoji: '🐰', color: '#e86aa6', tasks: own() },
      ],
      // できたこと: { childId, taskId, name, emoji, points, date: 'YYYY-MM-DD', at: ISO文字列 }
      log: [],
    };
  }

  // まえの 形の データを いまの 形に そろえる
  function normalize(d) {
    if (!Array.isArray(d.commonTasks)) {
      // きょうつうの やることが なかった ころの データ:
      // ふたりとも 同じ え文字・名まえ・ポイント の やることは「きょうつう」に まとめる
      // (ポイントが ちがう ものは、それぞれの 設定を のこすため その子だけの やることの まま)
      d.commonTasks = [];
      const [first, ...others] = d.children;
      if (first && others.length) {
        const same = (a, b) => a.name === b.name && a.emoji === b.emoji
          && (Number(a.points) || 0) === (Number(b.points) || 0);
        first.tasks.slice().forEach((t) => {
          const matches = others.map((c) => c.tasks.find((x) => same(x, t)));
          if (matches.some((m) => !m)) return;
          d.commonTasks.push(t);
          first.tasks = first.tasks.filter((x) => x !== t);
          others.forEach((c, i) => {
            const m = matches[i];
            c.tasks = c.tasks.filter((x) => x !== m);
            // その子の きろくも きょうつうの id に つけかえる(きょうの「できた」が きえないように)
            d.log.forEach((l) => { if (l.childId === c.id && l.taskId === m.id) l.taskId = t.id; });
          });
        });
      }
    }
    // おこづかいの 日: 1つだけ(day)だった ころの データは days に する
    if (d.allowance && !Array.isArray(d.allowance.days)) {
      d.allowance.days = d.allowance.day != null ? [d.allowance.day] : [25];
      delete d.allowance.day;
    }
    return d;
  }

  // 保存されたデータを読む(なければ・読めなければ null)
  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.children) && Array.isArray(d.log)) return normalize(d);
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
    return `${prefix}${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
  }

  // ===== 計算 =====
  const childLog = (childId) => data.log.filter((l) => l.childId === childId);
  const sumPts = (list) => list.reduce((s, l) => s + (Number(l.points) || 0), 0);
  const findChild = (id) => data.children.find((c) => c.id === id);
  // その子の やること ぜんぶ(きょうつう + その子だけ)
  const tasksFor = (c) => [...(data.commonTasks || []), ...c.tasks];

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
      $('title').textContent = 'おうちの人 設定';
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
            el('span', { class: 'info', text: `きょう ${doneToday}/${tasksFor(c).length} できた ・ ${sumPts(log)}てん` }),
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

    const taskBtn = (t) => {
      const done = todayLog.some((l) => l.taskId === t.id);
      return el('button', {
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
      );
    };
    const group = (title, tasks, mine) => [
      el('div', { class: 'group-title' + (mine ? ' mine' : '') },
        el('span', { class: 'pill', text: title }), el('span', { class: 'line' })),
      el('div', { class: 'task-list' }, tasks.map(taskBtn)),
    ];

    // 「ふたりの やること」と「その子の やること」に わけて ならべる
    const box = $('task-groups');
    box.replaceChildren();
    const common = data.commonTasks || [];
    if (common.length) box.append(...group('👫 ふたりの やること', common, false));
    if (c.tasks.length) box.append(...group(`${c.emoji} ${c.name}の やること`, c.tasks, true));
    const all = tasksFor(c);
    if (all.length === 0) {
      box.append(el('p', { class: 'empty', text: 'やることが まだ ないよ。おうちの人に 入れてもらおう!' }));
    }
    $('all-done').hidden = !(all.length > 0 && all.every((t) => todayLog.some((l) => l.taskId === t.id)));

    renderHistory(c);
  }

  // 押したときに、最新のデータと「いまの日付」で できた/まだ を決める
  function toggleTask(childId, taskId) {
    const today = dateKey();
    if (storageOk) data = loadStored() || data;
    const child = findChild(childId);
    const t = child && tasksFor(child).find((x) => x.id === taskId);
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
  // allowance: { type: 'none' | 'monthly' | 'weekly', days: [1〜31 か 'last'(月の さいごの日)…], weekday: 0〜6 }
  const allowance = () => ({ type: 'none', days: [25], weekday: 6, ...(data.allowance || {}) });

  function isAllowanceDay(d) {
    const a = allowance();
    if (a.type === 'weekly') return d.getDay() === Number(a.weekday);
    if (a.type === 'monthly') {
      // その日が ない 月(2月30日 など)は、その 月の さいごの 日に する
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return a.days.some((v) => (v === 'last' ? lastDay : Math.min(Number(v), lastDay)) === d.getDate());
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

    $('month-label').textContent = `${y}年 ${m + 1}月`;
    $('points-month').textContent = sumPts(monthKeys.flatMap((k) => byDate[k]));

    // つぎの おこづかいの ひ
    const next = nextAllowanceDay();
    $('allowance-next').hidden = !next;
    if (next) {
      $('allowance-next').textContent = next.inDays === 0
        ? '💰 きょうは おこづかいの 日!'
        : `💰 つぎの おこづかいの 日: ${next.date.getMonth() + 1}月${next.date.getDate()}日(あと ${next.inDays}日)`;
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
      const label = `${m + 1}月${day}日` + (byDate[k] ? ` ${pts}てん` : '') + (isAllowanceDay(d) ? ' おこづかいの 日' : '');
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
      list.append(el('p', { class: 'empty', text: isThisMonth ? 'こん月は まだ きろくが ないよ。やることを がんばろう!'
        : isFuture ? 'この 月は これからだよ' : 'この 月は きろくが ないよ' }));
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
  // やることの リストは listKey で えらぶ: 'common'(ふたり きょうつう)か 子どもの id(その子だけ)
  function taskListOf(d, listKey) {
    if (listKey === 'common') return d.commonTasks;
    return d.children.find((x) => x.id === listKey)?.tasks || null;
  }
  function editList(listKey, fn) {
    update((d) => { const list = taskListOf(d, listKey); if (list) fn(list); });
  }
  function editTask(listKey, taskId, fn) {
    editList(listKey, (list) => { const t = list.find((x) => x.id === taskId); if (t) fn(t); });
  }
  function moveTask(listKey, taskId, dir) {
    editList(listKey, (list) => {
      const i = list.findIndex((t) => t.id === taskId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
    renderParent();
  }

  // やることの 一らん(へんしゅう できる 行)+ ふやす ボタン
  function taskEditor(listKey, tasks, addLabel) {
    const box = el('div', { class: 'p-tasks' });
    tasks.forEach((t, ti) => {
      box.append(el('div', { class: 'p-task' },
        el('input', { class: 'inp inp-emoji', value: t.emoji, 'aria-label': 'え文字', onchange: (e) => {
          const v = e.target.value.trim() || '⭐';
          editTask(listKey, t.id, (x) => { x.emoji = v; });
        } }),
        el('input', { class: 'inp inp-name', value: t.name, 'aria-label': 'やることの 名まえ', onchange: (e) => {
          const v = e.target.value.trim() || 'やること';
          editTask(listKey, t.id, (x) => { x.name = v; });
        } }),
        el('input', { class: 'inp inp-pt', type: 'number', min: '0', max: '99', inputmode: 'numeric', value: t.points, 'aria-label': 'ポイント', onchange: (e) => {
          const v = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0));
          e.target.value = v;
          editTask(listKey, t.id, (x) => { x.points = v; });
        } }),
        el('span', { class: 'pt-unit', text: 'てん' }),
        moveBtn('▲', ti === 0, () => moveTask(listKey, t.id, -1)),
        moveBtn('▼', ti === tasks.length - 1, () => moveTask(listKey, t.id, 1)),
        el('button', { class: 'small-btn del', type: 'button', 'aria-label': 'けす', text: '🗑', onclick: () => {
          if (!confirm(`「${t.name}」を けしますか?(これまでの きろくは のこります)`)) return;
          editList(listKey, (list) => {
            const i = list.findIndex((y) => y.id === t.id);
            if (i >= 0) list.splice(i, 1);
          });
          renderParent();
        } }),
      ));
    });
    return [
      box,
      el('button', { class: 'btn btn-add', type: 'button', text: addLabel, onclick: () => {
        editList(listKey, (list) => { list.push({ id: uid(), emoji: '⭐', name: 'あたらしい やること', points: 1 }); });
        renderParent();
      } }),
    ];
  }

  function renderParent() {
    const box = $('parent-settings');
    box.replaceChildren();

    // ふたり きょうつうの やること
    box.append(el('div', { class: 'p-child', style: '--c:#7bbf5a' },
      el('h2', { text: '👫 ふたり きょうつうの やること' }),
      el('p', { class: 'note', text: 'ここに 入れた やることは、ふたりとも の 画面に 出ます。「できた」は それぞれ べつに つきます。' }),
      taskEditor('common', data.commonTasks, '+ きょうつうの やることを ふやす'),
    ));

    // 子どもごと(名まえ・いろ・その子だけの やること)
    data.children.forEach((c, ci) => {
      const ownTitle = el('h4', { text: `${c.emoji} ${c.name}だけの やること` });
      const [ownList, ownAdd] = taskEditor(c.id, c.tasks, `+ ${c.name}だけの やることを ふやす`);
      // 名まえ・え文字を かえたら 見出しも かえる(画面ぜんぶは かきなおさない)
      const relabel = () => {
        const now = findChild(c.id);
        if (!now) return;
        ownTitle.textContent = `${now.emoji} ${now.name}だけの やること`;
        ownAdd.textContent = `+ ${now.name}だけの やることを ふやす`;
      };
      box.append(el('div', { class: 'p-child', style: `--c:${c.color}` },
        el('h2', { text: `${ci + 1}人め` }),
        el('div', { class: 'p-row' },
          el('input', { class: 'inp inp-emoji', value: c.emoji, 'aria-label': 'え文字', onchange: (e) => {
            const v = e.target.value.trim() || '🙂';
            editChild(c.id, (x) => { x.emoji = v; });
            relabel();
          } }),
          el('input', { class: 'inp inp-name', value: c.name, 'aria-label': '名まえ', onchange: (e) => {
            const v = e.target.value.trim() || `${ci + 1}人め`;
            editChild(c.id, (x) => { x.name = v; });
            relabel();
          } }),
          el('input', { class: 'inp-color', type: 'color', value: c.color, 'aria-label': 'いろ', onchange: (e) => {
            const v = e.target.value;
            editChild(c.id, (x) => { x.color = v; });
            renderParent();
          } }),
        ),
        ownTitle, ownList, ownAdd,
      ));
    });
    box.append(allowanceSettings());
    box.append(transferSettings());

    // まだ ホーム画面に 置いていない ときだけ、置きかたを 出す(おうちの人 向け)
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (!standalone) {
      box.append(el('div', { class: 'p-child', style: '--c:#8a7a6a' },
        el('h2', { text: '📲 ホーム画面に 置く' }),
        el('p', { class: 'note', text: 'iPhone・iPad の Safari で、下(iPad は上)の 共有ボタン □↑ →「ホーム画面に追加」を押すと、アプリのように全画面で開けます。ホーム画面から使うと、記録が消されにくくなります。' }),
      ));
    }
  }

  // おこづかいの 日 の 設定(ふたり きょうつう)
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
      [['none', 'きめない'], ['monthly', 'まい月'], ['weekly', 'まいしゅう']],
      a.type, 'おこづかいの 日の きめかた', (v) => setA({ type: v }),
    );

    let detail = null;
    if (a.type === 'monthly') {
      // 日にちボタン: おすと えらぶ/はずす(いくつでも)
      const toggleDay = (v) => setA({ days: a.days.includes(v) ? a.days.filter((x) => x !== v) : [...a.days, v] });
      const chip = (v, text, extra = '') => {
        const on = a.days.includes(v);
        return el('button', {
          class: `day-chip${on ? ' on' : ''}${extra}`, type: 'button', text,
          'aria-pressed': String(on), 'aria-label': v === 'last' ? 'さいごの 日' : `${v}日`,
          onclick: () => toggleDay(v),
        });
      };
      const chips = [];
      for (let i = 1; i <= 31; i++) chips.push(chip(i, String(i)));
      chips.push(chip('last', 'さいごの 日(月まつ)', ' wide'));
      detail = el('div', {},
        el('p', { class: 'picked', text: `えらんだ 日: ${a.days.length ? sortDays(a.days).map(dayLabel).join('・') : 'まだ ないよ'}` }),
        el('div', { class: 'day-picker' }, chips),
        el('p', { class: 'note', style: 'margin:0', text: 'いくつでも えらべます。もういちど おすと はずれます。31日など ない 月は、その 月の さいごの 日に なります。' }),
      );
    } else if (a.type === 'weekly') {
      detail = el('div', { class: 'p-row' },
        select(WEEKDAYS.map((w, i) => [String(i), `${w}よう日`]), a.weekday, 'なんよう日', (v) => setA({ weekday: Number(v) })));
    }

    return el('div', { class: 'p-child', style: '--c:#e3b23c' },
      el('h2', { text: '💰 おこづかいの 日' }),
      el('p', { class: 'note', text: 'きめた 日は、子どもの「きろく」の カレンダーに 💰 が 出ます(ふたり きょうつう)。' }),
      el('div', { class: 'p-row' }, typeSel),
      detail,
    );
  }
  // ===== ほかの 端末に うつす =====
  // データを gzip で 小さくして、リンク(#import=...)に のせる。QRコードで iPad などに わたせる
  const PUBLIC_URL = 'https://escalatesnack.github.io/Yarukoto/';
  const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  function bytesToB64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(t) {
    t = t.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const s = atob(t);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  async function packData(d) {
    const json = new TextEncoder().encode(JSON.stringify(d));
    if ('CompressionStream' in window) return 'z' + bytesToB64url(await pipe(json, new CompressionStream('gzip')));
    return 'j' + bytesToB64url(json);
  }
  async function unpackData(code) {
    let bytes = b64urlToBytes(code.slice(1));
    if (code[0] === 'z') {
      if (!('DecompressionStream' in window)) throw new Error('この ブラウザでは 読みこめません。ブラウザを 新しく してください');
      bytes = await pipe(bytes, new DecompressionStream('gzip'));
    } else if (code[0] !== 'j') {
      throw new Error('コードの 形が ちがいます');
    }
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (!d || !Array.isArray(d.children) || !Array.isArray(d.log)) throw new Error('やることリストの データでは ありません');
    return normalize(d);
  }
  const shareUrl = (code) => (location.hostname.endsWith('github.io') ? location.origin + location.pathname : PUBLIC_URL) + '#import=' + code;
  const codeFromText = (t) => { const m = /#import=([A-Za-z0-9_-]+)/.exec(t); return m ? m[1] : t.trim(); };
  async function importCode(code) {
    const d = await unpackData(code);
    const who = d.children.map((c) => c.name).join('・');
    if (!confirm(`ほかの 端末の データ(${who}・きろく ${d.log.length}こ)を 読みこみますか?\nこの 端末の いまの データは 上書きされます。`)) return false;
    data = d;
    save();
    return true;
  }
  function loadQrLib() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = el('script', { src: QR_LIB });
      sc.onload = res;
      sc.onerror = () => rej(new Error('QRコードの 道具を 読みこめませんでした'));
      document.head.append(sc);
    });
  }
  function transferSettings() {
    const out = el('div', { class: 'transfer-out' });
    const make = el('button', { class: 'btn btn-main', type: 'button', text: 'この 端末の データを うつす', onclick: async () => {
      make.disabled = true;
      try {
        const url = shareUrl(await packData(data));
        const qr = el('div', { class: 'qr-box' });
        const field = el('input', { class: 'inp', readonly: 'readonly', value: url, 'aria-label': 'うつす ための リンク', onclick: (e) => e.target.select() });
        const copy = el('button', { class: 'btn', type: 'button', text: 'リンクを コピー', onclick: async () => {
          try { await navigator.clipboard.writeText(url); copy.textContent = 'コピーしました'; } catch (e) { field.select(); }
        } });
        const share = navigator.share ? el('button', { class: 'btn', type: 'button', text: '共有(AirDrop など)', onclick: () => navigator.share({ title: 'やることリストの データ', url }).catch(() => {}) }) : null;
        out.replaceChildren(
          el('p', { class: 'note', text: 'うつしたい 端末(iPad など)の カメラで この QRコードを 読みとると、データが 読みこまれます。' }),
          qr,
          el('div', { class: 'p-row' }, field),
          el('div', { class: 'p-row' }, copy, share),
        );
        if (url.length > 2300) {
          qr.replaceWith(el('p', { class: 'note', text: 'きろくが 多くて QRコードに 入りきりません。リンクを コピーするか 共有して、うつしたい 端末で ひらいてください。' }));
        } else {
          await loadQrLib();
          new window.QRCode(qr, { text: url, width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.L });
        }
      } catch (e) {
        out.replaceChildren(el('p', { class: 'note', text: 'うつす じゅんびが できませんでした: ' + e.message }));
      } finally {
        make.disabled = false;
      }
    } });
    const paste = el('textarea', { class: 'inp paste-box', rows: '2', placeholder: 'ほかの 端末で コピーした リンクを ここに はりつけ', 'aria-label': 'うつす ための リンク' });
    const read = el('button', { class: 'btn', type: 'button', text: '読みこむ', onclick: async () => {
      const code = codeFromText(paste.value);
      if (!code) return;
      try {
        if (await importCode(code)) { alert('読みこみました'); show('home'); }
      } catch (e) { alert('読みこめませんでした: ' + e.message); }
    } });
    return el('div', { class: 'p-child', style: '--c:#4aa3df' },
      el('h2', { text: '📲 ほかの 端末に うつす' }),
      el('p', { class: 'note', text: 'やることの 設定と きろくを、ほかの 端末(iPad など)に うつせます。うつした あとは、それぞれ べつべつに 記録されます(自動では そろいません)。' }),
      make, out,
      el('h4', { text: 'ほかの 端末から うけとる' }),
      el('p', { class: 'note', text: 'ホーム画面に 置いた アプリで 使っている ときは、QRコードからだと べつの 場所に 入って しまうので、リンクを コピーして ここに はりつけて ください。' }),
      el('div', { class: 'p-row' }, paste, read),
    );
  }

  const sortDays = (days) => [...days].sort((x, y) => (x === 'last' ? 99 : x) - (y === 'last' ? 99 : y));
  const dayLabel = (v) => (v === 'last' ? '月まつ' : `${v}日`);

  function moveBtn(label, disabled, fn) {
    const b = el('button', { class: 'small-btn', type: 'button', text: label, 'aria-label': label === '▲' ? '上へ' : '下へ', onclick: fn });
    b.disabled = disabled;
    return b;
  }

  $('btn-clear-log').addEventListener('click', () => {
    if (!confirm('本とうに きろくを ぜんぶ けしますか?もとに もどせません。')) return;
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
  // (まえの 形の データを 読んだときも、いまの 形で 保存しなおす)
  // QRコード・リンク(#import=...)から ひらかれたら、データを 読みこむ
  const importHash = /#import=([A-Za-z0-9_-]+)/.exec(location.hash);
  save();
  show('home');
  if (importHash) {
    history.replaceState(null, '', location.pathname + location.search);
    importCode(importHash[1])
      .then((ok) => { if (ok) { show('home'); alert('読みこみました'); } })
      .catch((e) => alert('読みこめませんでした: ' + e.message));
  }

  // ===== ホーム画面アプリ用 =====
  // iPhone・iPad の ホーム画面アイコンは PNG が ひつようなので、icon.svg を 180×180 の 絵に して 入れる
  (function makeTouchIcon() {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 180;
        cv.getContext('2d').drawImage(img, 0, 0, 180, 180);
        $('touch-icon').href = cv.toDataURL('image/png');
      } catch (e) {
        console.warn('アイコンを つくれませんでした', e);
      }
    };
    img.src = 'icon.svg';
  })();

  // ネットが つながらなくても ひらけるように(http/https で ひらいたときだけ)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('オフライン用の 登録に しっぱい', e));
  }
})();
