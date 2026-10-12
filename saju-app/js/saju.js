/* 사주 계산 엔진 — 만세력(lunar-javascript) 위에 오행·십신·신살·대운·용신 해석을 얹는다. */
(function (global) {
  'use strict';

  var STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
  var STEM_KO = '갑을병정무기경신임계'.split('');
  var STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  var BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
  var BRANCH_KO = '자축인묘진사오미신유술해'.split('');
  var BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var ANIMALS = '쥐 소 호랑이 토끼 용 뱀 말 양 원숭이 닭 개 돼지'.split(' ');
  var EL = ['목', '화', '토', '금', '수'];
  var EL_HANJA = ['木', '火', '土', '金', '水'];
  var EL_KEY = ['wood', 'fire', 'earth', 'metal', 'water'];
  // 지장간: [천간 index, 비중]
  var HIDDEN = [
    [[9, 1]], [[5, .6], [9, .3], [7, .1]], [[0, .6], [2, .3], [4, .1]], [[1, 1]],
    [[4, .6], [1, .3], [9, .1]], [[2, .6], [6, .3], [4, .1]], [[3, .7], [5, .3]], [[5, .6], [3, .3], [1, .1]],
    [[6, .6], [8, .3], [4, .1]], [[7, 1]], [[4, .6], [7, .3], [3, .1]], [[8, .7], [0, .3]]
  ];
  var TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  var TEN_HANJA = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '正印'];
  var GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
  var HOUR_RANGE = ['23:30~01:29', '01:30~03:29', '03:30~05:29', '05:30~07:29', '07:30~09:29', '09:30~11:29',
    '11:30~13:29', '13:30~15:29', '15:30~17:29', '17:30~19:29', '19:30~21:29', '21:30~23:29'];

  /* 출생지: [경도, 표준시 자오선] — 진태양시 보정용 */
  var REGIONS = [
    { group: '기본', items: [['대한민국', 127.5, 135]] },
    { group: '대한민국 (정밀)', items: [['서울특별시', 126.98, 135], ['부산광역시', 129.08, 135], ['대구광역시', 128.6, 135], ['인천광역시', 126.7, 135], ['광주광역시', 126.85, 135], ['대전광역시', 127.38, 135], ['울산광역시', 129.31, 135], ['세종특별자치시', 127.29, 135], ['경기도', 127.01, 135], ['강원특별자치도', 128.2, 135], ['충청북도', 127.49, 135], ['충청남도', 126.8, 135], ['전북특별자치도', 127.15, 135], ['전라남도', 126.9, 135], ['경상북도', 128.9, 135], ['경상남도', 128.2, 135], ['제주특별자치도', 126.53, 135]] },
    { group: '아시아', items: [['도쿄', 139.69, 135], ['오사카', 135.5, 135], ['후쿠오카', 130.4, 135], ['베이징', 116.4, 120], ['상하이', 121.47, 120], ['칭다오', 120.38, 120], ['옌볜(연길)', 129.5, 120], ['선양', 123.43, 120], ['홍콩', 114.17, 120], ['타이베이', 121.56, 120], ['싱가포르', 103.82, 120], ['호치민', 106.66, 105], ['하노이', 105.85, 105], ['마닐라', 120.98, 120], ['자카르타', 106.85, 105], ['방콕', 100.5, 105]] },
    { group: '북미', items: [['LA', -118.24, -120], ['뉴욕', -74.0, -75], ['시애틀', -122.33, -120], ['시카고', -87.63, -90], ['애틀랜타', -84.39, -75], ['토론토', -79.38, -75], ['밴쿠버', -123.12, -120]] },
    { group: '오세아니아', items: [['시드니', 151.21, 150], ['멜버른', 144.96, 150], ['오클랜드', 174.76, 180]] },
    { group: '유럽', items: [['런던', -0.13, 0], ['프랑크푸르트', 8.68, 15]] }
  ];
  function findRegion(name) {
    for (var i = 0; i < REGIONS.length; i++)
      for (var j = 0; j < REGIONS[i].items.length; j++)
        if (REGIONS[i].items[j][0] === name) return REGIONS[i].items[j];
    return REGIONS[0].items[0];
  }

  /* 한국 서머타임 시행 기간 (시작일, 종료일 — 해당 기간 시계가 1시간 빨랐음) */
  var KR_DST = [
    ['1948-06-01', '1948-09-13'], ['1949-04-03', '1949-09-11'], ['1950-04-01', '1950-09-10'], ['1951-05-06', '1951-09-09'],
    ['1955-05-05', '1955-09-09'], ['1956-05-20', '1956-09-30'], ['1957-05-05', '1957-09-22'], ['1958-05-04', '1958-09-21'],
    ['1959-05-03', '1959-09-20'], ['1960-05-01', '1960-09-18'], ['1987-05-10', '1987-10-11'], ['1988-05-08', '1988-10-09']
  ];
  function ymdKey(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isKorea(name) {
    return REGIONS[0].items[0][0] === name || REGIONS[1].items.some(function (r) { return r[0] === name; });
  }

  /* 시계 시각 → 진태양시(평균태양시) 보정 분 */
  function solarCorrection(region, y, m, d) {
    var r = findRegion(region), meridian = r[2], notes = [];
    var key = ymdKey(y, m, d), minutes;
    if (isKorea(region) && ((key >= '1908-04-01' && key <= '1911-12-31') || (key >= '1954-03-21' && key <= '1961-08-09'))) {
      meridian = 127.5; notes.push('당시 표준시 UTC+8:30');
    }
    minutes = Math.round((r[1] - meridian) * 4);
    if (isKorea(region)) {
      for (var i = 0; i < KR_DST.length; i++) {
        if (key >= KR_DST[i][0] && key < KR_DST[i][1]) { minutes -= 60; notes.push('서머타임 -60분'); break; }
      }
    }
    return { minutes: minutes, notes: notes, label: region };
  }

  function tenGod(dayStem, stem) {
    var d = STEM_EL[dayStem], t = STEM_EL[stem], same = (dayStem % 2) === (stem % 2);
    var rel = (t - d + 5) % 5; // 0 같음, 1 내가 생, 2 내가 극, 3 나를 극, 4 나를 생
    return rel * 2 + (same ? 0 : 1);
  }
  function relOfElement(dayEl, el) { return (el - dayEl + 5) % 5; } // 그룹 index
  function branchTenGod(dayStem, branch) { return tenGod(dayStem, HIDDEN[branch][0][0]); }

  function pillarOf(ganzhi) {
    return { stem: STEMS.indexOf(ganzhi.charAt(0)), branch: BRANCHES.indexOf(ganzhi.charAt(1)) };
  }
  function ganzhiOfYear(y) { var i = ((y - 4) % 60 + 60) % 60; return { stem: i % 10, branch: i % 12 }; }

  var CHUNG = function (a, b) { return Math.abs(a - b) === 6; };
  var HAP_PAIRS = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  function isHap(a, b) { return HAP_PAIRS.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); }); }
  var SAMHAP_GROUP = function (b) { return [0, 3, 2, 1][b % 4]; }; // 申子辰=0 亥卯未=1 寅午戌=2 巳酉丑=3

  /* 신살 */
  var CHEONEUL = { 0: [1, 7], 4: [1, 7], 6: [1, 7], 1: [0, 8], 5: [0, 8], 2: [11, 9], 3: [11, 9], 7: [2, 6], 8: [5, 3], 9: [5, 3] };
  var MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
  var DOHWA = [9, 0, 3, 6], YEOKMA = [2, 5, 8, 11], HWAGAE = [4, 7, 10, 1]; // by SAMHAP_GROUP
  var YANGIN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
  var HONGYEOM = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];
  var GOEGANG = ['庚辰', '庚戌', '壬辰', '壬戌', '戊戌'];
  var BAEKHO = ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'];
  var PILLAR_NAME = ['년지', '월지', '일지', '시지'];

  function findSinsal(p, hasHour) {
    var list = [], ds = p[2].stem, branches = p.map(function (x) { return x.branch; });
    var idx = hasHour ? [0, 1, 2, 3] : [0, 1, 2];
    function push(key, at, basis) { list.push({ key: key, at: at, basis: basis }); }
    idx.forEach(function (i) {
      if (CHEONEUL[ds].indexOf(branches[i]) >= 0) push('천을귀인', BRANCHES[branches[i]] + '· ' + PILLAR_NAME[i], '일간 기준');
    });
    idx.forEach(function (i) { if (MUNCHANG[ds] === branches[i]) push('문창귀인', BRANCHES[branches[i]] + '· ' + PILLAR_NAME[i], '일간 기준'); });
    [[0, '년지'], [2, '일지']].forEach(function (base) {
      var g = SAMHAP_GROUP(branches[base[0]]);
      idx.forEach(function (i) {
        if (i === base[0]) return;
        var b = branches[i], at = BRANCHES[b] + '· ' + PILLAR_NAME[i], basis = base[1] + ' 기준';
        if (DOHWA[g] === b) push('도화살', at, basis);
        if (YEOKMA[g] === b) push('역마살', at, basis);
        if (HWAGAE[g] === b) push('화개살', at, basis);
      });
    });
    if (YANGIN[ds] !== undefined) idx.forEach(function (i) { if (YANGIN[ds] === branches[i]) push('양인살', BRANCHES[branches[i]] + '· ' + PILLAR_NAME[i], '일간 기준'); });
    idx.forEach(function (i) { if (HONGYEOM[ds] === branches[i]) push('홍염살', BRANCHES[branches[i]] + '· ' + PILLAR_NAME[i], '일간 기준'); });
    var dayGz = STEMS[ds] + BRANCHES[p[2].branch];
    if (GOEGANG.indexOf(dayGz) >= 0) push('괴강살', dayGz + '· 일주', '일주 기준');
    idx.forEach(function (i) {
      var gz = STEMS[p[i].stem] + BRANCHES[p[i].branch];
      if (BAEKHO.indexOf(gz) >= 0) push('백호살', gz + '· ' + ['년주', '월주', '일주', '시주'][i], '주 기준');
    });
    // 같은 신살 중복 제거
    var seen = {};
    return list.filter(function (s) { if (seen[s.key]) return false; seen[s.key] = 1; return true; });
  }

  /* 메인 계산 */
  function calculate(input) {
    // input: {name, y, m, d, hour, minute, unknownTime, region, gender:'남'|'여', calendar:'양력'|'음력', leap}
    var y = input.y, m = input.m, d = input.d;
    if (input.calendar === '음력') {
      var ls = Lunar.fromYmd(y, input.leap ? -m : m, d).getSolar();
      y = ls.getYear(); m = ls.getMonth(); d = ls.getDay();
    }
    var hour = input.unknownTime ? 12 : input.hour, minute = input.unknownTime ? 0 : input.minute;
    var corr = solarCorrection(input.region, y, m, d);
    var t = new Date(Date.UTC(y, m - 1, d, hour, minute) + (input.unknownTime ? 0 : corr.minutes) * 60000);
    var solar = Solar.fromYmdHms(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), 0);
    var lunar = solar.getLunar(), ec = lunar.getEightChar();
    ec.setSect(2);

    var gz = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
    var pillars = gz.map(pillarOf);
    var hasHour = !input.unknownTime;
    var ds = pillars[2].stem, dEl = STEM_EL[ds];

    // 오행 비중: 천간 1, 지지 1.2(지장간 분배), 월지 2.0
    var score = [0, 0, 0, 0, 0], groupScore = [0, 0, 0, 0, 0];
    pillars.forEach(function (p, i) {
      if (i === 3 && !hasHour) return;
      score[STEM_EL[p.stem]] += 1;
      if (i !== 2) groupScore[Math.floor(tenGod(ds, p.stem) / 2)] += 1;
      var w = i === 1 ? 2.0 : 1.2;
      HIDDEN[p.branch].forEach(function (h) {
        score[STEM_EL[h[0]]] += w * h[1];
        groupScore[Math.floor(tenGod(ds, h[0]) / 2)] += w * h[1];
      });
    });
    var total = score.reduce(function (a, b) { return a + b; }, 0);
    var pct = score.map(function (s) { return Math.round(s / total * 100); });
    var diff = 100 - pct.reduce(function (a, b) { return a + b; }, 0);
    pct[pct.indexOf(Math.max.apply(null, pct))] += diff;

    // 신강·신약 → 억부 용신
    var support = pct[dEl] + pct[(dEl + 4) % 5];
    var strength = support >= 62 ? '매우 신강' : support >= 48 ? '신강' : support >= 35 ? '신약' : '매우 신약';
    var strong = support >= 48;
    var candidates = strong ? [(dEl + 1) % 5, (dEl + 2) % 5, (dEl + 3) % 5] : [(dEl + 4) % 5, dEl];
    candidates.sort(function (a, b) { return pct[a] - pct[b]; });
    var yong = candidates[0], hee = candidates[1];
    var gi = (yong + 3) % 5; // 용신을 극하는 오행
    if (gi === hee) gi = strong ? (dEl + 4) % 5 : (dEl + 2) % 5;
    function favor(el) { return el === yong ? 2 : el === hee ? 1 : el === gi ? -2 : (strong ? (el === dEl || el === (dEl + 4) % 5 ? -1 : 0) : (el === (dEl + 2) % 5 || el === (dEl + 3) % 5 ? -1 : 0)); }

    // 대운
    var yun = ec.getYun(input.gender === '남' ? 1 : 0);
    var birthYear = solar.getYear();
    var dayun = yun.getDaYun(11).slice(1).map(function (dy) {
      var p = pillarOf(dy.getGanZhi());
      var s = favor(STEM_EL[p.stem]) * 1.0 + favor(BRANCH_EL[p.branch]) * 1.2;
      if (CHUNG(p.branch, pillars[2].branch)) s -= 0.8;
      if (isHap(p.branch, pillars[2].branch)) s += 0.5;
      var startAge = dy.getStartYear() - birthYear;
      return { gz: dy.getGanZhi(), stem: p.stem, branch: p.branch, startYear: dy.getStartYear(), startAge: startAge, endAge: startAge + 10, score: s,
        stemGod: tenGod(ds, p.stem), branchGod: branchTenGod(ds, p.branch),
        chung: [0, 1, 2, 3].filter(function (i) { return (i < 3 || hasHour) && CHUNG(p.branch, pillars[i].branch); }).map(function (i) { return pillars[i].branch; }) };
    });

    // 인생 곡선: 대운 65% + 세운 35%
    var curve = [];
    for (var age = 0; age <= 100; age++) {
      var Y = birthYear + age, dyu = null;
      for (var k = 0; k < dayun.length; k++) if (dayun[k].startAge <= age) dyu = dayun[k];
      var yp = ganzhiOfYear(Y);
      var ys = favor(STEM_EL[yp.stem]) + favor(BRANCH_EL[yp.branch]) - (CHUNG(yp.branch, pillars[2].branch) ? 1 : 0);
      curve.push({ age: age, v: dyu ? dyu.score * .65 + ys * .35 : null, pre: !dyu });
    }

    // 사주로 본 MBTI 성향: 각 축의 첫 글자(E·S·T·J) 쪽 비율(%)
    var gTot = groupScore.reduce(function (a, b) { return a + b; }, 0);
    var G = groupScore.map(function (v) { return v / gTot * 100; }), P = pct;
    var lean = [
      50 + .6 * (G[1] + G[2] - G[4]) - .2 * G[0] + .5 * (P[1] - P[4]),
      50 + .5 * (P[2] + P[3] - P[0] - P[4]) + .4 * (G[2] - G[4]),
      50 + .6 * (P[3] + .3 * P[4] - P[1] - .3 * P[0]) + .3 * (G[3] + G[0] - G[1] - G[4]),
      50 + .5 * (P[2] + P[3] - P[0] - .5 * P[4] - .5 * P[1]) + .5 * (G[3] - G[1])
    ].map(function (v) { return Math.round(clampN(v, 12, 88)); });
    var sajuMbti = (lean[0] >= 50 ? 'E' : 'I') + (lean[1] >= 50 ? 'S' : 'N') + (lean[2] >= 50 ? 'T' : 'F') + (lean[3] >= 50 ? 'J' : 'P');

    var startAge = dayun.length ? dayun[0].startAge : 0;
    return {
      input: input, solarDate: { y: y, m: m, d: d }, corrected: solar, corr: corr, lunarText: lunar.getYear() + '년 ' + (lunar.getMonth() < 0 ? '윤' : '') + Math.abs(lunar.getMonth()) + '월 ' + lunar.getDay() + '일',
      gz: gz, pillars: pillars, hasHour: hasHour, dayStem: ds, dayEl: dEl,
      pct: pct, groupScore: groupScore, support: support, strength: strength, strong: strong,
      yong: yong, hee: hee, gi: gi, favor: favor,
      sinsal: findSinsal(pillars, hasHour), gongmang: ec.getDayXunKong(),
      dayun: dayun, startAge: startAge, curve: curve, birthYear: birthYear,
      animal: ANIMALS[pillars[0].branch], nayin: ec.getDayNaYin(),
      mbtiLean: lean, sajuMbti: sajuMbti
    };
  }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 특정 날짜의 일진 */
  function dayPillar(date) {
    var s = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    var l = s.getLunar();
    return { gz: l.getDayInGanZhi(), p: pillarOf(l.getDayInGanZhi()), lunar: l, monthGz: l.getMonthInGanZhiExact(), yearGz: l.getYearInGanZhiByLiChun() };
  }

  global.Saju = {
    STEMS: STEMS, STEM_KO: STEM_KO, STEM_EL: STEM_EL, BRANCHES: BRANCHES, BRANCH_KO: BRANCH_KO, BRANCH_EL: BRANCH_EL,
    EL: EL, EL_HANJA: EL_HANJA, EL_KEY: EL_KEY, TEN_GODS: TEN_GODS, TEN_HANJA: TEN_HANJA, GROUPS: GROUPS, HIDDEN: HIDDEN,
    HOUR_RANGE: HOUR_RANGE, REGIONS: REGIONS, ANIMALS: ANIMALS,
    calculate: calculate, tenGod: tenGod, branchTenGod: branchTenGod, relOfElement: relOfElement, dayPillar: dayPillar,
    pillarOf: pillarOf, ganzhiOfYear: ganzhiOfYear, isChung: CHUNG, isHap: isHap
  };
})(window);
