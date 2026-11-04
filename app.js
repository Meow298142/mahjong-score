(function () {
  'use strict';
  var MJ = window.MJ;
  var T = window.MJTiles;
  if (!MJ) { document.body.innerHTML = '<p style="padding:40px">引擎 engine.js 未加载。</p>'; return; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ceil100(n) { return Math.ceil(n / 100) * 100; }

  var S = {
    hand: [], win: null, melds: [], draft: [], draftKind: 'chi', mode: 'hand',
    seat: 1, tsumo: false, riichi: 'none',
    ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
    dora: [], ura: [], honba: 0, sticks: 0, preset: 'tenhou'
  };

  var KIND_LABEL = { chi: '吃', pon: '碰', minkan: '明杠', ankan: '暗杠', kakan: '加杠' };
  var KIND_NEED = { chi: 3, pon: 3, minkan: 4, ankan: 4, kakan: 1 };

  /* ---------- 牌元素 ---------- */
  function tileEl(t, opts) {
    opts = opts || {};
    var el = document.createElement(opts.plain ? 'span' : 'button');
    if (!opts.plain) el.type = 'button';
    var base = MJ.redBase(t);
    var cls = 'tile';
    if (opts.xs) cls += ' xs';
    else if (opts.sm) cls += ' sm';
    if (MJ.isRed(t)) cls += ' red';
    if (opts.on) cls += ' on';
    el.className = cls;
    el.innerHTML = T.svg(t);
    el.title = opts.title || (MJ.tileLabel(t) + (MJ.isRed(t) ? '（赤宝牌）' : ''));
    el.setAttribute('aria-label', MJ.tileLabel(t));
    if (!opts.plain) {
      if (opts.onClick) el.addEventListener('click', opts.onClick);
      else el.style.cursor = 'default';
    }
    return el;
  }

  function tileRow(ids) {
    var frag = document.createDocumentFragment();
    ids.forEach(function (t) { frag.appendChild(tileEl(t, { plain: true })); });
    return frag;
  }

  function totalTiles() { return S.hand.length + S.melds.length * 3; }

  /* ---------- 牌库 ---------- */
  var PALETTE_ROWS = [
    { label: '萬', ids: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    { label: '筒', ids: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
    { label: '索', ids: [18, 19, 20, 21, 22, 23, 24, 25, 26] },
    { label: '字', ids: [27, 28, 29, 30, 31, 32, 33] },
    { label: '赤', ids: [34, 35, 36] }
  ];

  function buildPalette(host, onPick) {
    host.innerHTML = '';
    PALETTE_ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'palette-row';
      var lb = document.createElement('div');
      lb.className = 'lbl';
      lb.textContent = row.label;
      r.appendChild(lb);
      var tw = document.createElement('div');
      tw.className = 'tiles';
      row.ids.forEach(function (id) {
        tw.appendChild(tileEl(id, { onClick: function () { onPick(id); } }));
      });
      r.appendChild(tw);
      host.appendChild(r);
    });
  }

  function addHand(t) {
    if (totalTiles() >= 14) { flash('牌数已满 14 张'); return; }
    S.hand.push(t);
    renderAll();
  }
  function addDraft(t) {
    var need = KIND_NEED[S.draftKind] || 3;
    if (S.draft.length >= need) { flash('草稿已满，先点「加入副露」或清空草稿'); return; }
    S.draft.push(t);
    renderAll();
  }

  var flashMsg = '';
  function flash(msg) {
    flashMsg = msg;
    renderHint();
    window.setTimeout(function () { flashMsg = ''; renderHint(); }, 1900);
  }

  /* ---------- 渲染：手牌 ---------- */
  function renderHand() {
    var zone = $('#handZone');
    zone.innerHTML = '';
    if (!S.hand.length) {
      zone.innerHTML = '<div class="empty">还没有牌 · 点下方牌库开始录入</div>';
      return;
    }
    var marked = false;
    S.hand.forEach(function (t, i) {
      var isWin = (!marked && S.win === t);
      if (isWin) marked = true;
      var b = tileEl(t, {
        on: isWin,
        title: '点击设为和了牌',
        onClick: function () {
          S.win = (S.win === t) ? null : t;
          renderAll();
        }
      });
      if (isWin) b.classList.add('win');
      var x = document.createElement('button');
      x.className = 'x';
      x.type = 'button';
      x.textContent = '×';
      x.title = '删除这张';
      x.addEventListener('click', function (ev) {
        ev.stopPropagation();
        S.hand.splice(i, 1);
        if (S.win === t) S.win = null;
        renderAll();
      });
      b.appendChild(x);
      zone.appendChild(b);
    });
  }

  function renderMeldList() {
    var host = $('#meldList');
    host.innerHTML = '';
    if (!S.melds.length) {
      host.innerHTML = '<div class="empty">没有副露（门前清）。</div>';
      return;
    }
    var row = document.createElement('div');
    row.className = 'meld-row';
    S.melds.forEach(function (m, i) {
      var box = document.createElement('div');
      box.className = 'meld';
      var k = document.createElement('span');
      k.className = 'kind';
      k.textContent = KIND_LABEL[m.kind] || m.kind;
      box.appendChild(k);
      var tw = document.createElement('span');
      tw.className = 'tiles';
      m.tiles.forEach(function (t) { tw.appendChild(tileEl(t, { plain: true })); });
      box.appendChild(tw);
      var del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = '×';
      del.title = '删除这组副露';
      del.addEventListener('click', function () { S.melds.splice(i, 1); renderAll(); });
      box.appendChild(del);
      row.appendChild(box);
    });
    host.appendChild(row);
  }

  function renderDraft() {
    var zone = $('#draftZone');
    zone.innerHTML = '';
    var need = KIND_NEED[S.draftKind] || 3;
    if (!S.draft.length) {
      zone.innerHTML = '<div class="empty">' + (S.mode === 'meld' ? '在牌库点选 ' + need + ' 张' : '点上方「录入副露」后从牌库选牌') + '</div>';
      return;
    }
    S.draft.forEach(function (t, i) {
      var b = tileEl(t, { onClick: function () { S.draft.splice(i, 1); renderAll(); } });
      zone.appendChild(b);
    });
  }

  function doraChip(t, i, isUra) {
    var w = document.createElement('div');
    w.className = 'dora-chip' + (isUra ? ' is-ura' : '');
    w.appendChild(tileEl(t, { plain: true }));
    var arrow = document.createElement('span');
    arrow.className = 'to';
    arrow.textContent = '→';
    w.appendChild(arrow);
    var nd = tileEl(MJ.nextDora(t), { plain: true });
    nd.classList.add('mini');
    w.appendChild(nd);
    var x = document.createElement('button');
    x.className = 'x';
    x.type = 'button';
    x.textContent = '×';
    x.title = '移除';
    x.addEventListener('click', function () {
      if (isUra) S.ura.splice(i, 1); else S.dora.splice(i, 1);
      renderAll();
    });
    w.appendChild(x);
    return w;
  }

  function renderDora() {
    var host = $('#doraChips');
    host.innerHTML = '';
    S.dora.forEach(function (t, i) { host.appendChild(doraChip(t, i, false)); });
    S.ura.forEach(function (t, i) { host.appendChild(doraChip(t, i, true)); });
    if (!S.dora.length && !S.ura.length) {
      host.innerHTML = '<div class="empty" style="padding:2px 0">未设置 · 无宝牌</div>';
    }
  }

  function renderHint() {
    var need = 14 - S.melds.length * 3;
    var txt = '手牌 ' + S.hand.length + ' / ' + need;
    if (S.melds.length) txt += ' · 副露 ' + S.melds.length + ' 组';
    if (S.win !== null) txt += ' · 和了牌 ' + MJ.tileLabel(S.win);
    if (flashMsg) txt = flashMsg;
    $('#countHint').textContent = txt;
  }

  /* ---------- 计算 ---------- */
  function buildCtx() {
    var rules = { kiriage: S.preset === 'majsoul', doubleYakuman: true };
    return {
      seatWind: S.seat === 0 ? 0 : 1,
      roundWind: 0,
      tsumo: S.tsumo,
      riichi: S.riichi,
      ippatsu: S.ippatsu,
      rinshan: S.rinshan,
      chankan: S.chankan,
      haitei: S.haitei,
      houtei: S.houtei,
      tenhou: false,
      chiihou: false,
      doraIndicators: S.dora.slice(),
      uraIndicators: S.ura.slice(),
      honba: S.honba || 0,
      riichiSticks: S.sticks || 0,
      rules: rules
    };
  }

  function compute() {
    var need = 14 - S.hand.length - S.melds.length * 3;
    if (S.hand.length === 0 && S.melds.length === 0) {
      return { ok: false, reason: '从下方牌库点选 14 张手牌；有副露时按 13 张算。' };
    }
    if (need > 0) return { ok: false, reason: '还差 ' + need + ' 张牌。' };
    if (need < 0) return { ok: false, reason: '多了 ' + (-need) + ' 张牌，先删掉几张。' };
    if (S.win === null) return { ok: false, reason: '点一张手牌，把它设为和了牌。' };
    var tiles = S.hand.slice();
    var idx = tiles.indexOf(S.win);
    if (idx < 0) return { ok: false, reason: '和了牌不在手牌中。' };
    tiles.splice(idx, 1);
    return MJ.score({ tiles: tiles, melds: S.melds, win: S.win }, buildCtx());
  }

  function payLines(b) {
    var out = [];
    b.payments.forEach(function (p) {
      if (p.count === 3) out.push('每家 ' + p.amount);
      else if (p.count === 2) out.push(p.from + ' ' + p.amount + ' ×2');
      else out.push(p.from + ' ' + p.amount);
    });
    return out;
  }

  function updateBar(main, sub, em) {
    var bar = $('#mbar');
    if (!bar) return;
    bar.querySelector('b').textContent = main;
    bar.querySelector('span').textContent = sub;
    if (em) bar.querySelector('em').textContent = em;
  }

  function setGroupHtml(tiles, extraCls) {
    var g = document.createElement('div');
    g.className = 'setgroup' + (extraCls ? ' ' + extraCls : '');
    tiles.forEach(function (t) { g.appendChild(tileEl(t, { plain: true })); });
    return g;
  }

  function renderResult() {
    var card = $('#resultCard');
    var res = compute();
    if (!res.ok) {
      card.innerHTML = '<h2>结果</h2><div class="empty">' + esc(res.reason) + '</div>';
      updateBar('—', res.reason, '去算点台 ›');
      return;
    }
    var b = res.best;
    var isDealer = S.seat === 0;
    card.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = '结果';
    card.appendChild(h2);

    var head = document.createElement('div');
    head.className = 'result-head';
    head.innerHTML = '<div class="pts">' + b.grandTotal + '<small>点</small></div>';
    card.appendChild(head);

    var meta = (isDealer ? '亲家' : '子家') + ' · ' + (S.tsumo ? '自摸' : '荣和') + ' · ';
    if (b.yakuman) meta += '役满 ×' + b.yakumanCount;
    else meta += b.han + ' 番 ' + b.fu + ' 符';
    if (b.limitName) meta += ' · ' + b.limitName;
    var m = document.createElement('div');
    m.className = 'meta';
    m.textContent = meta;
    card.appendChild(m);

    if (b.honbaExtra || b.stickExtra) {
      var ex = [];
      if (b.honbaExtra) ex.push('本场 +' + b.honbaExtra);
      if (b.stickExtra) ex.push('供托 +' + b.stickExtra);
      var m2 = document.createElement('div');
      m2.className = 'meta';
      m2.textContent = ex.join('　') + '（合计 ' + b.grandTotal + '）';
      card.appendChild(m2);
    }

    var pay = document.createElement('div');
    pay.className = 'kv';
    pay.innerHTML = '<span class="k">' + (S.tsumo ? '支付' : '放铳者支付') + '</span><span class="v">' +
      esc(S.tsumo ? payLines(b).join(' ／ ') : b.payments.map(function (p) { return p.amount; }).join(' + ')) + '</span>';
    card.appendChild(pay);

    // 牌型（用真牌面）
    if (b.sets && b.sets.length) {
      var setsWrap = document.createElement('div');
      setsWrap.className = 'sets';
      var closed = b.sets.filter(function (s) { return !s.fromMeld; });
      var open = b.sets.filter(function (s) { return s.fromMeld; });
      closed.sort(function (a, c) { return a.t - c.t; });
      closed.forEach(function (s) { setsWrap.appendChild(setGroupHtml(s.tiles)); });
      if (b.pair >= 0) setsWrap.appendChild(setGroupHtml([b.pair, b.pair], 'is-pair'));
      open.forEach(function (s) { setsWrap.appendChild(setGroupHtml(s.tiles, 'is-open')); });
      card.appendChild(setsWrap);
    }

    var yl = document.createElement('div');
    yl.className = 'yaku-list';
    b.yaku.forEach(function (y) {
      var sp = document.createElement('span');
      sp.className = 'tag' + (b.yakuman ? ' yakuman' : '');
      sp.textContent = y.name + (b.yakuman ? '' : ' ' + y.han);
      yl.appendChild(sp);
    });
    if (!b.yakuman) {
      if (b.doraHan) yl.appendChild(tagEl('宝牌 ' + b.doraHan, 'dora'));
      if (b.uraHan) yl.appendChild(tagEl('里宝 ' + b.uraHan, 'dora'));
      if (b.akaHan) yl.appendChild(tagEl('赤 ' + b.akaHan, 'dora'));
    }
    card.appendChild(yl);

    if (b.fuItems && b.fuItems.length) {
      var fu = document.createElement('div');
      fu.style.marginTop = '10px';
      b.fuItems.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'kv';
        row.innerHTML = '<span class="k">' + esc(f.label) + '</span><span class="v">' + (f.value > 0 ? '+' : '') + f.value + '</span>';
        fu.appendChild(row);
      });
      card.appendChild(fu);
    }

    if (res.alternatives && res.alternatives.length) {
      var altWrap = document.createElement('div');
      altWrap.style.marginTop = '12px';
      res.alternatives.forEach(function (a) {
        var alt = document.createElement('div');
        alt.className = 'alt';
        alt.textContent = '另有 ' + a.han + ' 番 ' + a.fu + ' 符 ' + a.total + ' 点：' + a.yaku;
        altWrap.appendChild(alt);
      });
      card.appendChild(altWrap);
    }

    var barSub = (isDealer ? '亲家' : '子家') + ' · ' + (S.tsumo ? '自摸' : '荣和') + ' · ' +
      (b.yakuman ? '役满 ×' + b.yakumanCount : b.han + ' 番 ' + b.fu + ' 符') + (b.limitName ? ' · ' + b.limitName : '');
    updateBar(b.grandTotal, barSub, '看明细 ›');
  }

  function tagEl(text, cls) {
    var sp = document.createElement('span');
    sp.className = 'tag' + (cls ? ' ' + cls : '');
    sp.textContent = text;
    return sp;
  }

  /* ---------- 事件 ---------- */
  function bindSeg(id, attr, cb) {
    var host = $(id);
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !host.contains(btn)) return;
      Array.prototype.forEach.call(host.querySelectorAll('button'), function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      cb(btn.getAttribute(attr));
    });
  }

  function renderAll() {
    renderHand();
    renderMeldList();
    renderDraft();
    renderDora();
    renderHint();
    renderResult();
  }

  function showView(v) {
    Array.prototype.forEach.call($('#tabs').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    ['calc', 'yaku', 'table'].forEach(function (k) {
      $('#view-' + k).classList.toggle('on', k === v);
    });
    var bar = $('#mbar');
    if (bar) bar.classList.toggle('on', v === 'calc');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initTabs() {
    $('#tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      showView(btn.getAttribute('data-view'));
    });
    var bar = $('#mbar');
    if (bar) bar.addEventListener('click', function () {
      showView('calc');
      var rc = $('#resultCard');
      if (rc) window.setTimeout(function () { rc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 220);
    });
  }

  function loadDemo() {
    S.hand = [1, 2, 3, 1, 2, 3, 13, 14, 15, 23, 24, 25, 25, 25];
    S.melds = []; S.draft = []; S.win = 1; S.riichi = 'riichi'; S.tsumo = false; S.seat = 1; S.preset = 'tenhou'; S.dora = []; S.ura = [];
    $('#riichiSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-riichi') === 'riichi'); });
    $('#tsumoSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tsumo') === '0'); });
    $('#seatSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-seat') === '1'); });
    renderAll();
  }

  function initCalc() {
    var modeBar = $('#modeSeg');
    modeBar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      S.mode = btn.getAttribute('data-m');
      Array.prototype.forEach.call(modeBar.querySelectorAll('button'), function (b) { b.classList.toggle('on', b === btn); });
      renderDraft();
    });

    buildPalette($('#palette'), function (t) {
      if (S.mode === 'meld') addDraft(t); else addHand(t);
    });

    bindSeg('#seatSeg', 'data-seat', function (v) { S.seat = +v; renderAll(); });
    bindSeg('#tsumoSeg', 'data-tsumo', function (v) { S.tsumo = v === '1'; renderAll(); });
    bindSeg('#riichiSeg', 'data-riichi', function (v) { S.riichi = v; renderAll(); });
    bindSeg('#presetSeg', 'data-preset', function (v) { S.preset = v; renderAll(); });
    bindSeg('#meldKindSeg', 'data-kind', function (v) {
      S.draftKind = v;
      var cap = KIND_NEED[v] || 3;
      if (S.draft.length > cap) S.draft = S.draft.slice(0, cap);
      renderDraft();
    });

    $('#extraChks').addEventListener('change', function (e) {
      var cb = e.target;
      var k = cb.getAttribute('data-k');
      S[k] = cb.checked;
      cb.parentNode.classList.toggle('on', cb.checked);
      renderAll();
    });

    $('#honba').addEventListener('input', function (e) { S.honba = +e.target.value || 0; renderAll(); });
    $('#sticks').addEventListener('input', function (e) { S.sticks = +e.target.value || 0; renderAll(); });

    $('#btnAddDora').addEventListener('click', function () {
      openPicker('选择宝牌指示牌', function (t) {
        if (S.dora.length >= 5) return;
        S.dora.push(t);
        renderAll();
      });
    });
    $('#btnAddUra').addEventListener('click', function () {
      openPicker('选择里宝牌指示牌', function (t) {
        if (S.ura.length >= 5) return;
        S.ura.push(t);
        renderAll();
      });
    });

    $('#btnClear').addEventListener('click', function () {
      S.hand = []; S.win = null; S.melds = []; S.draft = [];
      renderAll();
    });
    $('#btnUndo').addEventListener('click', function () {
      if (S.mode === 'meld' && S.draft.length) S.draft.pop();
      else if (S.hand.length) {
        var t = S.hand.pop();
        if (S.win === t && S.hand.indexOf(t) < 0) S.win = null;
      }
      renderAll();
    });
    $('#btnDemo').addEventListener('click', loadDemo);

    $('#btnAddMeld').addEventListener('click', function () {
      var need = KIND_NEED[S.draftKind] || 3;
      if (S.draft.length !== need) { flash(KIND_LABEL[S.draftKind] + '需要 ' + need + ' 张牌'); return; }
      if (S.draftKind === 'kakan') {
        var kb = MJ.redBase(S.draft[0]);
        var hit = -1;
        S.melds.forEach(function (mm, ii) {
          if (hit < 0 && mm.kind === 'pon' && MJ.redBase(mm.tiles[0]) === kb) hit = ii;
        });
        if (hit < 0) { flash('加杠需要先录入同一种牌的「碰」'); return; }
        S.melds[hit] = { kind: 'kakan', tiles: [kb, kb, kb, kb] };
        S.draft = [];
        renderAll();
        return;
      }
      if (S.melds.length >= 4) { flash('最多 4 组副露'); return; }
      if (S.hand.length + (S.melds.length + 1) * 3 > 14) { flash('手牌张数会超过 14'); return; }
      var tiles = S.draft.slice().sort(function (a, b) { return MJ.redBase(a) - MJ.redBase(b); });
      var ok = true;
      if (S.draftKind === 'chi') {
        var base = MJ.redBase(tiles[0]);
        if (base >= 27) ok = false;
        if (MJ.redBase(tiles[1]) !== base + 1 || MJ.redBase(tiles[2]) !== base + 2) ok = false;
      } else {
        var b0 = MJ.redBase(tiles[0]);
        tiles.forEach(function (t) { if (MJ.redBase(t) !== b0) ok = false; });
      }
      if (!ok) { flash('牌型不合法：吃需同花色连续三张，碰/杠需同一种牌'); return; }
      S.melds.push({ kind: S.draftKind, tiles: tiles });
      S.draft = [];
      renderAll();
    });
    $('#btnClearDraft').addEventListener('click', function () { S.draft = []; renderAll(); });
  }

  /* ---------- 选择牌弹窗 ---------- */
  function openPicker(title, cb) {
    $('#modalTitle').textContent = title;
    var host = $('#modalPalette');
    buildPalette(host, function (t) { cb(t); $('#modal').classList.remove('on'); });
    $('#modal').classList.add('on');
  }
  $('#modalClose').addEventListener('click', function () { $('#modal').classList.remove('on'); });
  $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) $('#modal').classList.remove('on'); });

  /* ---------- 役种图鉴 ---------- */
  var yakuFilter = { group: 'all', q: '' };
  function hanText(y) {
    if (y.han >= 13) return '役满';
    if (y.open === null) return y.han + ' 番（门清）';
    if (y.open < y.han) return y.han + ' 番（副露 ' + y.open + '）';
    return y.han + ' 番';
  }
  function renderYaku() {
    var body = $('#yakuBody');
    body.innerHTML = '';
    var groups = [1, 2, 3, 6, 13];
    groups.forEach(function (g) {
      if (yakuFilter.group !== 'all' && +yakuFilter.group !== g) return;
      var list = MJ.YAKU_TABLE.filter(function (y) {
        if (y.group !== g) return false;
        if (!yakuFilter.q) return true;
        var q = yakuFilter.q.toLowerCase();
        return y.name.toLowerCase().indexOf(q) >= 0 || (y.desc || '').toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return;
      var head = document.createElement('tr');
      head.className = 'group-head';
      head.innerHTML = '<td colspan="3">' + (g === 13 ? '役满' : g + ' 番') + '</td>';
      body.appendChild(head);
      list.forEach(function (y) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="name">' + esc(y.name) + '</td><td class="han">' + esc(hanText(y)) + '</td><td class="desc">' + esc(y.desc || '') + '</td>';
        body.appendChild(tr);
      });
    });
  }

  /* ---------- 点数表 ---------- */
  var ptState = { seat: 1, mode: 'ron' };
  var FU_COLS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  function payFromBase(base, dealer, tsumo) {
    if (tsumo) {
      if (dealer) { var e = ceil100(base * 2); return { text: e + ' 全', total: e * 3 }; }
      var d = ceil100(base * 2), c = ceil100(base);
      return { text: c + '-' + d, total: d + c * 2 };
    }
    var a = ceil100(base * (dealer ? 6 : 4));
    return { text: String(a), total: a };
  }
  function renderPt() {
    var dealer = ptState.seat === 0;
    var tsumo = ptState.mode === 'tsumo';
    var html = [];
    html.push('<thead><tr><th>番 \\ 符</th>');
    FU_COLS.forEach(function (f) { html.push('<th>' + f + '</th>'); });
    html.push('</tr></thead><tbody>');
    for (var han = 1; han <= 4; han++) {
      html.push('<tr><td class="head">' + han + ' 番</td>');
      FU_COLS.forEach(function (fu) {
        if ((han === 1 && fu < 30) || (fu === 25 && han < 2)) { html.push('<td class="na">—</td>'); return; }
        var lim = MJ.limitOf(han, fu, {});
        var p = payFromBase(lim.base, dealer, tsumo);
        html.push('<td>' + p.text + '</td>');
      });
      html.push('</tr>');
    }
    [[5, 5], [6, 7], [8, 10], [11, 12], [13, 13]].forEach(function (pair) {
      var lo = pair[0], hi = pair[1];
      var lim = MJ.limitOf(lo, 30, {});
      var p = payFromBase(lim.base, dealer, tsumo);
      var label = (lo === hi ? lo + ' 番' : lo + '-' + hi + ' 番');
      html.push('<tr class="limit"><td class="head">' + label + '</td><td colspan="' + FU_COLS.length + '">' + esc(lim.name) + '　' + p.text + '</td></tr>');
    });
    html.push('</tbody>');
    $('#ptTable').innerHTML = html.join('');
  }

  /* ---------- 首屏 / 品牌 ---------- */
  function initDecor() {
    var mark = $('#brandMark');
    if (mark) {
      var t = tileEl(32, { plain: true });
      mark.appendChild(t);
    }
    var host = $('#heroTiles');
    if (!host) return;
    var hand = [1, 2, 3, 1, 2, 3, 13, 14, 15, 23, 24, 25, 25, 25];
    hand.forEach(function (id, i) {
      var t = tileEl(id, { plain: true });
      var mid = (hand.length - 1) / 2;
      var d = i - mid;
      t.style.setProperty('--rot', (d * 1.9).toFixed(2) + 'deg');
      t.style.setProperty('--dy', (Math.pow(Math.abs(d), 1.7) * 0.75).toFixed(1) + 'px');
      t.style.animationDelay = (i * 32) + 'ms';
      host.appendChild(t);
    });
  }

  /* ---------- 启动 ---------- */
  initDecor();
  initTabs();
  initCalc();
  bindSeg('#yakuGroupSeg', 'data-g', function (v) { yakuFilter.group = v; renderYaku(); });
  $('#yakuSearch').addEventListener('input', function (e) { yakuFilter.q = e.target.value.trim(); renderYaku(); });
  bindSeg('#ptSeatSeg', 'data-seat', function (v) { ptState.seat = +v; renderPt(); });
  bindSeg('#ptModeSeg', 'data-mode', function (v) { ptState.mode = v; renderPt(); });
  renderYaku();
  renderPt();
  renderAll();

  function applyHash() {
    var h = (location.hash || '').replace('#', '');
    if (h === 'demo') { loadDemo(); showView('calc'); }
    else if (h === 'calc' || h === 'yaku' || h === 'table') { showView(h); }
  }
  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
