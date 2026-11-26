/**
 * ZarifÇözüm Anasayfa — Canlı Keşif Vitrini (Giriş Yapmadan 3 Canlı Oyun Demosu)
 * Kazanılan demo XP'leri doğrudan `zc_kesif_modu_v1` anahtarına kaydeder;
 * ziyaretçi kayıt olup öğrenci paneline geçtiğinde ilk Keşif XP'si hesabında hazır gelir.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'zc_kesif_modu_v1';
  var activeDemo = 'cube';
  var cleanupFn = null;

  var DEMOS = {
    cube: {
      gameId: 'g5_cube',
      kicker: '5. SINIF · GEOMETRİK CİSİMLER',
      title: '3D Küpü Çevir & 8 Köşeyi Keşfet',
      mission: 'Küpü farenle veya parmağınla 360° döndürerek 8 köşesinin tamamını bul ve altın rengiyle işaretle.'
    },
    elevator: {
      gameId: 'g6_elevator',
      kicker: '6. SINIF · TAM SAYILAR',
      title: 'Gökdelen Asansörü (Sayı Doğrusu)',
      mission: 'Asansörü −2 (Sığınak) katından +4 katına çıkar ve kaç kat yükseldiğini canlı gözlemle.'
    },
    balance: {
      gameId: 'g7_balance',
      kicker: '7. SINIF · CEBİR & DENKLEMLER',
      title: 'İnteraktif Cebir Terazisi (2x + 3 = 9)',
      mission: 'İki kefeden eşit ağırlıklar çıkarıp ikiye bölerek teraziyi devirmeden x\'i yalnız bırak.'
    }
  };

  function readCompleted() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function recordDemoWin(gameId) {
    var list = readCompleted();
    if (list.indexOf(gameId) === -1) {
      list.push(gameId);
      try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
    }
    updateXpFooter();
    var toast = document.getElementById('zcLiveDemoToast');
    if (toast) {
      toast.innerHTML = '🎊 Harika! <strong>+25 Keşif XP Kazandın!</strong> İlk XP\'n tarayıcı hafızana kaydedildi — üye olduğunda paneline otomatik aktarılır.';
      toast.classList.add('is-show');
    }
  }

  function updateXpFooter() {
    var count = readCompleted().length;
    var note = document.getElementById('zcLiveDemoXpNote');
    if (note) {
      note.innerHTML = count > 0
        ? ('⚡ Kazanılan Demo Ödülün: <strong>' + (count * 25) + ' Keşif XP</strong> (' + count + '/8 oyun tamamlandı)')
        : '✨ Hiçbir kayıt gerekmeden hemen dene — ilk görevi bitir, <strong>+25 Keşif XP</strong> kazan!';
    }
  }

  function setDemoStatus(msg, cls) {
    var el = document.getElementById('zcLiveDemoStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'zc-live-demo-status' + (cls ? ' ' + cls : '');
  }

  // --- DEMO 1: 3D KÜP ÇEVİR ---
  function mountCubeDemo(stage) {
    stage.innerHTML =
      '<canvas id="zcLiveDemoCubeCanvas" class="zc-live-demo-canvas" width="440" height="290"></canvas>' +
      '<div style="font-size:0.875rem;color:#6B5E57;font-weight:600;">🖱️ Sürükleyerek 360° çevir, köşe noktalarına dokun!</div>';

    var canvas = document.getElementById('zcLiveDemoCubeCanvas');
    var ctx = canvas.getContext('2d');
    var verts = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    var edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    var rotX = 0.45, rotY = 0.6;
    var found = new Set();
    var dragging = false, moved = 0, lx = 0, ly = 0, proj = [];

    function project(v) {
      var cy = Math.cos(rotY), sy = Math.sin(rotY);
      var x1 = v[0] * cy - v[2] * sy;
      var z1 = v[0] * sy + v[2] * cy;
      var cx = Math.cos(rotX), sx = Math.sin(rotX);
      var y2 = v[1] * cx - z1 * sx;
      var z2 = v[1] * sx + z1 * cx;
      var sc = 235 / (4.1 - z2);
      return { x: canvas.width / 2 + x1 * sc, y: canvas.height / 2 + y2 * sc, z: z2 };
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      proj = verts.map(project);
      edges.forEach(function (e) {
        var p1 = proj[e[0]], p2 = proj[e[1]];
        var avgZ = (p1.z + p2.z) / 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = avgZ > 0 ? 2.8 : 1.6;
        ctx.strokeStyle = avgZ > 0 ? '#3B281E' : 'rgba(107,94,87,0.4)';
        ctx.setLineDash(avgZ > 0 ? [] : [5, 4]);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      proj.map(function (p, i) { return { x: p.x, y: p.y, z: p.z, i: i }; })
        .sort(function (a, b) { return a.z - b.z; })
        .forEach(function (p) {
          var isF = found.has(p.i);
          ctx.beginPath();
          ctx.arc(p.x, p.y, isF ? 11 : 9, 0, Math.PI * 2);
          ctx.fillStyle = isF ? '#D4A359' : '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = isF ? '#3B281E' : '#C85A17';
          ctx.stroke();
          if (isF) {
            ctx.fillStyle = '#2C221E';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', p.x, p.y + 0.5);
          }
        });
    }

    function onDown(e) { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); }
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      moved += Math.hypot(dx, dy);
      rotY += dx * 0.013; rotX += dy * 0.013;
      lx = e.clientX; ly = e.clientY;
      draw();
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      if (moved < 8) {
        var r = canvas.getBoundingClientRect();
        var px = (e.clientX - r.left) * (canvas.width / r.width);
        var py = (e.clientY - r.top) * (canvas.height / r.height);
        var hit = -1, best = 24;
        proj.forEach(function (p, i) {
          var d = Math.hypot(p.x - px, p.y - py);
          if (d < best) { best = d; hit = i; }
        });
        if (hit !== -1) {
          found.add(hit);
          draw();
          if (found.size === 8) {
            setDemoStatus('🎉 Tebrikler! Küpün 8 köşesini de keşfettin!', 'is-ok');
            recordDemoWin('g5_cube');
          } else {
            setDemoStatus('Bulunan Köşe: ' + found.size + ' / 8 — Küpü arkaya çevirmeyi unutma!');
          }
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    setDemoStatus('Bulunan Köşe: 0 / 8 (Küpü çevir ve köşelere tıkla)');
    draw();
    return function () {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
  }

  // --- DEMO 2: GÖKDELEN ASANSÖRÜ ---
  function mountElevatorDemo(stage) {
    var floors = [5, 4, 3, 2, 1, 0, -1, -2, -3];
    var names = { 5: 'Teras (+5)', 4: '4. Kat', 3: '3. Kat', 2: '2. Kat', 1: '1. Kat', 0: 'Giriş (0)', '-1': 'Bodrum 1', '-2': 'Sığınak (−2)', '-3': 'Otopark (−3)' };
    var cur = -2;

    function renderElev() {
      stage.innerHTML =
        '<div class="zc-live-demo-elev">' +
          '<div class="zc-live-demo-axis">' +
            floors.map(function (f) { return '<span style="color:' + (f === cur ? '#C85A17' : '#6B5E57') + ';">' + (f > 0 ? '+' + f : f) + '</span>'; }).join('') +
          '</div>' +
          '<div class="zc-live-demo-shaft" id="zcLiveElevShaft">' +
            floors.map(function (f) {
              return '<button type="button" class="zc-live-demo-floor' + (f === cur ? ' is-cur' : '') + '" data-demo-fl="' + f + '"><span>' + names[f] + '</span><span>' + (f === cur ? '🛗' : '') + '</span></button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">' +
          '<button type="button" class="zc-live-demo-btn espresso" id="zcDemoUp">▲ 1 Kat Yukarı (+1)</button>' +
          '<button type="button" class="zc-live-demo-btn espresso" id="zcDemoDown">▼ 1 Kat Aşağı (−1)</button>' +
        '</div>';

      var go = function (next) {
        cur = Math.max(-3, Math.min(5, next));
        if (cur === 4) {
          setDemoStatus('🎉 Başardın! −2. kattan +4. kata tam 6 kat yükseldin!', 'is-ok');
          recordDemoWin('g6_elevator');
        } else {
          setDemoStatus('Şu an ' + names[cur] + ' katındasın. Hedef: +4. Kat');
        }
        renderElev();
      };

      document.getElementById('zcDemoUp').addEventListener('click', function () { go(cur + 1); });
      document.getElementById('zcDemoDown').addEventListener('click', function () { go(cur - 1); });
      document.getElementById('zcLiveElevShaft').addEventListener('click', function (e) {
        var b = e.target.closest('[data-demo-fl]');
        if (b) go(Number(b.dataset.demoFl));
      });
    }

    setDemoStatus('Asansör −2 (Sığınak) katında. +4 katına çıkar!');
    renderElev();
    return null;
  }

  // --- DEMO 3: CEBİR TERAZİSİ ---
  function mountBalanceDemo(stage) {
    var TRUE_X = 3;
    var leftX = 2, leftC = 3, rightC = 9;

    function renderBal() {
      var lw = leftX * TRUE_X + leftC, rw = rightC;
      var diff = rw - lw;
      var deg = Math.max(-15, Math.min(15, diff * 3.2));
      var ok = diff === 0;
      var solved = ok && leftX === 1 && leftC === 0 && rightC === 3;
      var lTxt = (leftX > 0 ? (leftX === 1 ? 'x' : leftX + 'x') : '') + (leftC > 0 ? (leftX > 0 ? ' + ' + leftC : String(leftC)) : '');

      stage.innerHTML =
        '<div style="font-family:Plus Jakarta Sans,sans-serif;font-size:1.35rem;font-weight:800;color:' + (ok ? '#1E7550' : '#C85A17') + ';">' +
          (lTxt || '0') + (ok ? ' = ' : (lw > rw ? ' > ' : ' < ')) + rightC +
        '</div>' +
        '<svg viewBox="0 0 360 190" width="100%" style="max-width:390px;" aria-label="Cebir Terazisi">' +
          '<path d="M148 178 L212 178 L180 130 Z" fill="#3B281E"/>' +
          '<rect x="176" y="44" width="8" height="90" rx="4" fill="#6B5E57"/>' +
          '<circle cx="180" cy="48" r="9" fill="' + (ok ? '#1E7550' : '#C85A17') + '"/>' +
          '<g transform="rotate(' + deg + ' 180 48)" style="transition:transform 0.35s ease;">' +
            '<rect x="44" y="44" width="272" height="8" rx="4" fill="' + (ok ? '#1E7550' : '#C85A17') + '"/>' +
            '<line x1="74" y1="52" x2="74" y2="98" stroke="#6B5E57" stroke-width="2.2"/>' +
            '<rect x="28" y="98" width="92" height="10" rx="5" fill="#D4A359"/>' +
            '<text x="74" y="88" text-anchor="middle" font-size="14" font-weight="800" fill="#2C221E">' + (lTxt || '0') + '</text>' +
            '<line x1="286" y1="52" x2="286" y2="98" stroke="#6B5E57" stroke-width="2.2"/>' +
            '<rect x="240" y="98" width="92" height="10" rx="5" fill="#D4A359"/>' +
            '<text x="286" y="88" text-anchor="middle" font-size="14" font-weight="800" fill="#2C221E">' + rightC + '</text>' +
          '</g>' +
        '</svg>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">' +
          '<button type="button" class="zc-live-demo-btn" id="zcDemoLSub">Sol −1</button>' +
          '<button type="button" class="zc-live-demo-btn" id="zcDemoRSub">Sağ −1</button>' +
          '<button type="button" class="zc-live-demo-btn espresso" id="zcDemoDiv2">➗ İki Kefeyi ÷2</button>' +
        '</div>';

      if (solved) {
        setDemoStatus('🎉 Mükemmel! x = 3 yalnız kaldı ve terazi tam dengede!', 'is-ok');
        recordDemoWin('g7_balance');
      } else if (!ok) {
        setDemoStatus('⚠️ Denge bozuldu! Diğer kefeden de aynı işlemi yapmalısın.', 'is-warn');
      } else {
        setDemoStatus('✓ Terazi dengede! İki kefeden 3\'er çıkar, sonra 2\'ye böl.');
      }

      document.getElementById('zcDemoLSub').addEventListener('click', function () { if (leftC > 0) leftC--; renderBal(); });
      document.getElementById('zcDemoRSub').addEventListener('click', function () { if (rightC > 0) rightC--; renderBal(); });
      document.getElementById('zcDemoDiv2').addEventListener('click', function () {
        if (!ok) { setDemoStatus('⚠️ Önce iki kefeyi eşitleyip dengeye getir!', 'is-warn'); return; }
        if (leftX % 2 === 0 && leftC % 2 === 0 && rightC % 2 === 0) { leftX /= 2; leftC /= 2; rightC /= 2; renderBal(); }
        else setDemoStatus('İkiye bölebilmek için önce iki kefeden 3\'er 1\'lik çıkar!', 'is-warn');
      });
    }

    renderBal();
    return null;
  }

  function selectDemo(key) {
    if (typeof cleanupFn === 'function') { cleanupFn(); cleanupFn = null; }
    activeDemo = DEMOS[key] ? key : 'cube';
    var meta = DEMOS[activeDemo];

    document.querySelectorAll('.zc-live-demo-tab[data-demo-key]').forEach(function (b) {
      var act = b.dataset.demoKey === activeDemo;
      b.classList.toggle('is-active', act);
      b.setAttribute('aria-selected', String(act));
    });

    document.getElementById('zcLiveDemoKicker').textContent = meta.kicker;
    document.getElementById('zcLiveDemoTitle').textContent = meta.title;
    document.getElementById('zcLiveDemoMission').textContent = meta.mission;
    var toast = document.getElementById('zcLiveDemoToast');
    if (toast) toast.classList.remove('is-show');

    var stage = document.getElementById('zcLiveDemoStage');
    if (!stage) return;
    if (activeDemo === 'cube') cleanupFn = mountCubeDemo(stage);
    else if (activeDemo === 'elevator') cleanupFn = mountElevatorDemo(stage);
    else if (activeDemo === 'balance') cleanupFn = mountBalanceDemo(stage);
  }

  function init() {
    var tabs = document.getElementById('zcLiveDemoTabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.zc-live-demo-tab[data-demo-key]');
      if (btn) selectDemo(btn.dataset.demoKey);
    });
    document.getElementById('zcLiveDemoResetBtn')?.addEventListener('click', function () {
      selectDemo(activeDemo);
    });
    updateXpFooter();
    selectDemo('cube');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
