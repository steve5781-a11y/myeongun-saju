(function () {
  'use strict';
  var S = window.Saju, T = window.SajuText, P = window.PersonaText, Z = window.ZodiacText;
  var EL = S.EL, EH = S.EL_HANJA;
  var STORE_KEY = 'myeongun.profile';
  var MODE_KEY = 'myeongun.mode';
  var state = { profile: null, result: null, tab: 'saju', todayOffset: 0, pendingTab: 'saju', mode: load(MODE_KEY) === 'fact' ? 'fact' : 'basic', zSel: null, zManual: false };

  /* ---------- 유틸 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hasBatchim(word) {
    var c = String(word).trim().slice(-1).charCodeAt(0);
    if (c < 0xAC00 || c > 0xD7A3) return false;
    return (c - 0xAC00) % 28 !== 0;
  }
  function josa(word, a, b) { return word + (hasBatchim(word) ? a : b); }
  function euro(word) { var c = String(word).slice(-1).charCodeAt(0); var j = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : 0; return word + (j === 0 || j === 8 ? '로' : '으로'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function noise(seed, span) { return (hash(seed) % (span * 2 + 1)) - span; }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  var WEEK = '일월화수목금토';
  function ageLabel(a) { var d = Math.floor(a / 10) * 10, r = a % 10; return d + '대 ' + (r <= 3 ? '초반' : r <= 6 ? '중반' : '후반'); }
  function elSpan(e, withHanja) { return '<span class="c' + e + '">' + EL[e] + (withHanja ? '(' + EH[e] + ')' : '') + '</span>'; }
  function groupOf(god) { return Math.floor(god / 2); }
  /* 기본 풀이(s) / 팩폭 모드(f) 문구 선택 */
  function M(s, f) { return state.mode === 'fact' ? f : s; }
  function L(key) { return M(P.lead[key][0], P.lead[key][1]); }

  /* ---------- 화면 전환 ---------- */
  function show(view) {
    ['home', 'input', 'loading', 'result'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    window.scrollTo(0, 0);
  }

  /* ---------- 홈 ---------- */
  function renderHome() {
    var now = new Date(), dp = S.dayPillar(now);
    $('today-line').innerHTML = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + WEEK[now.getDay()] + '요일 · 음력 ' +
      Math.abs(dp.lunar.getMonth()) + '월 ' + dp.lunar.getDay() + '일 · 일진 <b>' + dp.gz + '</b>';
    var p = state.profile = load(STORE_KEY);
    var card = $('saved-card');
    if (p) {
      card.hidden = false;
      card.innerHTML = '<span class="who"><b>' + esc(p.name) + '</b>님의 사주가 저장되어 있어요<br><span class="small">' + p.calendar + ' ' + p.birth + (p.unknownTime ? '' : ' ' + p.time) + ' · ' + p.gender + (p.mbti ? ' · ' + p.mbti : '') + (p.blood ? ' · ' + p.blood + '형' : '') + (p.zodiac != null ? ' · ' + Z.signs[p.zodiac].ko : '') + '</span></span>' +
        '<button type="button" data-go="input">수정</button>';
    } else card.hidden = true;
  }

  /* ---------- 입력 폼 ---------- */
  function initForm() {
    var sel = $('f-region');
    S.REGIONS.forEach(function (g) {
      var og = document.createElement('optgroup'); og.label = g.group;
      g.items.forEach(function (r) { var o = document.createElement('option'); o.value = o.textContent = r[0]; og.appendChild(o); });
      sel.appendChild(og);
    });
    $('f-birth').addEventListener('input', function (e) {
      var v = e.target.value.replace(/\D/g, '').slice(0, 8);
      e.target.value = v.length > 6 ? v.slice(0, 4) + '.' + v.slice(4, 6) + '.' + v.slice(6) : v.length > 4 ? v.slice(0, 4) + '.' + v.slice(4) : v;
    });
    $('f-time').addEventListener('input', function (e) {
      var v = e.target.value.replace(/\D/g, '').slice(0, 4);
      e.target.value = v.length > 2 ? v.slice(0, 2) + ':' + v.slice(2) : v;
    });
    $('f-unknown').addEventListener('change', function (e) { $('f-time').disabled = e.target.checked; if (e.target.checked) $('f-time').value = ''; });
    document.querySelectorAll('input[name=calendar]').forEach(function (r) {
      r.addEventListener('change', function () { $('leap-row').hidden = !$('cal-lunar').checked; });
    });
    buildMbtiPicker();
    document.querySelectorAll('#mbti-pick input').forEach(function (r) {
      r.addEventListener('change', function () { renderAxisDetail(+r.name.slice(1)); updMbti(); });
    });
    $('mbti-clear').addEventListener('click', function () { document.querySelectorAll('#mbti-pick input').forEach(function (r) { r.checked = false; }); renderAllAxis(); updMbti(); });
    buildZodiacStrip(); resetZodiac();
    $('zodiac-strip').addEventListener('click', function (e) { var b = e.target.closest('.zchip'); if (b) selectZodiac(+b.dataset.z, true); });
    $('f-birth').addEventListener('input', autoZodiac);
    $('f-leap').addEventListener('change', autoZodiac);
    document.querySelectorAll('input[name=calendar]').forEach(function (r) { r.addEventListener('change', autoZodiac); });
    $('form').addEventListener('submit', onSubmit);
  }

  function buildMbtiPicker() {
    $('mbti-pick').innerHTML = P.axisInfo.map(function (ax, i) {
      return '<div class="ap"><div class="ap-head"><b>' + ax.title + '</b><span>' + ax.q + '</span></div><div class="ap-opts">' +
        [ax.A, ax.B].map(function (o) {
          var id = 'm' + i + o.l;
          return '<input type="radio" name="m' + i + '" id="' + id + '" value="' + o.l + '"><label class="ap-card" for="' + id + '"><span class="lt">' + o.l + '</span><span class="nm">' + o.name + '</span><span class="one">' + o.one + '</span></label>';
        }).join('') + '</div><div id="apd' + i + '"></div></div>';
    }).join('');
  }
  /* 카드를 고르면 두 성향의 설명을 나란히 펼치고, 고른 쪽을 강조 */
  function renderAxisDetail(i) {
    var ax = P.axisInfo[i], c = document.querySelector('input[name=m' + i + ']:checked'), box = $('apd' + i);
    if (!c) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="ap-detail">' + [ax.A, ax.B].map(function (o) {
      var on = o.l === c.value;
      return '<div class="' + (on ? 'on' : '') + '"><h5>' + o.l + ' ' + o.name + '형' + (on ? ' · 나' : '') + '</h5><ul>' + o.more.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
  }
  function renderAllAxis() { [0, 1, 2, 3].forEach(renderAxisDetail); }

  /* ---------- 별자리 선택 ---------- */
  function zodiacStage(i, text, isResult) {
    var z = Z.signs[i];
    var sky = '<svg class="zs-sky" viewBox="0 0 100 100" aria-hidden="true">' +
      z.lines.map(function (l, k) { var a = z.stars[l[0]], b = z.stars[l[1]]; return '<line class="zl" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" style="animation-delay:' + (k * .12).toFixed(2) + 's"/>'; }).join('') +
      z.stars.map(function (s, k) { return '<circle class="zst" cx="' + s[0] + '" cy="' + s[1] + '" r="' + (s[2] * .9).toFixed(2) + '" style="animation-delay:' + (.25 + k * .08).toFixed(2) + 's,' + (1 + k * .3).toFixed(2) + 's"/>'; }).join('') + '</svg>';
    return '<div class="zs' + (isResult ? ' result' : '') + '" style="--z1:' + z.colors[0] + ';--z2:' + z.colors[1] + '"><div class="zs-aura"></div><div class="zs-dust"></div>' +
      '<div class="zs-top"><div class="zs-orb"><span class="zs-glyph">' + z.glyph + '\uFE0E</span><i class="zs-ring"></i></div>' + sky + '</div>' +
      '<div class="zs-info"><div class="zs-en">' + z.en + ' · ' + z.from.join('.') + ' ~ ' + z.to.join('.') + '</div><h4>' + z.ko + '<small>' + z.nick + '</small></h4><p>' + text + '</p>' +
      '<div class="zs-tags">' + z.keys.map(function (k) { return '<span>#' + k + '</span>'; }).join('') + '<span>원소 ' + z.el + '</span><span>수호성 ' + z.planet + '</span></div></div></div>';
  }
  function buildZodiacStrip() {
    $('zodiac-strip').innerHTML = Z.signs.map(function (z, i) {
      return '<button type="button" class="zchip" role="radio" aria-checked="false" aria-label="' + z.ko + '" data-z="' + i + '" style="--z1:' + z.colors[0] + ';--z2:' + z.colors[1] + '">' +
        '<span class="g">' + z.glyph + '\uFE0E</span><span class="n">' + z.ko.replace('자리', '') + '</span><span class="d">' + z.from.join('.') + '~</span></button>';
    }).join('');
  }
  function resetZodiac() {
    state.zSel = null; state.zManual = false;
    document.querySelectorAll('.zchip').forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
    $('zodiac-auto').textContent = '생일로 자동 선택';
    $('zodiac-stage').innerHTML = '<div class="zs zs-empty"><div class="zs-aura"></div><div class="zs-dust"></div><div><div class="ring">' +
      Z.signs.map(function (z) { return z.glyph + '\uFE0E'; }).join('') + '</div><p>생년월일을 입력하면<br>나의 별자리 캐릭터가 나타나요</p></div></div>';
  }
  function selectZodiac(i, manual) {
    if (manual !== undefined) state.zManual = manual;
    if (i === state.zSel && manual === undefined) return;
    state.zSel = i;
    document.querySelectorAll('.zchip').forEach(function (b) { b.setAttribute('aria-checked', String(+b.dataset.z === i)); });
    $('zodiac-stage').innerHTML = zodiacStage(i, Z.signs[i].s, false);
    $('zodiac-auto').textContent = state.zManual ? '직접 선택' : '생일로 자동 선택';
    var strip = $('zodiac-strip'), chip = strip.querySelector('[data-z="' + i + '"]');
    if (strip.scrollTo) strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }
  /* 입력한 생일(음력이면 양력으로 환산)로 별자리를 자동 선택 */
  function birthSolarMD() {
    var m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec($('f-birth').value);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if ($('cal-lunar').checked) {
      try { var s = Lunar.fromYmd(y, $('f-leap').checked ? -mo : mo, d).getSolar(); mo = s.getMonth(); d = s.getDay(); } catch (e) { return null; }
    }
    return [mo, d];
  }
  function autoZodiac() {
    if (state.zManual) return;
    var md = birthSolarMD();
    if (md) selectZodiac(Z.signOf(md[0], md[1]));
  }

  function readMbti() {
    return [0, 1, 2, 3].map(function (i) { var c = document.querySelector('input[name=m' + i + ']:checked'); return c ? c.value : ''; });
  }
  function updMbti() {
    var v = readMbti(), n = v.filter(Boolean).length, el = $('mbti-now');
    el.textContent = n === 0 ? '선택 안 함' : v.map(function (x) { return x || '_'; }).join('');
    el.className = 'mbti-now' + (n === 0 ? ' empty' : '');
  }

  function fillForm(p) {
    if (!p) return;
    $('f-name').value = p.name; $('f-birth').value = p.birth; $('f-time').value = p.time || '';
    $('f-unknown').checked = !!p.unknownTime; $('f-time').disabled = !!p.unknownTime;
    $('f-region').value = p.region;
    $(p.calendar === '음력' ? 'cal-lunar' : 'cal-solar').checked = true; $('leap-row').hidden = p.calendar !== '음력'; $('f-leap').checked = !!p.leap;
    $(p.gender === '남' ? 'g-m' : 'g-f').checked = true;
    var mb = p.mbti || '';
    [0, 1, 2, 3].forEach(function (i) { document.querySelectorAll('input[name=m' + i + ']').forEach(function (r) { r.checked = mb.charAt(i) === r.value; }); });
    renderAllAxis(); updMbti();
    $(p.blood ? 'b-' + p.blood : 'b-x').checked = true;
    resetZodiac();
    if (p.zodiac != null) selectZodiac(p.zodiac, !!p.zodiacManual); else autoZodiac();
  }

  function onSubmit(e) {
    e.preventDefault();
    var err = $('form-error'); err.textContent = '';
    ['f-name', 'f-birth', 'f-time'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    var name = $('f-name').value.trim(), birth = $('f-birth').value.trim(), time = $('f-time').value.trim();
    var unknown = $('f-unknown').checked, calendar = $('cal-lunar').checked ? '음력' : '양력';
    function fail(id, msg) { $(id).setAttribute('aria-invalid', 'true'); $(id).focus(); err.textContent = msg; }
    if (!name) return fail('f-name', '이름을 입력해 주세요.');
    var m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(birth);
    if (!m) return fail('f-birth', '생년월일을 1990.05.15 형식으로 입력해 주세요.');
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1901 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > 31) return fail('f-birth', '1901~2099년 사이의 올바른 날짜를 입력해 주세요.');
    if (calendar === '양력') {
      var dt = new Date(y, mo - 1, d);
      if (dt.getMonth() !== mo - 1) return fail('f-birth', '존재하지 않는 날짜예요.');
    } else {
      try { Lunar.fromYmd(y, $('f-leap').checked ? -mo : mo, d); } catch (x) { return fail('f-birth', '해당 음력 날짜(윤달 여부 포함)가 존재하지 않아요.'); }
    }
    var hh = 12, mm = 0;
    if (!unknown) {
      var t = /^(\d{2}):(\d{2})$/.exec(time);
      if (!t || +t[1] > 23 || +t[2] > 59) return fail('f-time', '태어난 시각을 15:00 형식으로 입력하거나 “몰라요”를 체크해 주세요.');
      hh = +t[1]; mm = +t[2];
    }
    var mv = readMbti(), mn = mv.filter(Boolean).length;
    if (mn > 0 && mn < 4) { err.textContent = 'MBTI는 네 글자를 모두 고르거나 초기화해 주세요.'; $('mbti-pick').scrollIntoView({ block: 'center' }); return; }
    if (state.zSel == null) autoZodiac();
    var profile = { name: name, mbti: mn === 4 ? mv.join('') : '', blood: document.querySelector('input[name=blood]:checked').value,
      zodiac: state.zSel, zodiacManual: state.zManual, birth: birth, time: unknown ? '' : time, unknownTime: unknown, region: $('f-region').value,
      gender: document.querySelector('input[name=gender]:checked').value, calendar: calendar, leap: calendar === '음력' && $('f-leap').checked,
      y: y, m: mo, d: d, hour: hh, minute: mm };
    save(STORE_KEY, profile);
    state.profile = profile;
    runAnalysis(state.pendingTab || 'saju', true);
  }

  /* ---------- 로딩 ---------- */
  function buildBagua() {
    var tri = ['111', '011', '101', '001', '110', '010', '100', '000'], svg = '';
    tri.forEach(function (bits, i) {
      var g = '<g transform="rotate(' + (i * 45) + ' 100 100)">';
      for (var k = 0; k < 3; k++) {
        var yy = 8 + k * 7;
        g += bits[k] === '1' ? '<rect x="84" y="' + yy + '" width="32" height="4" rx="1" fill="#e8d29c"/>'
          : '<rect x="84" y="' + yy + '" width="13" height="4" rx="1" fill="#e8d29c"/><rect x="103" y="' + yy + '" width="13" height="4" rx="1" fill="#e8d29c"/>';
      }
      svg += g + '</g>';
    });
    svg += '<circle cx="100" cy="100" r="66" fill="none" stroke="#c9a45c55" stroke-width="1"/><circle cx="100" cy="100" r="97" fill="none" stroke="#c9a45c33" stroke-width="1"/>';
    document.querySelector('.bagua-ring').innerHTML = svg;
  }

  function runAnalysis(tab, animate) {
    var p = state.profile;
    try { state.result = S.calculate(p); } catch (x) { console.error(x); show('input'); $('form-error').textContent = '계산 중 문제가 생겼어요. 입력값을 확인해 주세요.'; return; }
    state.tab = tab; state.todayOffset = 0;
    if (!animate) { renderResult(); show('result'); return; }
    show('loading');
    var msgs = ['만세력을 펼치는 중…', '네 기둥을 세우는 중…', '오행의 균형을 살피는 중…', '대운의 물길을 따라가는 중…', 'MBTI·혈액형과 겹쳐보는 중…'], i = 0;
    $('loading-sub').textContent = msgs[0];
    var timer = setInterval(function () { i++; if (i < msgs.length) $('loading-sub').textContent = msgs[i]; }, 480);
    setTimeout(function () { clearInterval(timer); renderResult(); show('result'); }, 2500);
  }

  /* ---------- 결과 ---------- */
  function applyMode() {
    document.body.classList.toggle('mode-fact', state.mode === 'fact');
    ['basic', 'fact'].forEach(function (m) { $('mode-' + m).setAttribute('aria-checked', String(state.mode === m)); });
    $('mode-hint').textContent = M('명리 해석을 차분하게 풀어드려요.', '지금부터 친구 모드. 듣기 좋은 말은 없어, 각오해.');
  }
  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode; save(MODE_KEY, mode);
    applyMode();
    $('panel-saju').innerHTML = renderSaju(state.result);
    renderToday(); bindChecks();
  }

  function renderResult() {
    applyMode();
    $('panel-saju').innerHTML = renderSaju(state.result);
    renderToday();
    setTab(state.tab);
    bindChecks();
  }
  function setTab(tab) {
    state.tab = tab;
    ['today', 'saju'].forEach(function (t) {
      $('tab-' + t).setAttribute('aria-selected', String(t === tab));
      $('panel-' + t).hidden = t !== tab;
    });
    window.scrollTo(0, 0);
  }

  function secHead(num, title, hanja, lead) {
    return '<div class="sec-head"><span class="sec-num">' + num + '</span><h2>' + title + '<small>' + hanja + '</small></h2></div>' +
      (lead ? '<p class="sec-lead">' + lead + '</p>' : '');
  }

  function tileHtml(kind, idx, unknown) {
    if (unknown) return '<div class="tile unknown"><span class="hj">?</span><span class="ko">모름</span></div>';
    var hj = kind === 's' ? S.STEMS[idx] : S.BRANCHES[idx], ko = kind === 's' ? S.STEM_KO[idx] : S.BRANCH_KO[idx];
    var e = kind === 's' ? S.STEM_EL[idx] : S.BRANCH_EL[idx];
    return '<div class="tile e' + e + '"><span class="hj">' + hj + '</span><span class="ko">' + ko + ' · ' + EL[e] + '</span></div>';
  }

  function renderSaju(r) {
    var p = r.input, ds = r.dayStem, dm = T.dayMaster[ds], h = '';
    var order = [3, 2, 1, 0], labels = ['년주', '월주', '일주', '시주'], lh = ['年柱', '月柱', '日柱', '時柱'];
    var maxEl = r.pct.indexOf(Math.max.apply(null, r.pct)), minEl = r.pct.indexOf(Math.min.apply(null, r.pct));

    /* 一 원국 */
    h += secHead('一', '사주 원국', '四 柱 原 局', L('wonguk'));
    h += '<div class="paper">';
    var cs = r.corrected;
    h += '<div class="profile-line"><span class="nm">' + esc(p.name) + '</span>' + p.calendar + ' ' + p.birth + (p.unknownTime ? ' (시각 모름)' : ' ' + p.time) + ' · ' + p.gender + ' · ' + esc(p.region) + '</div>';
    h += '<div class="profile-line" style="margin-top:8px"><span class="chip red">' + r.animal + '띠</span><span class="chip">일주 ' + r.gz[2] + '</span><span class="chip gold">' + r.strength + '</span><span class="chip">' + S.STEM_KO[r.dayStem] + EL[r.dayEl] + ' 일간</span></div>';
    var note = [];
    if (p.calendar === '음력') note.push('양력 환산 ' + r.solarDate.y + '.' + pad(r.solarDate.m) + '.' + pad(r.solarDate.d));
    else note.push('음력 ' + r.lunarText);
    if (!p.unknownTime) note.push('진태양시 보정 ' + (r.corr.minutes > 0 ? '+' : '') + r.corr.minutes + '분 → ' + pad(cs.getHour()) + ':' + pad(cs.getMinute()) + (r.corr.notes.length ? ' (' + r.corr.notes.join(', ') + ')' : ''));
    h += '<p class="corr-note">' + note.join(' · ') + '</p>';

    h += '<div class="pillars">';
    order.forEach(function (i) {
      var pl = r.pillars[i], unknown = i === 3 && !r.hasHour, me = i === 2;
      var sg = me ? '일간 (나)' : unknown ? '' : S.TEN_GODS[S.tenGod(ds, pl.stem)];
      var bg = unknown ? '' : S.TEN_GODS[S.branchTenGod(ds, pl.branch)];
      var hid = unknown ? '&nbsp;' : S.HIDDEN[pl.branch].map(function (x) { return S.STEMS[x[0]]; }).join(' ');
      h += '<div class="pillar' + (me ? ' me' : '') + '">' + (me ? '<span class="me-seal">我</span>' : '') +
        '<div class="p-label">' + labels[i] + '<b>' + lh[i] + '</b></div>' +
        '<div class="god top">' + sg + '</div>' + tileHtml('s', pl.stem, unknown) + tileHtml('b', pl.branch, unknown) +
        '<div class="god">' + bg + '</div><div class="hidden-stems" title="지장간">' + hid + '</div></div>';
    });
    h += '</div>';
    h += '<div class="ilju-box"><span class="big">' + r.gz[2] + '</span><span class="txt"><b>' + S.STEM_KO[ds] + S.BRANCH_KO[r.pillars[2].branch] + '일주 · ' + dm.img + '</b>' +
      '나를 상징하는 글자는 일간 ' + S.STEMS[ds] + '(' + S.STEM_KO[ds] + EL[S.STEM_EL[ds]] + ')입니다. 공망 ' + r.gongmang + '</span></div>';
    h += '</div>';

    /* 二 오행 */
    h += secHead('二', '오행의 균형', '五 行', L('ohaeng'));
    h += '<div class="paper"><div class="ohaeng-grid">' + radarSvg(r.pct) + '<div class="bars">';
    for (var e = 0; e < 5; e++) {
      h += '<div class="bar-row"><span class="el c' + e + '">' + EL[e] + ' ' + EH[e] + '</span><span class="bar-track"><span class="bar-fill b' + e + '" style="display:block;width:' + Math.max(r.pct[e], 1) + '%"></span></span><span class="pct">' + r.pct[e] + '%</span></div>';
    }
    h += '</div></div>';
    h += '<div class="yong-box">' +
      '<div><div class="k">용신 用神</div><div class="v c' + r.yong + '">' + EL[r.yong] + EH[r.yong] + '</div><div class="d">가장 필요한 기운</div></div>' +
      '<div><div class="k">희신 喜神</div><div class="v c' + r.hee + '">' + EL[r.hee] + EH[r.hee] + '</div><div class="d">돕는 기운</div></div>' +
      '<div><div class="k">기신 忌神</div><div class="v c' + r.gi + '">' + EL[r.gi] + EH[r.gi] + '</div><div class="d">조심할 기운</div></div></div>';
    h += '<p class="small muted" style="margin-top:10px">' + M('나를 돕는 기운(비겁·인성)이 ' + r.support + '%로 <b>' + r.strength + '</b> 사주입니다. ' +
      (r.strong ? '넘치는 힘을 덜어내 흘려보내는' : '부족한 힘을 채워 받쳐주는') + ' ' + EL[r.yong] + ' 기운이 용신이 됩니다.',
      '너를 받쳐주는 기운이 ' + r.support + '%라서 <b>' + r.strength + '</b>이야. ' + (r.strong ? '힘이 넘치니까 좀 덜어내야 하고,' : '힘이 모자라니까 채워줘야 하고,') + ' 그래서 제일 필요한 게 ' + EL[r.yong] + ' 기운이야.') + '</p>';
    h += '<div class="el-cards">';
    [0, 1, 2, 3, 4].sort(function (a, b) { return r.pct[b] - r.pct[a]; }).forEach(function (e) {
      var v = r.pct[e], lv = v >= 30 ? 0 : v >= 15 ? 1 : v >= 8 ? 2 : 3, txt = T.elementLevel[e][lv];
      var lvName = ['강', '중', '약', '결핍'][lv];
      h += '<div class="el-card" style="border-color:var(--' + S.EL_KEY[e] + ')"><div class="head"><span class="e c' + e + '">' + EL[e] + ' ' + EH[e] + '</span>' + v + '%' +
        '<span class="lv b' + e + '" style="color:#fff' + (e === 3 ? ';color:#2a221c;background:#d9d6cd' : '') + '">' + lvName + '</span></div><h4>' + txt.t + '</h4><p>' + txt.b + '</p></div>';
    });
    h += '</div></div>';

    /* 三 성향 */
    var gs = r.groupScore.map(function (v, i) { return { i: i, v: v }; }).sort(function (a, b) { return b.v - a.v; });
    var g1 = T.groups[gs[0].i], g2 = T.groups[gs[1].i];
    h += secHead('三', '타고난 성품', '性 向', L('seong'));
    h += '<div class="paper">';
    h += '<div class="character" data-hanja="' + S.STEMS[ds] + '"><div class="k">' + M('핵심 캐릭터 · ' + dm.img, '너의 정체 · ' + P.dayNick[ds]) + '</div><h3>' + dm.title + '</h3><p>' + dm.body + ' ' + T.strengthLine[r.strength] + '</p>' +
      '<div class="kw">' + dm.keys.concat([g1.name + ' · ' + g1.keyword, g2.name + ' · ' + g2.keyword]).map(function (k) { return '<span>#' + k + '</span>'; }).join('') + '</div></div>';
    if (state.mode === 'fact') h += '<div class="fact-box"><b>팩폭</b> ' + P.dayFact[ds] + ' ' + P.groupFact[gs[0].i][0] + '</div>';
    h += '<h3 class="h3">' + M('강점', '그래도 이건 인정할게') + '</h3><div class="card-list">';
    [g1.strengths[0], g2.strengths[0], g1.strengths[1]].forEach(function (s, i) {
      h += '<div class="sc"><div class="tag">강점 ' + (i + 1) + '</div><h4>' + s.t + '</h4><p>' + s.b + '</p><div class="use"><b>이렇게 써보세요</b>' + s.tip + '</div></div>';
    });
    h += '</div><h3 class="h3">' + M('주의할 점', '뼈 때리는 팩트') + '</h3>';
    if (state.mode === 'fact') {
      var facts = [['사주 · ' + g1.name + ' 과다', P.groupFact[gs[0].i][1]], ['사주 · ' + g1.name + ' 과다', P.groupFact[gs[0].i][2]], ['사주 · ' + g2.name, P.groupFact[gs[1].i][0]]];
      if (r.pct[minEl] < 12) facts.push(['오행 · ' + EL[minEl] + ' 부족', P.lackFact[minEl]]);
      h += '<ol class="fact-list" style="margin-bottom:12px">' + facts.map(function (f) { return '<li><small>' + f[0] + '</small>' + f[1] + '</li>'; }).join('') + '</ol>';
    }
    h += '<div class="card-list">';
    var cautions = [g1.caution];
    if (r.pct[minEl] < 12) cautions.push(T.lackCaution[minEl]); else cautions.push(g2.caution);
    cautions.forEach(function (c, i) {
      h += '<div class="sc warn"><div class="tag">주의 ' + (i + 1) + '</div><h4>' + c.t + '</h4><p>' + c.b + '</p><ul>' + c.list.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul><div class="use"><b>이럴 때 조심</b>' + c.risk + '</div></div>';
    });
    h += '</div></div>';

    /* 四 삼중 분석 */
    h += renderTriple(r, gs);

    /* 五 신살 */
    h += secHead('五', '타고난 별, 신살', '神 煞', L('sinsal'));
    h += '<div class="paper"><div class="sinsal">';
    if (!r.sinsal.length) h += '<p class="muted">두드러진 신살 없이 고르게 짜인 사주입니다. 특정 기운에 휘둘리지 않아 꾸준함이 강점이 됩니다.</p>';
    r.sinsal.forEach(function (s) {
      var info = T.sinsal[s.key], at = s.at.split('· ');
      h += '<div class="ss"><div class="top"><span class="nm">' + s.key + '</span><span class="hj">' + info.hanja + '</span><span class="type ' + info.type + '">' + info.type + '</span></div>' +
        '<div class="at"><b>' + at[0] + '</b>· ' + at[1] + ' · ' + s.basis + '</div><p>' + info.b + '</p></div>';
    });
    h += '</div></div>';

    /* 五 대운 */
    h += renderDaeun(r);

    /* 六 인연 */
    h += secHead('七', '나를 살리는 인연', '因 緣', L('inyeon'));
    h += '<div class="paper"><div class="partners">';
    var roles = [0, 1, 2, 3, 4].map(function (e) {
      var role = e === r.yong ? 'yong' : e === r.hee ? 'hee' : e === r.gi ? 'gi' : e === r.dayEl ? 'same' : 'neutral';
      return { e: e, role: role, info: T.partnerRole[role] };
    }).sort(function (a, b) { return b.info.star - a.info.star; });
    var orbColor = ['var(--wood)', 'var(--fire)', 'var(--earth)', '#8f98a3', 'var(--water)'];
    var myBest = P.mbti[p.mbti || r.sajuMbti].best;
    var roleFact = { yong: '이 기운 가진 사람은 무조건 곁에 둬. 네 부족한 부분 알아서 채워주는 귀인이야.', hee: '같이 있으면 편하고 일도 술술 풀리는 사이. 오래 가는 조합이야.',
      same: '말은 잘 통하는데 고집 대결 시작되면 끝이 없어. 누가 먼저 숙일래?', neutral: '처음엔 안 맞는 것 같은데 은근 자극 되는 사이. 기준만 맞추면 꿀조합.',
      gi: '끌려도 조심. 같이 있으면 네 밸런스 무너지는 사이야. 선 확실히 그어.' };
    roles.forEach(function (x) {
      var st = '★★★★★'.slice(0, x.info.star) + '<i>' + '★★★★★'.slice(x.info.star) + '</i>';
      h += '<div class="pt"><h4>' + EL[x.e] + ' · ' + T.partner[x.e].role + '</h4><span class="orb" style="background:' + orbColor[x.e] + '">' + EH[x.e] + '</span>' +
        '<div class="stars">' + st + '<em>' + x.info.label + '</em></div><p>' + M(x.info.b, roleFact[x.role]) + '</p><div class="chips">' + T.partner[x.e].chips.map(function (c) { return '<span class="chip">' + c + '</span>'; }).join('') + '</div>' +
        '<div class="mbti-chips">어울리는 MBTI ' + P.elementMbti[x.e].map(function (m) { return '<span class="chip' + (myBest.indexOf(m) >= 0 ? ' hit' : '') + '">' + m + '</span>'; }).join('') + '</div></div>';
    });
    h += '</div></div>';

    /* 七 처방 */
    var rm = T.remedy[r.yong];
    h += secHead('八', '운을 여는 처방', '處 方', '용신 ' + EL[r.yong] + '(' + EH[r.yong] + ') ' + M('기운을 생활 속에서 보태는 방법입니다.', '기운 채우기. ' + P.lead.cheobang[1]));
    h += '<div class="paper"><h3 class="h3">행운을 부르는 것</h3><div class="lucky">' +
      '<div><div class="k">행운의 색</div><div class="v"><span class="swatch">' + rm.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' + rm.color + '</div></div>' +
      '<div><div class="k">길한 방향</div><div class="v">' + rm.dir + '</div></div><div><div class="k">행운의 숫자</div><div class="v">' + rm.num + '</div></div>' +
      '<div><div class="k">좋은 계절</div><div class="v">' + rm.season + '</div></div><div><div class="k">도움 되는 음식</div><div class="v" style="font-size:13px">' + rm.food + '</div></div>' +
      '<div><div class="k">기운 나는 장소</div><div class="v" style="font-size:13px">' + rm.place + '</div></div></div>';
    h += '<h3 class="h3">처방</h3><div class="card-list">';
    var icon = { body: '身', relation: '緣', mind: '心', space: '宅' };
    rm.items.forEach(function (it, i) {
      h += '<div class="rx"><span class="ic">' + icon[it.icon] + '</span><div><div class="cat">처방 ' + (i + 1) + ' · ' + it.cat + '</div><h4>' + it.t + '</h4><p>' + it.b + '</p></div></div>';
    });
    h += '</div><h3 class="h3">4주 실천 미션</h3><div class="mission"><ol>' + rm.missions.map(function (m, i) { return '<li><span class="wk">' + (i + 1) + '주</span><span>' + m + '</span></li>'; }).join('') + '</ol></div>';
    h += '<h3 class="h3">실천 체크리스트 <span class="progress" id="check-progress"></span></h3><div class="checks" id="checks">' +
      rm.checks.map(function (c, i) { return '<label><input type="checkbox" data-i="' + i + '"><span>' + c + '</span></label>'; }).join('') + '</div></div>';

    /* 八 총평 */
    h += secHead('九', M('명운당 총평', '팩폭 한줄평'), '總 評', L('chongpyeong'));
    h += renderVerdict(r, dm, g1, minEl, maxEl);
    h += '<div class="end-actions"><button class="btn btn-gold" data-tab-go="today">오늘의 운세 보기</button><button class="btn btn-line" data-new="1">다른 사람 사주 보기</button><button class="btn btn-line btn-share" data-share="1">친구에게 공유하기</button></div>';
    return h;
  }

  function radarSvg(pct) {
    var cx = 130, cy = 125, R = 88, max = Math.max(40, Math.max.apply(null, pct));
    function pt(i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; }
    var s = '<svg class="radar" viewBox="0 0 260 250" role="img" aria-label="오행 분포 레이더 차트">';
    [.25, .5, .75, 1].forEach(function (k) {
      s += '<polygon points="' + [0, 1, 2, 3, 4].map(function (i) { return pt(i, k).join(','); }).join(' ') + '" fill="' + (k === 1 ? '#fffaf0' : 'none') + '" stroke="#5d504522" stroke-width="1"/>';
    });
    for (var i = 0; i < 5; i++) { var q = pt(i, 1); s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + q[0] + '" y2="' + q[1] + '" stroke="#5d504522"/>'; }
    var poly = pct.map(function (v, i) { return pt(i, v / max).join(','); }).join(' ');
    s += '<polygon points="' + poly + '" fill="#a8322b2a" stroke="#a8322b" stroke-width="2" stroke-linejoin="round"/>';
    var cols = ['#2f6b4f', '#b0352c', '#b8862e', '#6b737d', '#1f2c44'];
    pct.forEach(function (v, i) {
      var q = pt(i, v / max), l = pt(i, 1.22);
      s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4" fill="' + cols[i] + '" stroke="#fff" stroke-width="1.5"/>';
      s += '<text x="' + l[0] + '" y="' + (l[1] + 5) + '" text-anchor="middle" font-size="15" font-family="Song Myung, serif" fill="' + cols[i] + '">' + EH[i] + ' ' + v + '%</text>';
    });
    return s + '</svg>';
  }


  /* ---------- 삼중 분석: 사주 × MBTI × 혈액형 ---------- */
  function zodiacOf(r) { return r.input.zodiac != null ? r.input.zodiac : Z.signOf(r.solarDate.m, r.solarDate.d); }

  function renderTriple(r, gs) {
    var p = r.input, ds = r.dayStem, known = !!p.mbti, m = p.mbti || r.sajuMbti, mi = P.mbti[m];
    var zi = zodiacOf(r), z = Z.signs[zi], zStyle = '--z1:' + z.colors[0] + ';--z2:' + z.colors[1];
    var b = p.blood ? P.blood[p.blood] : null, sc = P.sajuScene[gs[0].i], h = '';
    h += secHead('四', M('사주 × MBTI × 혈액형 × 별자리', '4단 콤보 해부'), '四 重 分 析', L('triple'));
    h += '<div class="paper">';

    // 통합 캐릭터
    h += '<div class="combo" data-mark="' + m + '"><div class="k">' + M('통합 캐릭터', '한 줄 정체') + '</div>' +
      '<h3>' + P.dayAdj[ds] + ' ' + m + (b ? ' · ' + p.blood + '형' : '') + ' · ' + z.ko + '</h3>' +
      '<div class="sub">' + (known ? mi.nick : '사주로 추정한 ' + m + ' · ' + mi.nick) + (b ? ' × ' + b.nick : '') + ' × ' + z.nick + '</div>' +
      '<p>' + M(T.dayMaster[ds].img + ' 같은 기운에 ' + mi.nick + '의 성향' + (b ? ', ' + b.nick + '의 기질' : '') + '이 더해진 사람이에요. ' + mi.s + (b ? ' ' + b.s : ''),
        '한마디로 ' + P.dayNick[ds] + ' + ' + mi.nick + (b ? ' + ' + b.nick : '') + '. ' + mi.f[3]) + '</p>' +
      '<div class="badges"><span class="bs">사주 ' + S.STEMS[ds] + EH[r.dayEl] + ' 일간</span><span class="bm">' + m + (known ? '' : ' (추정)') + '</span>' + (b ? '<span class="bb">' + p.blood + '형</span>' : '') + '<span class="bz" style="' + zStyle + '">' + z.glyph + '\uFE0E ' + z.ko + '</span></div></div>';

    // 별자리 캐릭터
    var zOh = Z.EL_TO_OHAENG[z.el], syn;
    if (zOh === r.yong) syn = M('별자리 원소 <b>' + z.el + '</b>' + (hasBatchim(z.el) ? '은' : '는') + ' 오행으로 ' + EL[zOh] + ' 기운이에요. 사주에 가장 필요한 용신과 같아서, 부족한 기운을 별이 채워주는 든든한 조합이에요.', '별자리가 네 사주 빈칸(' + EL[zOh] + ')을 채워주는 기운이야. 이건 진짜 꿀조합, 별 덕 보고 사는 사람.');
    else if (zOh === r.gi) syn = M('별자리 원소 <b>' + z.el + '</b>' + (hasBatchim(z.el) ? '은' : '는') + ' 오행으로 ' + EL[zOh] + ' 기운이라 사주에서 조심할 기운과 겹쳐요. 장점이 과해지지 않게 균형을 의식하면 좋아요.', '별자리가 네 사주에 이미 넘치는 ' + EL[zOh] + ' 기운을 또 얹었어. 과하면 탈 나니까 브레이크 장착 필수.');
    else if (zOh === r.dayEl) syn = M('별자리 원소 <b>' + z.el + '</b>' + (hasBatchim(z.el) ? '이' : '가') + ' 나를 뜻하는 일간과 같은 ' + EL[zOh] + ' 기운이에요. 타고난 성향이 더 또렷하게 드러나요.', '별자리랑 사주가 같은 ' + EL[zOh] + ' 기운이라 성격이 아주 진하게 나와. 장점도 단점도 두 배.');
    else syn = M('별자리 원소 <b>' + z.el + '</b>' + (hasBatchim(z.el) ? '은' : '는') + ' 오행으로 ' + EL[zOh] + ' 기운이에요. 사주와 다른 색깔을 더해 성격에 입체감을 줘요.', '별자리는 사주랑 다른 ' + EL[zOh] + ' 기운이라 반전 매력을 만들어. "너 그런 면도 있었어?" 소리 듣는 부분이 여기야.');
    h += '<h3 class="h3" style="margin-top:20px">' + M('별자리 캐릭터', '별자리가 말하는 너') + '</h3>' + zodiacStage(zi, M(z.s, z.f[0]), true) +
      '<div class="zsyn">' + syn + '</div>';

    // 싱크로율
    var syncSum = 0, rows = '';
    P.axis.forEach(function (ax, i) {
      var lean = r.mbtiLean[i], sajuL = lean >= 50 ? ax.pair[0] : ax.pair[1], myL = known ? m.charAt(i) : '';
      syncSum += myL === ax.pair[0] ? lean : myL ? 100 - lean : 0;
      var key = known ? (sajuL === myL ? (myL === ax.pair[0] ? 'sameA' : 'sameB') : (sajuL === ax.pair[0] ? 'aNotB' : 'bNotA')) : null;
      var share = sajuL === ax.pair[0] ? lean : 100 - lean, nm = ax.name[sajuL === ax.pair[0] ? 0 : 1];
      var txt = key ? M(ax[key].s, ax[key].f) : M('사주로 보면 ' + nm + '(' + sajuL + ') 쪽 기운이 ' + share + '%예요.', '사주상 ' + nm + '(' + sajuL + ') 쪽이 ' + share + '%. 이 정도면 꽤 ' + sajuL + '야.');
      function cls(L) { return 'ax-l' + (L === myL ? ' me' : L === sajuL ? ' saju' : ''); }
      rows += '<div><div class="ax-top"><span class="' + cls(ax.pair[0]) + '">' + ax.pair[0] + '</span><span class="ax-track"><span class="ax-mid"></span><span class="ax-dot" style="left:' + (100 - lean) + '%"></span></span><span class="' + cls(ax.pair[1]) + '">' + ax.pair[1] + '</span></div>' +
        '<div class="ax-cap"><span>' + ax.name[0] + ' ' + lean + '%</span><span>' + (100 - lean) + '% ' + ax.name[1] + '</span></div><div class="ax-txt">' + txt + '</div></div>';
    });
    h += '<h3 class="h3" style="margin-top:20px">' + M('사주 속 MBTI 싱크로율', '사주가 본 진짜 MBTI') + '</h3>';
    if (known) {
      var sync = Math.round(syncSum / 4), st = P.sync.filter(function (x) { return sync >= x.min; })[0];
      h += '<div class="sync-head"><span class="sync-num">' + sync + '<small>%</small></span><p>' + M('사주가 가리키는 MBTI는 <b>' + r.sajuMbti + '</b>, 내가 고른 MBTI는 <b>' + m + '</b>예요. ', '사주는 <b>' + r.sajuMbti + '</b>라는데 넌 <b>' + m + '</b>라고 했지? ') + M(st.s, st.f) + '</p></div>';
    } else {
      h += '<div class="sync-head"><span class="sync-num" style="font-size:30px">' + m + '</span><p>' + M('MBTI를 입력하지 않아 사주의 오행과 십신으로 성향을 추정했어요.', 'MBTI 안 알려줘서 사주로 맞혀봤어. 맞으면 소름, 아니면 아래서 입력해.') + '</p></div>';
    }
    h += '<div class="axes">' + rows + '</div><div class="ax-legend"><span><i style="background:var(--ink)"></i>내 MBTI</span><span><i style="box-shadow:inset 0 0 0 2px var(--gold)"></i>사주가 본 성향</span><span><i style="background:#fff;box-shadow:0 0 0 2px var(--ink);border-radius:50%"></i>사주 기운의 위치</span></div>';

    // 팩폭 연타 / 성향 카드
    if (state.mode === 'fact') {
      var list = [['MBTI · ' + m, mi.f[0]], ['MBTI · ' + m, mi.f[1]]];
      if (b) list.push(['혈액형 · ' + p.blood + '형', b.f[0]], ['혈액형 · ' + p.blood + '형', b.f[1]]);
      list.push(['별자리 · ' + z.ko, z.f[1]], ['MBTI · ' + m, mi.f[2]]);
      h += '<h3 class="h3" style="margin-top:22px">팩폭 연타</h3><ol class="fact-list">' + list.map(function (f) { return '<li><small>' + f[0] + '</small>' + f[1] + '</li>'; }).join('') + '</ol>';
    } else {
      h += '<h3 class="h3" style="margin-top:22px">성향 카드</h3><div class="trait-grid"><div class="trait m"><div class="tt"><b>' + m + '</b><span>' + mi.nick + (known ? '' : ' · 사주 추정') + '</span></div><p>' + mi.s + '</p></div>' +
        (b ? '<div class="trait b"><div class="tt"><b>' + p.blood + '형</b><span>' + b.nick + '</span></div><p>' + b.s + '</p></div>' : '') + '</div>';
    }

    // 상황별
    var scenes = [
      { t: M('연애할 때', '연애할 때 너'), ic: '愛', c: '#c4473c', items: [['s', sc.love], ['m', mi.love], b && ['b', b.love], ['z', z.love]] },
      { t: M('일·커리어', '일할 때 너'), ic: '職', c: '#1f2c44', items: [['s', sc.work], ['m', mi.work]] },
      { t: M('돈 관리', '돈 쓸 때 너'), ic: '財', c: '#b8862e', items: [['s', sc.money], b && ['b', b.money]] },
      { t: M('스트레스 받을 때', '멘탈 나갈 때 너'), ic: '心', c: '#6d4fb3', items: [['s', sc.stress], ['m', mi.stress]] }
    ];
    var srcName = { s: '사주', m: 'MBTI', b: '혈액형', z: '별자리' };
    h += '<h3 class="h3" style="margin-top:22px">' + M('상황별로 보면', '상황별 팩트 체크') + '</h3><div class="card-list">';
    scenes.forEach(function (x) {
      h += '<div class="scene"><span class="ic" style="background:' + x.c + '">' + x.ic + '</span><div><h4>' + x.t + '</h4><ul>' +
        x.items.filter(Boolean).map(function (it) { return '<li><span class="src ' + it[0] + '">' + srcName[it[0]] + '</span><span>' + M(it[1].s, it[1].f) + '</span></li>'; }).join('') + '</ul></div></div>';
    });
    h += '</div>';

    // 궁합
    var yongTypes = P.elementMbti[r.yong];
    var fate = mi.best.filter(function (x) { return yongTypes.indexOf(x) >= 0; })[0] || mi.best[0];
    h += '<h3 class="h3" style="margin-top:22px">' + M('궁합으로 보면', '누구랑 엮여야 하냐면') + '</h3><div class="match-grid">' +
      '<div class="match fate"><div class="k">' + M('운명의 상대', '이 사람 보이면 잡아') + '</div><div class="v">' + fate + '</div><div class="d">' +
        M('MBTI 궁합과 용신 ' + EL[r.yong] + ' 기운을 함께 고려한 유형이에요.', 'MBTI 궁합도 맞고, 네 사주에 필요한 ' + EL[r.yong] + ' 기운까지 있어.') + '</div></div>' +
      '<div class="match"><div class="k">MBTI 찰떡</div><div class="v">' + mi.best.join(' · ') + '</div><div class="d">' + M('대화가 잘 통하는 조합', '말 안 해도 통하는 사이') + '</div></div>' +
      '<div class="match"><div class="k">MBTI 상극</div><div class="v">' + mi.worst + '</div><div class="d">' + M('이해하는 데 시간이 걸려요', '만나면 서로 답답해 미침') + '</div></div>' +
      (b ? '<div class="match"><div class="k">혈액형 궁합</div><div class="v">' + b.best.map(function (x) { return x + '형'; }).join(' · ') + '</div><div class="d">' + M('편안하게 맞는 혈액형', '같이 있으면 편한 혈액형') + '</div></div>' : '') +
      '<div class="match"><div class="k">용신 ' + EL[r.yong] + EH[r.yong] + ' 기운 MBTI</div><div class="v" style="font-size:15px">' + yongTypes.join(' · ') + '</div><div class="d">' + M('사주에 필요한 기운을 가진 유형', '네 부족한 기운 채워줄 유형') + '</div></div>' +
      '<div class="match"' + (b ? ' style="grid-column:1/-1"' : '') + '><div class="k">별자리 궁합</div><div class="v" style="font-size:16px">' + z.best.map(function (x) { return Z.signs[x].ko; }).join(' · ') + '</div><div class="d">' + M(z.ko + '와 잘 맞는 별자리', '얘네랑은 말 안 해도 통해') + '</div></div></div>';

    if (!known || !b) h += '<div class="add-more"><span>' + M('MBTI와 혈액형을 입력하면 더 자세한 분석을 볼 수 있어요.', 'MBTI랑 혈액형 알려주면 더 세게 분석해줄게.') + '</span><button type="button" data-go="input">입력하기</button></div>';
    return h + '</div>';
  }

  /* ---------- 대운 ---------- */
  var OUTER = ['주변에 경쟁자와 동료가 함께 늘어나고, 독립하려는 마음이 커집니다.', '하고 싶은 말과 만들고 싶은 것이 많아지며 재능이 바깥으로 드러납니다.',
    '돈과 성과에 대한 관심이 커지고 현실적인 기회가 눈에 들어옵니다.', '직장과 사회에서 맡는 역할과 책임이 커집니다.', '배우고 준비하는 일이 늘고, 도와주는 사람이 나타납니다.'];
  var INNER = ['생활 기반에서는 내 힘으로 버텨야 할 일이 많아집니다.', '일상에서는 활동량과 표현이 늘어 에너지 소모가 큽니다.',
    '생활 기반에서는 재물과 살림을 꾸리는 일이 중심이 됩니다.', '생활 기반에서는 조직과 규칙 안에서 자리를 다지게 됩니다.', '생활 기반에서는 공부·문서·집과 관련된 일이 늘어납니다.'];
  function favorText(r, el) {
    var f = r.favor(el);
    return f === 2 ? '내 사주에 가장 필요한 기운이라 반가운 손님입니다.' : f === 1 ? '나를 돕는 기운이라 일이 순하게 풀립니다.' :
      f === -2 ? '사주의 균형을 흔드는 기운이라 속도를 조절해야 합니다.' : f === -1 ? '이미 넉넉한 기운이 더해져 과열을 경계해야 합니다.' : '무난하게 지나가는 기운입니다.';
  }
  function dyTitle(d) {
    var a = T.groups[groupOf(d.stemGod)], b = T.groups[groupOf(d.branchGod)];
    if (d.score >= 1) return a.good[0] + ', ' + b.good[1] + ' — 기운이 차오르는 10년';
    if (d.score <= -1) return a.bad[0] + ', ' + b.bad[1] + ' — 기반을 다질 10년';
    return a.good[0] + ' · ' + b.bad[1] + ' — 기회와 부담이 교차하는 10년';
  }

  function renderDaeun(r) {
    var h = '', thisYear = new Date().getFullYear(), age = thisYear - r.birthYear;
    var cur = null; r.dayun.forEach(function (d) { if (d.startYear <= thisYear) cur = d; });
    var cand = r.dayun.filter(function (d) { return d.startAge >= 15 && d.startAge <= 75; });
    var golden = cand.reduce(function (a, b) { return b.score > a.score ? b : a; }, cand[0] || r.dayun[0]);
    var goldenLabel = ageLabel(golden.startAge) + ' ~ ' + ageLabel(golden.endAge - 1);
    state.goldenLabel = goldenLabel; state.golden = golden; state.curDy = cur;

    h += secHead('六', '대운의 물길', '大 運', L('daeun'));
    var curTxt = cur ? '<b>' + cur.gz + ' 대운(' + cur.startAge + '~' + cur.endAge + '세)</b>' : '첫 대운이 오기 전';
    h += '<div class="paper"><p style="font-size:14.5px;color:var(--ink-2)">' + M(esc(r.input.name) + '님의 대운은 ' + r.startAge + '세에 시작해 10년 단위로 흐릅니다. 지금은 ' + curTxt + '에 있으며, <b>' + goldenLabel + '</b>에 운이 가장 크게 피어납니다.',
      '대운은 ' + r.startAge + '세부터 10년마다 바뀌어. 지금은 ' + curTxt + '이고, 진짜 전성기는 <b>' + goldenLabel + '</b>이야. 거기에 맞춰서 인생 계획 짜.') + '</p>';
    h += '<h3 class="h3" style="margin-top:18px">대운 타임라인</h3><div class="dy-scroll">';
    r.dayun.forEach(function (d) {
      var isNow = cur === d, isGold = golden === d, past = cur && d.startYear < cur.startYear;
      h += '<div class="dy' + (isNow ? ' now' : '') + (isGold ? ' gold' : '') + (past ? ' past' : '') + '">' +
        (isNow ? '<span class="badge">현재</span>' : isGold ? '<span class="badge">황금기</span>' : '') +
        '<div class="ch"><span class="e' + S.STEM_EL[d.stem] + '">' + S.STEMS[d.stem] + '</span><span class="e' + S.BRANCH_EL[d.branch] + '">' + S.BRANCHES[d.branch] + '</span></div>' +
        '<span class="age">' + d.startAge + '~' + d.endAge + '</span></div>';
    });
    h += '</div><p class="dy-note">나이는 만 나이 기준입니다. 붉은 테두리는 현재, 금색 테두리는 황금기입니다.</p>';

    if (cur) {
      var sg = groupOf(cur.stemGod), bg = groupOf(cur.branchGod);
      h += '<h3 class="h3" style="margin-top:20px">지금 걷는 대운</h3><div class="now-dy"><span class="gz">' + cur.gz + '</span><div><div class="k">' + cur.startAge + '~' + cur.endAge + '세 · ' + S.TEN_GODS[cur.stemGod] + '·' + S.TEN_GODS[cur.branchGod] + '</div><h4>' + dyTitle(cur) + '</h4></div></div>';
      var chungTxt = cur.chung.length ? ' 특히 타고난 사주의 ' + cur.chung.map(function (b) { return S.BRANCH_KO[b] + '(' + S.BRANCHES[b] + ')'; }).join('·') +
        (hasBatchim(S.BRANCH_KO[cur.chung[cur.chung.length - 1]]) ? '과' : '와') + ' 부딪혀(沖) 이사·이직·관계 변화처럼 환경이 크게 바뀌기 쉽습니다.' : '';
      h += '<div class="dy-detail"><p><b>천간</b>이번 10년에는 ' + EL[S.STEM_EL[cur.stem]] + ' 기운(' + S.STEMS[cur.stem] + ')이 ' + euro(S.TEN_GODS[cur.stemGod]) + ' 들어옵니다. ' + OUTER[sg] + ' ' + favorText(r, S.STEM_EL[cur.stem]) + '</p>' +
        '<p><b>지지</b>' + EL[S.BRANCH_EL[cur.branch]] + ' 기운(' + S.BRANCHES[cur.branch] + ')이 바탕에 깔립니다. ' + INNER[bg] + chungTxt + '</p>' +
        '<p><b>결합</b>' + (cur.score >= 1 ? M('앞으로 나아갈 힘이 실리는 시기입니다. 미뤄둔 계획을 꺼내 구체적인 일정과 예산으로 옮겨 보시기 바랍니다.', '지금 밀어붙일 타이밍이야. 미뤄둔 계획 있으면 날짜랑 예산부터 박아. 고민은 그만.') :
          cur.score <= -1 ? M('속도보다 방향을 점검할 시기입니다. 큰 확장보다 건강·재정·관계의 기반을 다지면 다음 대운에서 크게 쓰입니다.', '지금은 버티는 구간이야. 크게 벌이지 말고 건강, 통장, 사람부터 지켜. 다음 대운에서 다 돌려받아.') :
            M('좋고 나쁨이 섞여 오는 시기입니다. 들어오는 기회는 잡되, 무리한 약속과 고정 지출은 줄여 균형을 지키시기 바랍니다.', '좋은 것도 오고 귀찮은 것도 오는 시기. 기회는 잡되 무리한 약속이랑 고정 지출은 줄여.')) + '</p></div>';
    }

    h += '<h3 class="h3" style="margin-top:22px">운세 곡선</h3><p class="small muted">대운(65%)과 해마다 바뀌는 세운(35%)이 용신과 얼마나 맞는지로 그린 흐름입니다.</p>';
    h += '<div class="curve-wrap">' + curveSvg(r, golden, age) + '<div class="curve-legend"><span><i style="background:#e8c46a"></i>운의 흐름</span><span><i style="background:#c9a45c44"></i>황금기</span><span><i style="background:#c4473c"></i>현재</span></div></div>';

    // 전환기
    var turns = [];
    for (var i = 1; i < r.dayun.length; i++) {
      var a = r.dayun[i - 1], b = r.dayun[i];
      if (b.startAge >= 10 && b.startAge <= 80) turns.push({ from: a, to: b, delta: b.score - a.score });
    }
    turns.sort(function (x, y) { return Math.abs(y.delta) - Math.abs(x.delta); });
    turns = turns.slice(0, 2).sort(function (x, y) { return x.to.startAge - y.to.startAge; });
    h += '<h3 class="h3" style="margin-top:22px">운의 갈림길</h3><div class="card-list">';
    turns.forEach(function (t, k) {
      var up = t.delta > 0, d = t.to, gS = groupOf(d.stemGod), gB = groupOf(d.branchGod);
      function lines(x) { var A = T.groups[groupOf(x.stemGod)], B = T.groups[groupOf(x.branchGod)]; return x.score >= 0 ? [A.good[0], B.good[1]] : [A.bad[0], B.bad[1]]; }
      var past = d.endAge <= age;
      h += '<div class="turn"><div class="lbl">' + ['첫', '두'][k] + ' 번째 전환<em style="color:' + (up ? 'var(--earth)' : 'var(--seal)') + '">' + (up ? '상승 전환' : '조정 전환') + '</em>' + (past ? '<em class="muted">· 지나온 시기</em>' : '') + '</div>' +
        '<h4>' + d.startAge + '~' + d.endAge + '세<small>· ' + d.gz + '</small></h4><div class="sub">' + (up ? T.groups[gS].good[0] + ' — 숨통이 트이는 시기' : T.groups[gS].bad[0] + ' — 대비가 필요한 시기') + '</div>' +
        '<div class="ba"><div><div class="k">BEFORE</div><div class="g">' + t.from.gz + '</div><div class="small muted">' + S.TEN_GODS[t.from.stemGod] + '·' + S.TEN_GODS[t.from.branchGod] + '</div>' + lines(t.from).map(function (l) { return '<div>· ' + l + '</div>'; }).join('') + '</div>' +
        '<div class="after ' + (up ? 'up' : 'down') + '"><div class="k">AFTER</div><div class="g">' + d.gz + '</div><div class="small muted">' + S.TEN_GODS[d.stemGod] + '·' + S.TEN_GODS[d.branchGod] + '</div>' + lines(d).map(function (l) { return '<div>· ' + l + '</div>'; }).join('') + '</div></div>' +
        '<p>' + d.startAge + '세 무렵부터 ' + OUTER[gS] + ' ' + INNER[gB] + ' ' + (up ? '앞선 10년보다 숨통이 트이는 흐름이니, 미뤄둔 계획을 꺼내기 좋은 때입니다.' : '앞선 10년보다 한 템포 쉬어 가며, 큰 결정일수록 서류와 숫자로 꼼꼼히 확인하세요.') + '</p></div>';
    });
    h += '</div>';

    var gg = T.groups[groupOf(golden.stemGod)], gb = T.groups[groupOf(golden.branchGod)];
    h += '<h3 class="h3" style="margin-top:22px">황금기</h3><div class="golden"><h4>' + goldenLabel + ', ' + gg.good[0] + '</h4><p>' + M(golden.startAge + '세부터 ' + (golden.endAge - 1) + '세까지는 ' +
      EL[S.STEM_EL[golden.stem]] + '·' + EL[S.BRANCH_EL[golden.branch]] + ' 기운의 ' + golden.gz + ' 대운이 들어와 용신과 손을 맞잡는 때입니다. ' + OUTER[groupOf(golden.stemGod)] + ' ' +
      '‘' + gb.good[1] + '’의 흐름도 함께하니, 그때를 위해 지금 익힌 분야를 꾸준히 키워 두시기 바랍니다.',
      golden.startAge + '세부터 ' + (golden.endAge - 1) + '세까지가 네 인생 하이라이트야. ' + golden.gz + ' 대운이 용신이랑 손잡는 시기라 뭘 해도 잘 풀려. ‘' + gg.good[0] + '’, ‘' + gb.good[1] + '’ 이게 그때 키워드니까, 그때 써먹을 무기를 지금 갈고닦아 둬.') + '</p></div></div>';
    return h;
  }

  function curveSvg(r, golden, age) {
    var W = 420, H = 200, L = 18, Rr = 12, top = 16, bot = 170;
    var raw = r.curve.map(function (c) { return c.v; });
    var sm = raw.map(function (v, i) {
      if (v === null) return null;
      var s = 0, n = 0; for (var k = -3; k <= 3; k++) { var x = raw[i + k]; if (x !== null && x !== undefined) { s += x; n++; } } return s / n;
    });
    var vals = sm.filter(function (v) { return v !== null; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx - mn < 1) { mx += .5; mn -= .5; }
    function X(a) { return L + a * (W - L - Rr) / 100; }
    function Y(v) { return bot - (v - mn) / (mx - mn) * (bot - top); }
    var pts = []; sm.forEach(function (v, a) { if (v !== null) pts.push([X(a), Y(v)]); });
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    var s = '<svg class="curve" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="나이별 운의 흐름 곡선">' +
      '<defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#b88f45"/><stop offset=".5" stop-color="#f3d98b"/><stop offset="1" stop-color="#c9a45c"/></linearGradient>' +
      '<linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8c46a" stop-opacity=".28"/><stop offset="1" stop-color="#e8c46a" stop-opacity="0"/></linearGradient>' +
      '<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    s += '<rect x="' + X(golden.startAge) + '" y="' + top + '" width="' + (X(golden.endAge) - X(golden.startAge)) + '" height="' + (bot - top) + '" fill="#c9a45c22" rx="4"/>';
    s += '<text x="' + ((X(golden.startAge) + X(golden.endAge)) / 2) + '" y="' + (top + 12) + '" text-anchor="middle" font-size="11" fill="#e8d29c">황금기</text>';
    for (var a = 0; a <= 100; a += 10) {
      s += '<line x1="' + X(a) + '" x2="' + X(a) + '" y1="' + top + '" y2="' + bot + '" stroke="#ffffff0d"/>';
      var bold = Math.floor(age / 10) * 10 === a;
      s += '<text x="' + X(a) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="12.5" fill="' + (bold ? '#fbf3e1' : '#8d8573') + '" font-weight="' + (bold ? 700 : 400) + '">' + a + '</text>';
    }
    if (r.startAge > 0) s += '<line x1="' + X(0) + '" x2="' + pts[0][0] + '" y1="' + pts[0][1] + '" y2="' + pts[0][1] + '" stroke="#c9a45c" stroke-dasharray="4 4" stroke-width="2"/>';
    s += '<path d="' + d + ' L' + pts[pts.length - 1][0] + ' ' + bot + ' L' + pts[0][0] + ' ' + bot + 'Z" fill="url(#cf)"/>';
    s += '<path d="' + d + '" fill="none" stroke="url(#cg)" stroke-width="3.2" stroke-linecap="round" filter="url(#glow)"/>';
    if (age >= 0 && age <= 100 && sm[age] !== null) {
      var cx = X(age), cy = Y(sm[age]);
      s += '<line x1="' + cx + '" x2="' + cx + '" y1="' + top + '" y2="' + bot + '" stroke="#c4473c" stroke-dasharray="3 3"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#c4473c33"><animate attributeName="r" values="6;13;6" dur="2s" repeatCount="indefinite"/></circle>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#c4473c" stroke="#fff" stroke-width="1.5"/>' +
        '<text x="' + cx + '" y="' + (cy - 14) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fbf3e1">지금 ' + age + '세</text>';
    }
    return s + '</svg>';
  }

  function renderVerdict(r, dm, g1, minEl, maxEl) {
    var golden = state.golden, cur = state.curDy, name = esc(r.input.name);
    var line = dm.title + ', ' + g1.short + '만 다스리면 ' + josa(state.goldenLabel.replace(' ~ ', '~'), '이', '가') + ' 전성기.';
    var body = name + '님은 ' + josa(dm.img, '을', '를') + ' 닮은 ' + S.STEM_KO[r.dayStem] + EL[r.dayEl] + '(' + S.STEMS[r.dayStem] + EH[r.dayEl] + ') 일간입니다. ' +
      '오행 가운데 ' + EL[maxEl] + ' 기운이 가장 강하고 ' + EL[minEl] + ' 기운이 가장 약해, ' + EL[r.yong] + ' 기운을 보태는 것이 운을 여는 열쇠입니다. ' +
      (cur ? '지금 지나는 ' + cur.gz + ' 대운은 ' + (cur.score >= 1 ? '힘이 실리는 시기이니 계획을 실행으로 옮기기 좋습니다. ' : cur.score <= -1 ? '기반을 다지는 시기이니 무리한 확장보다 내실을 챙기세요. ' : '기회와 부담이 섞여 오는 시기이니 균형을 지키는 것이 먼저입니다. ') : '') +
      golden.startAge + '세부터 열리는 ' + golden.gz + ' 대운에서 크게 꽃피며, 곁에는 ' + EL[r.yong] + ' 기운의 사람이 힘이 됩니다. ' +
      '행운의 색은 ' + T.remedy[r.yong].color + ', 방향은 ' + T.remedy[r.yong].dir + '입니다. 여기에 ' + Z.signs[zodiacOf(r)].ko + '의 ' + Z.signs[zodiacOf(r)].keys[0] + '·' + Z.signs[zodiacOf(r)].keys[1] + ' 기질이 더해집니다.';
    if (state.mode === 'fact') {
      var pi = r.input, mb = pi.mbti || r.sajuMbti, bl = pi.blood;
      line = P.dayNick[r.dayStem] + ', ' + g1.short + '만 고치면 ' + state.goldenLabel.replace(' ~ ', '~') + '에 대박 나.';
      body = name + ', 정리해줄게. 넌 ' + S.STEM_KO[r.dayStem] + EL[r.dayEl] + '(' + S.STEMS[r.dayStem] + EH[r.dayEl] + ') 일간, 쉽게 말하면 ' + dm.img + '. ' + EL[maxEl] + ' 기운은 넘치고 ' + EL[minEl] + ' 기운은 모자라서, ' + EL[r.yong] + ' 기운 채우는 게 제일 급해. ' +
        (pi.mbti ? 'MBTI는 ' + mb + '(' + P.mbti[mb].nick + ')' : '사주로 보면 MBTI는 ' + mb + '(' + P.mbti[mb].nick + ') 쪽') + (bl ? ', 혈액형은 ' + bl + '형(' + P.blood[bl].nick + ')' : '') + ', 별자리는 ' + Z.signs[zodiacOf(r)].ko + '(' + Z.signs[zodiacOf(r)].nick + ')' + '. 이 조합이면 ' + (bl ? P.blood[bl].f[2] : P.mbti[mb].f[3]) + ' ' +
        (cur ? (cur.score >= 1 ? '지금 대운은 밀어붙일 타이밍이니까 고민 그만하고 질러. ' : cur.score <= -1 ? '지금 대운은 버티는 구간이야. 무리하게 벌이지 말고 체력이랑 통장부터 지켜. ' : '지금 대운은 기회랑 부담이 반반이야. 욕심 조금만 덜어내. ') : '') +
        golden.startAge + '세부터 ' + golden.gz + ' 대운에서 진짜 터지니까 그때까지 실력 쌓아 둬. 행운의 색은 ' + T.remedy[r.yong].color + ', 방향은 ' + T.remedy[r.yong].dir + '. 오늘부터 바로 써먹어.';
    }
    var stamp = esc(r.input.name.slice(0, 3));
    return '<div class="verdict"><div class="q">' + line + '</div><p class="body">' + body + '</p><div class="stamp">' + stamp + '<br>之印</div></div>';
  }

  function bindChecks() {
    var box = $('checks'); if (!box) return;
    var key = 'myeongun.checks.' + hash(JSON.stringify(state.profile));
    var saved = load(key) || [];
    var inputs = box.querySelectorAll('input');
    function upd() { var n = 0; inputs.forEach(function (x) { if (x.checked) n++; }); $('check-progress').textContent = n + ' / ' + inputs.length; }
    inputs.forEach(function (inp) {
      inp.checked = saved.indexOf(+inp.dataset.i) >= 0;
      inp.addEventListener('change', function () {
        var arr = []; inputs.forEach(function (x) { if (x.checked) arr.push(+x.dataset.i); }); save(key, arr); upd();
      });
    });
    upd();
  }

  /* ---------- 오늘의 운세 ---------- */
  function renderToday() {
    var r = state.result, p = r.input, ds = r.dayStem;
    var date = new Date(); date.setDate(date.getDate() + state.todayOffset);
    var dp = S.dayPillar(date), st = dp.p.stem, br = dp.p.branch;
    var god = S.tenGod(ds, st), bgod = S.branchTenGod(ds, br), info = T.today[god];
    var fS = r.favor(S.STEM_EL[st]), fB = r.favor(S.BRANCH_EL[br]);
    var natalDay = r.pillars[2].branch, chung = S.isChung(br, natalDay), hap = S.isHap(br, natalDay);
    var seed = p.name + p.birth + date.toDateString();
    var total = clamp(Math.round(info.base * .6 + 30 + fS * 6 + fB * 5 + (hap ? 5 : 0) - (chung ? 9 : 0) + noise(seed, 3)), 38, 98);
    var G = function (g) { return groupOf(god) === g || groupOf(bgod) === g; };
    var cats = [
      { k: '재물', h: '財', s: total + (G(2) ? 7 : 0) - (G(0) ? 5 : 0) + noise(seed + 'm', 5), t: info.money },
      { k: '애정', h: '愛', s: total + ((p.gender === '남' ? G(2) : G(3)) ? 7 : 0) + (G(1) ? 3 : 0) - (chung ? 5 : 0) + noise(seed + 'l', 5), t: info.love },
      { k: '직장', h: '職', s: total + (G(3) || G(4) ? 6 : 0) - (god === 3 ? 4 : 0) + noise(seed + 'w', 5), t: info.work },
      { k: '건강', h: '健', s: total + (G(4) || G(0) ? 4 : 0) - (chung ? 6 : 0) + noise(seed + 'h', 5), t: info.health }
    ];
    cats.forEach(function (c) { c.s = clamp(Math.round(c.s), 35, 99); });

    // 시간대
    var hours = [], nowB = Math.floor((date.getHours() + 1) / 2) % 12;
    for (var b = 0; b < 12; b++) {
      var hs = ((st % 5) * 2 + b) % 10; // 시두법: 그날 일진의 천간 기준
      var sc = r.favor(S.STEM_EL[hs]) + r.favor(S.BRANCH_EL[b]) + (S.isHap(b, natalDay) ? 1 : 0) - (S.isChung(b, natalDay) ? 2 : 0);
      hours.push({ b: b, sc: sc });
    }
    var best = hours.slice().sort(function (a, c) { return c.sc - a.sc; })[0];
    var rm = T.remedy[r.yong];

    var h = '<div class="date-nav"><button data-day="-1"' + (state.todayOffset <= -30 ? ' disabled' : '') + '>‹ 이전</button><div class="d"><b>' +
      (date.getMonth() + 1) + '월 ' + date.getDate() + '일 ' + WEEK[date.getDay()] + '요일' + (state.todayOffset === 0 ? ' · 오늘' : '') + '</b><small>음력 ' + (dp.lunar.getMonth() < 0 ? '윤' : '') + Math.abs(dp.lunar.getMonth()) + '월 ' + dp.lunar.getDay() + '일 · ' + dp.yearGz + '년 ' + dp.monthGz + '월 ' + dp.gz + '일</small></div>' +
      '<button data-day="1"' + (state.todayOffset >= 30 ? ' disabled' : '') + '>다음 ›</button></div>';

    h += '<div class="paper"><div class="today-hero">' + gauge(total) + '<div><span class="iljin">' + esc(p.name) + '님의 일진 <b>' + dp.gz + '</b></span><h3>' + info.t + '</h3>' +
      '<span class="chip red god-chip">' + S.TEN_GODS[god] + ' ' + S.TEN_HANJA[god] + '</span> <span class="chip">' + EL[S.STEM_EL[st]] + '·' + EL[S.BRANCH_EL[br]] + ' 기운</span>' +
      (hap ? ' <span class="chip gold">일지와 합(合)</span>' : '') + (chung ? ' <span class="chip red">일지와 충(沖)</span>' : '') + '</div></div>' +
      '<p class="today-body">' + info.b + ' ' + (fS + fB >= 2 ? '오늘 들어오는 기운이 용신 ' + josa(EL[r.yong], '과', '와') + ' 잘 맞아 평소보다 일이 매끄럽게 풀립니다.' : fS + fB <= -2 ? '오늘은 사주와 엇갈리는 기운이 강하니 중요한 결정은 하루 미뤄도 좋습니다.' : '') +
      (chung ? ' 일지와 충이 들어 예정에 없던 이동이나 변동이 생기기 쉬우니 여유 시간을 두세요.' : hap ? ' 일지와 합이 들어 사람과의 약속·협력이 순조롭습니다.' : '') + '</p>' +
      (state.mode === 'fact' ? '<div class="fact-box"><b>오늘의 팩폭</b> ' + P.todayFact[god] + (chung ? ' 그리고 오늘 충 들었어. 약속 시간 넉넉하게 잡아.' : '') +
        (p.mbti ? '<br><b>' + p.mbti + '한테 한마디</b> ' + P.mbti[p.mbti].f[hash(seed) % P.mbti[p.mbti].f.length] : '') + '</div>' : '') +
      (function () {
        var zi = zodiacOf(r), z = Z.signs[zi], k = hash(seed + 'z' + zi) % Z.today.s.length;
        return '<div class="zone" style="--z1:' + z.colors[0] + ';--z2:' + z.colors[1] + '"><span class="g">' + z.glyph + '\uFE0E</span><div><div class="k">오늘의 ' + z.ko + '</div><p>' + M(Z.today.s[k], Z.today.f[k]) + '</p></div></div>';
      })() + '</div>';

    h += secHead('財', '분야별 운세', '各 運');
    h += '<div class="paper"><div class="cats">' + cats.map(function (c) {
      var col = c.s >= 80 ? 'var(--wood)' : c.s >= 60 ? 'var(--earth)' : 'var(--seal)';
      return '<div class="cat"><div class="nm"><span><b>' + c.h + '</b>' + c.k + '</span></div><div class="row"><span class="bar-track"><span class="bar-fill" style="display:block;width:' + c.s + '%;background:' + col + '"></span></span><span class="s" style="color:' + col + '">' + c.s + '</span></div><p>' + c.t + '</p></div>';
    }).join('') + '</div></div>';

    h += secHead('福', '오늘의 행운', '吉 運');
    h += '<div class="paper"><div class="lucky">' +
      '<div><div class="k">행운의 색</div><div class="v"><span class="swatch">' + rm.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' + rm.color + '</div></div>' +
      '<div><div class="k">행운의 숫자</div><div class="v">' + rm.num + '</div></div><div><div class="k">길한 방향</div><div class="v">' + rm.dir + '</div></div>' +
      '<div><div class="k">좋은 시간</div><div class="v">' + S.BRANCHES[best.b] + '시 (' + S.BRANCH_KO[best.b] + ')</div></div><div><div class="k">도움 되는 음식</div><div class="v" style="font-size:13px">' + rm.food.split(', ')[hash(seed) % 3] + '</div></div>' +
      '<div><div class="k">띠 궁합</div><div class="v">' + S.ANIMALS[[1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2][r.pillars[0].branch]] + '띠</div></div></div>';
    h += '<h3 class="h3" style="margin-top:20px">시간대별 운 · 십이시진</h3><div class="hours">' + hours.map(function (x) {
      var cls = x.sc >= 2 ? 'good' : x.sc <= -2 ? 'bad' : 'mid';
      return '<div class="hr ' + cls + (state.todayOffset === 0 && x.b === nowB ? ' now' : '') + '"><div class="b">' + S.BRANCHES[x.b] + '</div><div class="t">' + S.HOUR_RANGE[x.b].split('~')[0] + '</div><div class="m">' + (cls === 'good' ? '길' : cls === 'bad' ? '흉' : '평') + '</div></div>';
    }).join('') + '</div><p class="small muted" style="margin-top:8px">테두리는 지금 시각입니다. 진태양시 기준으로 시진이 30분씩 늦게 시작합니다.</p>';

    // 올해
    var yp = S.pillarOf(dp.yearGz), yg = S.tenGod(ds, yp.stem), ybg = S.branchTenGod(ds, yp.branch);
    var yf = r.favor(S.STEM_EL[yp.stem]) + r.favor(S.BRANCH_EL[yp.branch]);
    var A = T.groups[groupOf(yg)], B = T.groups[groupOf(ybg)];
    h += '<div class="year-card"><div class="k">' + dp.yearGz + '년 세운 · ' + S.TEN_GODS[yg] + '·' + S.TEN_GODS[ybg] + '</div><h4>' + (yf >= 1 ? A.good[0] + ', 순풍의 해' : yf <= -1 ? A.bad[0] + ', 다지는 해' : A.good[0] + ' · ' + B.bad[1] + ', 기회와 부담이 교차하는 해') + '</h4>' +
      '<p>올해는 ' + EL[S.STEM_EL[yp.stem]] + '·' + EL[S.BRANCH_EL[yp.branch]] + ' 기운이 들어옵니다. ' + OUTER[groupOf(yg)] + ' ' + INNER[groupOf(ybg)] + ' ' + favorText(r, S.STEM_EL[yp.stem]) + '</p></div></div>';

    h += '<div class="end-actions"><button class="btn btn-gold" data-tab-go="saju">나의 사주팔자 보기</button><button class="btn btn-line" data-new="1">다른 사람 운세 보기</button><button class="btn btn-line btn-share" data-share="1">친구에게 공유하기</button></div>';
    $('panel-today').innerHTML = h;
  }

  function gauge(v) {
    var R = 48, C = 2 * Math.PI * R, col = v >= 80 ? '#2f6b4f' : v >= 60 ? '#b8862e' : '#a8322b';
    return '<div class="gauge"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="' + R + '" fill="none" stroke="#e2d3b2" stroke-width="9"/>' +
      '<circle cx="56" cy="56" r="' + R + '" fill="none" stroke="' + col + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (C * v / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
      '<div class="num"><b style="color:' + col + '">' + v + '</b><small>오늘의 총운</small></div></div>';
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go],[data-open],[data-tab],[data-tab-go],[data-new],[data-day],[data-mode],[data-share]');
    if (!t) return;
    if (t.dataset.mode) { setMode(t.dataset.mode); return; }
    if (t.dataset.share) { share(); return; }
    if (t.dataset.go) {
      e.preventDefault();
      if (t.dataset.go === 'home') { renderHome(); show('home'); }
      else { fillForm(load(STORE_KEY)); show('input'); }
    } else if (t.dataset.open) {
      state.pendingTab = t.dataset.open;
      if (state.profile) runAnalysis(t.dataset.open, !state.result);
      else { show('input'); }
    } else if (t.dataset.tab) setTab(t.dataset.tab);
    else if (t.dataset.tabGo) setTab(t.dataset.tabGo);
    else if (t.dataset.new) {
      $('form').reset(); renderAllAxis(); updMbti(); resetZodiac(); $('f-time').disabled = false; $('leap-row').hidden = true; $('form-error').textContent = '';
      state.pendingTab = state.tab; show('input');
    } else if (t.dataset.day) { state.todayOffset += +t.dataset.day; renderToday(); }
  });

  /* ---------- 공유 ---------- */
  function share() {
    var url = location.href.split('#')[0];
    var data = { title: '명운당 사주', text: '사주 × MBTI × 혈액형으로 보는 내 운명. 팩폭 모드도 있어!', url: url };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    var done = function () { toast('링크를 복사했어요. 친구에게 붙여넣어 보내세요!'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { toast(url); });
    else toast(url);
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  initForm();
  buildBagua();
  renderHome();
  show('home');
})();
