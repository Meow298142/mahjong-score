/* ============================================================
 * 日麻算点引擎  engine.js  v0.1
 * 纯函数、零依赖。可在浏览器（全局 MJ）与 Node（module.exports）使用。
 * ============================================================ */
(function (global) {
  'use strict';

  var HONORS = ['东', '南', '西', '北', '白', '发', '中'];
  var CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var SUIT_CN = ['万', '筒', '索'];
  var DRAGON_BASE = 31;          // 白 发 中
  var WIND_BASE = 27;            // 东 南 西 北

  /* ---------------- 牌 ---------------- */

  function redBase(t) {
    if (t === 34) return 4;
    if (t === 35) return 13;
    if (t === 36) return 22;
    return t;
  }
  function isRed(t) { return t >= 34; }
  function isHonor(t) { return !isRed(t) && t >= 27; }
  function isTerminal(t) { return !isRed(t) && t < 27 && (t % 9 === 0 || t % 9 === 8); }
  function isYaochu(t) { t = redBase(t); return isHonor(t) || isTerminal(t); }
  function isSimple(t) { return !isYaochu(t); }
  function suitOf(t) { t = redBase(t); return t < 9 ? 0 : t < 18 ? 1 : t < 27 ? 2 : 3; }
  function rankOf(t) { t = redBase(t); return t < 27 ? t % 9 : -1; }

  function tileLabel(t) {
    if (isRed(t)) return '赤' + tileLabel(redBase(t));
    if (t >= 27) return HONORS[t - 27];
    return CN[t % 9] + SUIT_CN[Math.floor(t / 9)];
  }

  function nextDora(t) {
    t = redBase(t);
    if (t < 27) { var s = Math.floor(t / 9), r = t % 9; return s * 9 + (r + 1) % 9; }
    if (t < 31) return 27 + (t - 27 + 1) % 4;
    return 31 + (t - 31 + 1) % 3;
  }

  /* ---------------- 手牌标准化 ---------------- */

  function toCounts(tiles) {
    var c = new Array(34).fill(0), aka = 0;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (t >= 34) { c[redBase(t)]++; aka++; } else { c[t]++; }
    }
    return { c: c, aka: aka };
  }

  /* ---------------- 分解 ---------------- */

  function enumSets(counts, start, acc, out) {
    var i = start;
    while (i < 34 && counts[i] === 0) i++;
    if (i === 34) { out.push(acc.slice()); return; }
    if (counts[i] >= 3) {
      counts[i] -= 3; acc.push({ t: i, type: 'trip' });
      enumSets(counts, i, acc, out);
      acc.pop(); counts[i] += 3;
    }
    if (i < 27 && (i % 9) <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      acc.push({ t: i, type: 'run' });
      enumSets(counts, i, acc, out);
      acc.pop();
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
  }

  function decomposeStd(counts, needSets) {
    var res = [];
    for (var p = 0; p < 34; p++) {
      if (counts[p] < 2) continue;
      counts[p] -= 2;
      var found = [];
      enumSets(counts, 0, [], found);
      counts[p] += 2;
      for (var k = 0; k < found.length; k++) {
        if (found[k].length === needSets) res.push({ type: 'std', pair: p, sets: found[k] });
      }
    }
    return res;
  }

  function isChiitoi(c) {
    var pairs = 0;
    for (var i = 0; i < 34; i++) {
      if (c[i] === 0) continue;
      if (c[i] !== 2) return false;
      pairs++;
    }
    return pairs === 7;
  }

  var KOKUSHI_TILES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  function isKokushi(c) {
    var total = 0, dup = 0;
    for (var i = 0; i < 34; i++) {
      if (c[i] === 0) continue;
      if (KOKUSHI_TILES.indexOf(i) < 0) return false;
      if (c[i] === 2) dup++; else if (c[i] !== 1) return false;
      total += c[i];
    }
    return total === 14 && dup === 1;
  }

  /* ---------------- 副露 ---------------- */

  function meldToSet(m) {
    var kind = m.kind;
    var open = (kind === 'chi' || kind === 'pon' || kind === 'minkan' || kind === 'kakan');
    var kan = (kind === 'minkan' || kind === 'ankan' || kind === 'kakan') ? kind : 0;
    var t = redBase(m.tiles[0]);
    var type = (kind === 'chi') ? 'run' : 'trip';
    var count = kan ? 4 : 3;
    var tiles = [];
    if (type === 'run') { for (var i = 0; i < 3; i++) tiles.push(t + i); }
    else { for (var j = 0; j < count; j++) tiles.push(t); }
    return {
      t: t, type: type, open: open, kan: kan, count: count, tiles: tiles,
      concealed: !open, fromMeld: true
    };
  }

  function meldsMenzen(melds) {
    for (var i = 0; i < melds.length; i++) {
      var k = melds[i].kind;
      if (k !== 'ankan') return false;
    }
    return true;
  }

  /* ---------------- 和了形展开（含待ち形） ---------------- */

  function buildInterp(dec, melds, winTile, ctx) {
    var sets = [];
    for (var i = 0; i < melds.length; i++) sets.push(meldToSet(melds[i]));
    var closedSets = [];
    for (var j = 0; j < dec.sets.length; j++) {
      var s = dec.sets[j];
      closedSets.push({
        t: s.t, type: s.type, open: false, kan: 0,
        count: 3,
        tiles: s.type === 'run' ? [s.t, s.t + 1, s.t + 2] : [s.t, s.t, s.t],
        concealed: true, fromMeld: false
      });
    }
    for (var k = 0; k < closedSets.length; k++) sets.push(closedSets[k]);
    return {
      type: 'std', pair: dec.pair, sets: sets, closedSets: closedSets,
      menzen: meldsMenzen(melds), wait: null, ronTrip: -1, winTile: winTile, ctx: ctx
    };
  }

  function expandInterps(dec, melds, winTile, ctx, out) {
    if (dec.type === 'kokushi') {
      out.push({ type: 'kokushi', pair: -1, sets: [], menzen: true, wait: null, ronTrip: -1, winTile: winTile, ctx: ctx });
      return;
    }
    if (dec.type === 'chiitoi') {
      out.push({ type: 'chiitoi', pair: -1, sets: [], menzen: true, wait: null, ronTrip: -1, winTile: winTile, ctx: ctx });
      return;
    }
    var base = buildInterp(dec, melds, winTile, ctx);
    var push = function (wait, ronTrip, closedIdx) {
      var it = {
        type: 'std', pair: base.pair, sets: [], closedSets: [],
        menzen: base.menzen, wait: wait, ronTrip: -1, winTile: winTile, ctx: ctx
      };
      // 复制集合，标记荣和刻子
      var meldCount = melds.length;
      for (var i = 0; i < base.sets.length; i++) {
        var s = base.sets[i];
        var copy = {
          t: s.t, type: s.type, open: s.open, kan: s.kan, count: s.count,
          tiles: s.tiles.slice(), concealed: s.concealed, fromMeld: s.fromMeld
        };
        if (!s.fromMeld && i - meldCount === closedIdx && ronTrip && !ctx.tsumo) {
          copy.concealed = false;
          copy.open = true;
        }
        it.sets.push(copy);
        if (!s.fromMeld) it.closedSets.push(copy);
      }
      out.push(it);
    };

    if (base.pair === winTile) push('tanki', false, -1);

    for (var ci = 0; ci < base.closedSets.length; ci++) {
      var s = base.closedSets[ci];
      if (s.type === 'trip' && s.t === winTile) push('shanpon', true, ci);
      if (s.type === 'run' && winTile >= s.t && winTile <= s.t + 2) {
        var w;
        if (winTile === s.t + 1) w = 'kanchan';
        else if ((s.t % 9 === 0 && winTile === s.t + 2) || (s.t % 9 === 6 && winTile === s.t)) w = 'penchan';
        else w = 'ryanmen';
        push(w, false, ci);
      }
    }
    if (out.length === 0 && base.pair === winTile) push('tanki', false, -1);
  }

  /* ---------------- 役判定 ---------------- */

  function isValuePair(t, ctx) {
    t = redBase(t);
    if (t >= DRAGON_BASE) return true;
    if (t >= WIND_BASE) {
      var w = t - WIND_BASE;
      return w === ctx.seatWind || w === ctx.roundWind;
    }
    return false;
  }

  function allTilesOf(it) {
    var arr = [];
    if (it.pair >= 0) { arr.push(it.pair); arr.push(it.pair); }
    for (var i = 0; i < it.sets.length; i++) {
      var s = it.sets[i];
      for (var j = 0; j < s.tiles.length; j++) arr.push(s.tiles[j]);
    }
    return arr;
  }

  function isYakumanOnly(it) { return it.type === 'kokushi'; }

  function kazoeOk() { return true; }

  function evalYaku(it, ctx) {
    var yaku = [];   // {name, han, yakuman:bool}
    var rules = ctx.rules || {};
    var dbl = rules.doubleYakuman !== false;

    if (it.type === 'kokushi') {
      var thirteen = false;
      if (it.countsForCheck && it.winTile >= 0) {
        thirteen = it.countsForCheck[redBase(it.winTile)] === 2;
      }
      if (ctx.tenhou) yaku.push({ name: '天和', yakuman: 1 });
      if (ctx.chiihou) yaku.push({ name: '地和', yakuman: 1 });
      yaku.push({ name: thirteen ? '国士无双十三面' : '国士无双', yakuman: 1, double: thirteen && dbl });
      return { yaku: yaku, yakuman: true };
    }

    if (it.type === 'chiitoi') {
      var tiles = [];
      for (var q = 0; q < 34; q++) if (it.chiitoiCounts && it.chiitoiCounts[q]) { for (var qq = 0; qq < it.chiitoiCounts[q]; qq++) tiles.push(q); }
      var allYao = true, allHon = true, allTerm = true, greenAll = true, oneS = -1;
      for (var q2 = 0; q2 < tiles.length; q2++) {
        var qt = tiles[q2];
        if (!isYaochu(qt)) allYao = false;
        if (!isHonor(qt)) allHon = false;
        if (!isTerminal(qt)) allTerm = false;
        if (!(qt === 19 || qt === 20 || qt === 21 || qt === 23 || qt === 25 || qt === 32)) greenAll = false;
        if (qt < 27) { var qs = Math.floor(qt / 9); if (oneS === -1) oneS = qs; else if (oneS !== -2 && oneS !== qs) oneS = -2; }
      }
      var hasH = false;
      for (var q3 = 0; q3 < tiles.length; q3++) if (isHonor(tiles[q3])) hasH = true;

      if (ctx.tenhou) yaku.push({ name: '天和', yakuman: 1 });
      if (ctx.chiihou) yaku.push({ name: '地和', yakuman: 1 });
      if (allHon) yaku.push({ name: '字一色', yakuman: 1 });
      if (allTerm) yaku.push({ name: '清老头', yakuman: 1 });
      if (greenAll) yaku.push({ name: '绿一色', yakuman: 1 });
      if (yaku.length) return { yaku: yaku, yakuman: true };

      if (it.menzen && ctx.riichi === 'riichi') yaku.push({ name: '立直', han: 1 });
      if (it.menzen && ctx.riichi === 'double') yaku.push({ name: '双立直', han: 2 });
      if (it.menzen && ctx.ippatsu && ctx.riichi !== 'none') yaku.push({ name: '一发', han: 1 });
      if (it.menzen && ctx.tsumo) yaku.push({ name: '门前清自摸和', han: 1 });
      yaku.push({ name: '七对子', han: 2 });
      if (allYao && !allTerm) yaku.push({ name: '混老头', han: 2 });
      if (oneS >= 0) {
        if (hasH) yaku.push({ name: '混一色', han: it.menzen ? 3 : 2 });
        else yaku.push({ name: '清一色', han: it.menzen ? 6 : 5 });
      }
      return { yaku: yaku, yakuman: false };
    }

    var sets = it.sets, pair = it.pair;
    var menzen = it.menzen;
    var allTiles = allTilesOf(it);

    var runs = [], trips = [], kans = [];
    for (var i = 0; i < sets.length; i++) {
      if (sets[i].type === 'run') runs.push(sets[i]);
      else { trips.push(sets[i]); if (sets[i].kan) kans.push(sets[i]); }
    }
    var concealedTrips = 0;
    for (var j = 0; j < trips.length; j++) if (trips[j].concealed) concealedTrips++;

    var hasHonor = false, allYaochu = true, allTerminal = true, allHonor = true, oneSuit = -1, suitCount = [0, 0, 0, 0];
    for (var k = 0; k < allTiles.length; k++) {
      var t = redBase(allTiles[k]);
      if (isHonor(t)) hasHonor = true;
      if (!isYaochu(t)) allYaochu = false;
      if (!isTerminal(t)) allTerminal = false;
      if (!isHonor(t)) allHonor = false;
      var s = suitOf(t);
      suitCount[s]++;
      if (s < 3) { if (oneSuit === -1) oneSuit = s; else if (oneSuit !== -2 && oneSuit !== s) oneSuit = -2; }
    }

    /* ---- 役满 ---- */
    var yakuman = [];
    if (ctx.tenhou) yakuman.push({ name: '天和', yakuman: 1 });
    if (ctx.chiihou) yakuman.push({ name: '地和', yakuman: 1 });

    if (menzen && concealedTrips === 4) {
      var tanki = it.wait === 'tanki';
      yakuman.push({ name: tanki ? '四暗刻单骑' : '四暗刻', yakuman: 1, double: tanki && dbl });
    }
    var dragonTrips = 0, windTrips = 0;
    for (var d = 0; d < trips.length; d++) {
      var tt = trips[d].t;
      if (tt >= 31) dragonTrips++;
      else if (tt >= 27) windTrips++;
    }
    if (dragonTrips === 3) yakuman.push({ name: '大三元', yakuman: 1 });
    if (windTrips === 4) yakuman.push({ name: '大四喜', yakuman: 1, double: dbl });
    else if (windTrips === 3 && pair >= 27 && pair < 31) yakuman.push({ name: '小四喜', yakuman: 1 });
    if (kans.length === 4) yakuman.push({ name: '四杠子', yakuman: 1 });
    if (allHonor) yakuman.push({ name: '字一色', yakuman: 1 });
    if (allTerminal) yakuman.push({ name: '清老头', yakuman: 1 });

    // 绿一色
    var green = true;
    for (var g = 0; g < allTiles.length; g++) {
      var gt = redBase(allTiles[g]);
      if (!(gt === 19 || gt === 20 || gt === 21 || gt === 23 || gt === 25 || gt === 32)) { green = false; break; }
    }
    if (green) yakuman.push({ name: '绿一色', yakuman: 1 });

    // 九莲宝灯
    if (menzen && it.closedSets.length === 4) {
      var suitSet = [];
      var onlyOne = true, sc = -1;
      for (var u = 0; u < allTiles.length; u++) {
        var ut = redBase(allTiles[u]);
        if (ut >= 27) { onlyOne = false; break; }
        var us = Math.floor(ut / 9);
        if (sc < 0) sc = us; else if (sc !== us) { onlyOne = false; break; }
      }
      if (onlyOne) {
        var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (var v = 0; v < allTiles.length; v++) cnt[redBase(allTiles[v]) % 9]++;
        var ok = cnt[0] >= 3 && cnt[8] >= 3;
        for (var w = 1; w <= 7; w++) if (cnt[w] < 1) ok = false;
        if (ok) {
          var pure = cnt[0] === 4 && cnt[8] === 4;
          yakuman.push({ name: pure ? '纯正九莲宝灯' : '九莲宝灯', yakuman: 1, double: pure && dbl });
        }
      }
    }

    if (yakuman.length) return { yaku: yakuman, yakuman: true };

    /* ---- 通常役 ---- */
    if (menzen && ctx.riichi === 'riichi') yaku.push({ name: '立直', han: 1 });
    if (menzen && ctx.riichi === 'double') yaku.push({ name: '双立直', han: 2 });
    if (menzen && ctx.ippatsu && ctx.riichi !== 'none') yaku.push({ name: '一发', han: 1 });
    if (menzen && ctx.tsumo) yaku.push({ name: '门前清自摸和', han: 1 });

    // 平和
    var allRuns = runs.length === 4;
    if (menzen && allRuns && !isValuePair(pair, ctx) && it.wait === 'ryanmen') {
      yaku.push({ name: '平和', han: 1 });
    }

    // 断幺九
    var tanyao = true;
    for (var y = 0; y < allTiles.length; y++) if (!isSimple(allTiles[y])) { tanyao = false; break; }
    if (tanyao) yaku.push({ name: '断幺九', han: 1 });

    // 一杯口 / 二杯口
    if (menzen) {
      var runMap = {};
      for (var r = 0; r < runs.length; r++) {
        if (runs[r].fromMeld) continue;
        runMap[runs[r].t] = (runMap[runs[r].t] || 0) + 1;
      }
      var pairCount = 0;
      for (var key in runMap) if (runMap[key] >= 2) pairCount++;
      if (pairCount >= 2) yaku.push({ name: '二杯口', han: 3 });
      else if (pairCount === 1) yaku.push({ name: '一杯口', han: 1 });
    }

    // 役牌
    for (var mm = 0; mm < trips.length; mm++) {
      var mt = trips[mm].t;
      if (mt < 27) continue;
      var h = 0;
      if (mt >= DRAGON_BASE) h++;
      else {
        if (mt - WIND_BASE === ctx.seatWind) h++;
        if (mt - WIND_BASE === ctx.roundWind) h++;
      }
      if (h > 0) yaku.push({ name: '役牌·' + HONORS[mt - 27], han: h });
    }

    if (ctx.rinshan) yaku.push({ name: '岭上开花', han: 1 });
    if (ctx.chankan) yaku.push({ name: '抢杠', han: 1 });
    if (ctx.haitei) yaku.push({ name: '海底摸月', han: 1 });
    if (ctx.houtei) yaku.push({ name: '河底捞鱼', han: 1 });

    // 三色同顺
    var runSet = {};
    for (var rs = 0; rs < runs.length; rs++) runSet[runs[rs].t] = true;
    for (var n = 0; n <= 6; n++) {
      if (runSet[n] && runSet[n + 9] && runSet[n + 18]) { yaku.push({ name: '三色同顺', han: menzen ? 2 : 1 }); break; }
    }
    // 一气通贯
    for (var s2 = 0; s2 < 3; s2++) {
      if (runSet[s2 * 9] && runSet[s2 * 9 + 3] && runSet[s2 * 9 + 6]) { yaku.push({ name: '一气通贯', han: menzen ? 2 : 1 }); break; }
    }
    // 三色同刻
    var tripSet = {};
    for (var ts = 0; ts < trips.length; ts++) if (trips[ts].t < 27) tripSet[trips[ts].t] = true;
    for (var n2 = 0; n2 <= 8; n2++) {
      if (tripSet[n2] && tripSet[n2 + 9] && tripSet[n2 + 18]) { yaku.push({ name: '三色同刻', han: 2 }); break; }
    }

    // 全带 / 混老头
    var honroutou = allYaochu;
    var chanta = false, junchan = false;
    if (!honroutou) {
      var every = true;
      for (var e = 0; e < sets.length; e++) {
        var hit = false;
        for (var f = 0; f < sets[e].tiles.length; f++) if (isYaochu(sets[e].tiles[f])) { hit = true; break; }
        if (!hit) { every = false; break; }
      }
      if (every && isYaochu(pair) && runs.length > 0) {
        if (hasHonor) chanta = true; else junchan = true;
      }
    }
    if (honroutou) yaku.push({ name: '混老头', han: 2 });
    else if (junchan) yaku.push({ name: '纯全带幺九', han: menzen ? 3 : 2 });
    else if (chanta) yaku.push({ name: '混全带幺九', han: menzen ? 2 : 1 });

    // 对对和
    if (runs.length === 0) yaku.push({ name: '对对和', han: 2 });
    // 三暗刻
    if (concealedTrips === 3) yaku.push({ name: '三暗刻', han: 2 });
    // 三杠子
    if (kans.length === 3) yaku.push({ name: '三杠子', han: 2 });
    // 小三元
    if (dragonTrips === 2 && pair >= 31) yaku.push({ name: '小三元', han: 2 });

    // 染手
    var hasHonorsInHand = hasHonor;
    if (oneSuit >= 0) {
      if (hasHonorsInHand) yaku.push({ name: '混一色', han: menzen ? 3 : 2 });
      else yaku.push({ name: '清一色', han: menzen ? 6 : 5 });
    }

    return { yaku: yaku, yakuman: false };
  }

  /* ---------------- 符 ---------------- */

  function calcFu(it, ctx, yakuList) {
    var rules = ctx.rules || {};
    if (it.type === 'chiitoi') return { fu: 25, items: [{ label: '七对子固定', value: 25 }] };

    var hasPinfu = yakuList.some(function (y) { return y.name === '平和'; });
    var allRuns = it.sets.length > 0 && it.sets.every(function (s) { return s.type === 'run'; });

    if (hasPinfu) {
      return ctx.tsumo
        ? { fu: 20, items: [{ label: '平和自摸固定', value: 20 }] }
        : { fu: 30, items: [{ label: '副底', value: 20 }, { label: '门前荣和', value: 10 }] };
    }

    // 食い平和形
    if (!it.menzen && allRuns && it.wait === 'ryanmen' && !isValuePair(it.pair, ctx)) {
      if (ctx.tsumo) return { fu: 30, items: [{ label: '副底', value: 20 }, { label: '自摸', value: 2 }, { label: '切上', value: 8 }] };
      return { fu: 20, items: [{ label: '食い平和形固定', value: 20 }] };
    }

    var items = [], fu = 20;
    items.push({ label: '副底', value: 20 });
    if (!ctx.tsumo && it.menzen) { fu += 10; items.push({ label: '门前荣和', value: 10 }); }
    if (ctx.tsumo) { fu += 2; items.push({ label: '自摸', value: 2 }); }

    // 雀头
    var pairFu = 0;
    if (isValuePair(it.pair, ctx)) {
      var pt = redBase(it.pair);
      if (pt >= 31) pairFu = 2;
      else {
        var w = pt - WIND_BASE;
        pairFu = (w === ctx.seatWind ? 2 : 0) + (w === ctx.roundWind ? 2 : 0);
        if (pairFu === 4) pairFu = rules.doubleWindFu || 4;
      }
      if (pairFu > 0) { fu += pairFu; items.push({ label: '雀头（' + tileLabel(it.pair) + '）', value: pairFu }); }
    }

    // 待ち
    if (it.wait === 'tanki' || it.wait === 'kanchan' || it.wait === 'penchan') {
      fu += 2; items.push({ label: '待ち（' + ({ tanki: '单骑', kanchan: '嵌张', penchan: '边张' })[it.wait] + '）', value: 2 });
    }

    // 面子
    var setFu = 0;
    for (var i = 0; i < it.sets.length; i++) {
      var s = it.sets[i];
      if (s.type === 'run') continue;
      var yao = isYaochu(s.t);
      var v = 0;
      if (s.kan) v = s.concealed ? (yao ? 32 : 16) : (yao ? 16 : 8);
      else v = s.concealed ? (yao ? 8 : 4) : (yao ? 4 : 2);
      setFu += v;
      items.push({
        label: (s.kan ? '杠' : '刻') + '·' + tileLabel(s.t) + (s.concealed ? '（暗）' : '（明）'),
        value: v
      });
    }
    fu += setFu;

    var rounded = Math.ceil(fu / 10) * 10;
    if (rounded !== fu) items.push({ label: '切上', value: rounded - fu });
    return { fu: rounded, items: items };
  }

  /* ---------------- 点数 ---------------- */

  function ceil100(x) { return Math.ceil(x / 100) * 100; }

  function limitOf(han, fu, rules) {
    if (han >= 13) return { base: 8000, name: '役满' };
    if (han >= 11) return { base: 6000, name: '三倍满' };
    if (han >= 8) return { base: 4000, name: '倍满' };
    if (han >= 6) return { base: 3000, name: '跳满' };
    if (han >= 5) return { base: 2000, name: '满贯' };
    var b = fu * Math.pow(2, han + 2);
    if (b > 2000) return { base: 2000, name: '满贯' };
    if (rules.kiriage && b === 1920) return { base: 2000, name: '满贯（切上）' };
    return { base: b, name: null };
  }

  function calcPayments(base, ctx) {
    var dealer = ctx.seatWind === 0;
    if (ctx.tsumo) {
      if (dealer) {
        var each = ceil100(base * 2);
        return { items: [{ from: '每家', amount: each, count: 3 }], total: each * 3 };
      }
      var d = ceil100(base * 2), c = ceil100(base);
      return { items: [{ from: '亲家', amount: d, count: 1 }, { from: '子家', amount: c, count: 2 }], total: d + c * 2 };
    }
    var amt = ceil100(base * (dealer ? 6 : 4));
    return { items: [{ from: '放铳者', amount: amt, count: 1 }], total: amt };
  }

  /* ---------------- 主入口 ---------------- */

  function score(input, ctx) {
    var rules = ctx.rules || {};
    var tiles = input.tiles.slice();
    var win = input.win;
    if (win === null || win === undefined) {
      return { ok: false, reason: '还没有指定和了牌' };
    }
    var all = tiles.concat([win]);
    if (all.length !== 14 - 3 * input.melds.length) {
      return { ok: false, reason: '牌数不对：还需要 ' + (14 - 3 * input.melds.length - all.length) + ' 张' };
    }
    var norm = toCounts(all);
    var counts = norm.c;
    var aka = norm.aka;
    var doraCounts = counts.slice();
    for (var mi = 0; mi < input.melds.length; mi++) {
      var mtiles = input.melds[mi].tiles;
      for (var mj = 0; mj < mtiles.length; mj++) {
        if (isRed(mtiles[mj])) aka++;
        doraCounts[redBase(mtiles[mj])]++;
      }
    }
    // 每种牌最多 4 张
    for (var i = 0; i < 34; i++) {
      if (counts[i] > 4) return { ok: false, reason: tileLabel(i) + ' 超过 4 张' };
    }

    var decs = [];
    if (input.melds.length === 0) {
      if (isKokushi(counts)) decs.push({ type: 'kokushi' });
      if (isChiitoi(counts)) decs.push({ type: 'chiitoi' });
    }
    var need = 4 - input.melds.length;
    decs = decs.concat(decomposeStd(counts, need));
    if (decs.length === 0) return { ok: false, reason: '这不是和了形' };

    // 宝牌
    var doraTiles = [], uraTiles = [];
    for (var d = 0; d < (ctx.doraIndicators || []).length; d++) doraTiles.push(nextDora(ctx.doraIndicators[d]));
    if (ctx.riichi !== 'none') {
      for (var u = 0; u < (ctx.uraIndicators || []).length; u++) uraTiles.push(nextDora(ctx.uraIndicators[u]));
    }
    var doraCount = 0, uraCount = 0;
    for (var dt = 0; dt < doraTiles.length; dt++) doraCount += doraCounts[doraTiles[dt]] || 0;
    for (var ut = 0; ut < uraTiles.length; ut++) uraCount += doraCounts[uraTiles[ut]] || 0;

    var results = [];
    for (var di = 0; di < decs.length; di++) {
      var dec = decs[di];
      var interps = [];
      if (dec.type === 'kokushi') {
        var itk = { type: 'kokushi', pair: -1, sets: [], menzen: true, wait: null, ronTrip: -1, winTile: win, ctx: ctx, countsForCheck: counts };
        interps.push(itk);
      } else if (dec.type === 'chiitoi') {
        interps.push({ type: 'chiitoi', pair: -1, sets: [], menzen: true, wait: null, ronTrip: -1, winTile: win, ctx: ctx, chiitoiCounts: counts });
      } else {
        expandInterps(dec, input.melds, win, ctx, interps);
      }

      for (var ii = 0; ii < interps.length; ii++) {
        var it = interps[ii];
        var ev = evalYaku(it, ctx);
        var yakuList = ev.yaku.slice();
        var isYakuman = ev.yakuman;
        var han, fu, fuItems, yakumanCount = 0;

        if (isYakuman) {
          for (var yk = 0; yk < yakuList.length; yk++) yakumanCount += yakuList[yk].double ? 2 : 1;
          han = 13 * yakumanCount;
          fu = 0; fuItems = [];
        } else {
          // 七对子的混老头/字一色等已经在通用路径遗漏，这里补
          han = 0;
          for (var y2 = 0; y2 < yakuList.length; y2++) han += yakuList[y2].han;
          var dHan = doraCount + uraCount + aka;
          var allHan = han + dHan;
          var fuRes = calcFu(it, ctx, yakuList);
          fu = fuRes.fu; fuItems = fuRes.items;
          han = allHan;
        }

        if (han <= 0) continue;

        var lim = limitOf(isYakuman ? 13 : han, fu || 30, rules);
        if (isYakuman) lim = { base: 8000 * yakumanCount, name: yakumanCount > 1 ? '役满×' + yakumanCount : '役满' };
        var pay = calcPayments(lim.base, ctx);
        var honbaExtra = ctx.tsumo ? 100 * (ctx.honba || 0) * 3 : 300 * (ctx.honba || 0);
        var stickExtra = 1000 * (ctx.riichiSticks || 0);

        results.push({
          yaku: yakuList, yakuman: isYakuman, yakumanCount: yakumanCount,
          han: isYakuman ? 13 * yakumanCount : han, baseHan: han - (isYakuman ? 0 : (doraCount + uraCount + aka)),
          doraHan: isYakuman ? 0 : doraCount, uraHan: isYakuman ? 0 : uraCount, akaHan: isYakuman ? 0 : aka,
          fu: fu, fuItems: fuItems, base: lim.base, limitName: lim.name,
          payments: pay.items, total: pay.total, honbaExtra: honbaExtra, stickExtra: stickExtra,
          grandTotal: pay.total + honbaExtra + stickExtra,
          wait: it.wait, pair: it.pair, sets: it.sets, type: it.type
        });
      }
    }

    if (results.length === 0) {
      return { ok: false, reason: '无役：这副牌没有可以成立的役（宝牌不能单独和牌）' };
    }

    results.sort(function (a, b) {
      if (b.grandTotal !== a.grandTotal) return b.grandTotal - a.grandTotal;
      if (b.han !== a.han) return b.han - a.han;
      return b.fu - a.fu;
    });

    var best = results[0];
    var alts = [];
    for (var z = 1; z < results.length; z++) {
      var r = results[z];
      if (r.grandTotal === best.grandTotal && r.han === best.han && r.fu === best.fu) continue;
      alts.push({ han: r.han, fu: r.fu, total: r.grandTotal, yaku: r.yaku.map(function (y) { return y.name; }).join('·') });
      if (alts.length >= 3) break;
    }

    return {
      ok: true, best: best, alternatives: alts,
      dealer: ctx.seatWind === 0, tsumo: ctx.tsumo
    };
  }

  /* ---------------- 役种表（供 UI 使用） ---------------- */

  var YAKU_TABLE = [
    { name: '立直', han: 1, open: null, group: 1, desc: '门前听牌后宣言，支付 1000 点供托。' },
    { name: '双立直', han: 2, open: null, group: 1, desc: '第一巡宣言立直。' },
    { name: '一发', han: 1, open: 1, group: 1, desc: '立直后一巡内和牌，中间无鸣牌。' },
    { name: '门前清自摸和', han: 1, open: null, group: 1, desc: '门清状态下自摸。' },
    { name: '平和', han: 1, open: null, group: 1, desc: '四组顺子 + 非役牌雀头 + 两面待。' },
    { name: '断幺九', han: 1, open: 1, group: 1, desc: '全部由 2–8 的数牌组成。' },
    { name: '一杯口', han: 1, open: null, group: 1, desc: '两组完全相同的顺子。' },
    { name: '役牌', han: 1, open: 1, group: 1, desc: '白/发/中/自风/场风的刻子，每组 1 番。' },
    { name: '岭上开花', han: 1, open: 1, group: 1, desc: '杠后摸岭上牌和牌。' },
    { name: '抢杠', han: 1, open: 1, group: 1, desc: '抢他人加杠的牌和牌。' },
    { name: '海底摸月', han: 1, open: 1, group: 1, desc: '摸最后一张牌和牌。' },
    { name: '河底捞鱼', han: 1, open: 1, group: 1, desc: '荣和最后一张舍牌。' },
    { name: '三色同顺', han: 2, open: 1, group: 2, desc: '万筒索三色同一组顺子。' },
    { name: '一气通贯', han: 2, open: 1, group: 2, desc: '同一花色 123+456+789。' },
    { name: '混全带幺九', han: 2, open: 1, group: 2, desc: '每组面子与雀头都含幺九，且含字牌。' },
    { name: '七对子', han: 2, open: null, group: 2, desc: '七个不同的对子，固定 25 符。' },
    { name: '对对和', han: 2, open: 2, group: 2, desc: '四组刻子/杠。' },
    { name: '三暗刻', han: 2, open: 2, group: 2, desc: '三组暗刻（荣和的那组不算暗）。' },
    { name: '三杠子', han: 2, open: 2, group: 2, desc: '三组杠。' },
    { name: '小三元', han: 2, open: 2, group: 2, desc: '两组三元牌刻子 + 三元牌雀头。' },
    { name: '混老头', han: 2, open: 2, group: 2, desc: '全部由幺九与字牌组成。' },
    { name: '三色同刻', han: 2, open: 2, group: 2, desc: '万筒索三色同一数字的刻子。' },
    { name: '二杯口', han: 3, open: null, group: 3, desc: '两组一杯口。' },
    { name: '纯全带幺九', han: 3, open: 2, group: 3, desc: '每组面子与雀头都含幺九，不含字牌。' },
    { name: '混一色', han: 3, open: 2, group: 3, desc: '一种花色 + 字牌。' },
    { name: '清一色', han: 6, open: 5, group: 6, desc: '全部为一种花色。' },
    { name: '国士无双', han: 13, open: null, group: 13, desc: '十三种幺九字牌各一张 + 其中一张成对。' },
    { name: '四暗刻', han: 13, open: null, group: 13, desc: '四组暗刻。单骑待为双倍役满。' },
    { name: '大三元', han: 13, open: 13, group: 13, desc: '白/发/中三组刻子。' },
    { name: '小四喜', han: 13, open: 13, group: 13, desc: '三组风牌刻子 + 风牌雀头。' },
    { name: '大四喜', han: 13, open: 13, group: 13, desc: '四组风牌刻子。' },
    { name: '字一色', han: 13, open: 13, group: 13, desc: '全部由字牌组成。' },
    { name: '绿一色', han: 13, open: 13, group: 13, desc: '只由 2/3/4/6/8 索与发组成。' },
    { name: '清老头', han: 13, open: 13, group: 13, desc: '全部由 1/9 组成。' },
    { name: '九莲宝灯', han: 13, open: null, group: 13, desc: '门清同一花色 1112345678999 + 任一张。' },
    { name: '四杠子', han: 13, open: 13, group: 13, desc: '四组杠。' },
    { name: '天和', han: 13, open: null, group: 13, desc: '庄家配牌即和。' },
    { name: '地和', han: 13, open: null, group: 13, desc: '闲家第一巡自摸。' }
  ];

  var api = {
    score: score, tileLabel: tileLabel, redBase: redBase, isRed: isRed,
    isHonor: isHonor, isTerminal: isTerminal, isYaochu: isYaochu, isSimple: isSimple,
    suitOf: suitOf, rankOf: rankOf, nextDora: nextDora, toCounts: toCounts,
    limitOf: limitOf, YAKU_TABLE: YAKU_TABLE, HONORS: HONORS, CN: CN, SUIT_CN: SUIT_CN
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MJ = api;
})(typeof window !== 'undefined' ? window : globalThis);