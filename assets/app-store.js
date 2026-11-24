/**
 * ZarifÇözüm Merkezi İstemci Veri Yöneticisi (App Store)
 * Tüm HTML panelleri (İletişim, Admin, Öğretmen, Öğrenci, Başarı Analizi, Testler)
 * arasında localStorage + canlı sekme senkronizasyonu (storage event) sağlar.
 *
 * Modüller:
 *  - ZarifStore.contacts    : İletişim & Destek talepleri (iletisim.html -> admin-paneli.html)
 *  - ZarifStore.tests       : Test / Pratik / Optik sınav sonuçları ve konu bazlı başarı analizi
 *  - ZarifStore.assignments : Öğretmen "Çalışma Ata" görevleri (ogretmen-paneli.html -> ogrenci-paneli.html)
 *  - ZarifStore.events      : Sekmeler arası ve sayfa içi canlı güncelleme aboneliği
 */
(function (global) {
  'use strict';

  if (global.ZarifStore && global.ZarifStore.VERSION === '1.0.0') {
    return;
  }

  var KEYS = {
    contacts: 'zc_contacts_v1',
    tests: 'zc_test_results_v1',
    assignments: 'zc_assignments_v1'
  };

  var MAX_ITEMS = {
    contacts: 300,
    tests: 500,
    assignments: 300
  };

  var EVENT_NAME = 'zarif:store-change';

  function uid(prefix) {
    return (prefix || 'zc') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function safeRead(key, fallback) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : (parsed || fallback);
    } catch (e) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function emitChange(channel, action, payload) {
    try {
      var detail = {
        channel: channel,
        action: action || 'update',
        payload: payload || null,
        ts: Date.now()
      };
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: detail }));
    } catch (e) {}
  }

  function normalizeText(str) {
    return String(str || '').trim();
  }

  function slugify(str) {
    return normalizeText(str)
      .toLowerCase()
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'genel';
  }

  // =========================================================================
  // 1. CONTACTS (İletişim Formu -> Admin Paneli)
  // =========================================================================
  var contacts = {
    list: function (filter) {
      var items = safeRead(KEYS.contacts, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
        if (filter.search) {
          var q = filter.search.toLowerCase();
          var hay = [item.name, item.email, item.phone, item.subject, item.message, item.role].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    },

    add: function (data) {
      var items = safeRead(KEYS.contacts, []);
      var now = new Date().toISOString();
      var record = {
        id: uid('msg'),
        name: normalizeText(data && data.name) || 'İsimsiz Ziyaretçi',
        email: normalizeText(data && data.email),
        phone: normalizeText(data && data.phone),
        role: normalizeText(data && data.role) || 'Öğrenci / Veli',
        subject: normalizeText(data && data.subject) || 'Genel Destek',
        message: normalizeText(data && data.message),
        status: 'new', // 'new' | 'read' | 'replied' | 'archived'
        createdAt: now,
        updatedAt: now
      };
      items.unshift(record);
      if (items.length > MAX_ITEMS.contacts) items = items.slice(0, MAX_ITEMS.contacts);
      safeWrite(KEYS.contacts, items);
      emitChange('contacts', 'add', record);
      return record;
    },

    updateStatus: function (id, status) {
      var allowed = ['new', 'read', 'replied', 'archived'];
      if (allowed.indexOf(status) === -1) return null;
      var items = safeRead(KEYS.contacts, []);
      var updated = null;
      items = items.map(function (item) {
        if (item.id === id) {
          updated = Object.assign({}, item, {
            status: status,
            updatedAt: new Date().toISOString()
          });
          return updated;
        }
        return item;
      });
      if (updated) {
        safeWrite(KEYS.contacts, items);
        emitChange('contacts', 'status', updated);
      }
      return updated;
    },

    remove: function (id) {
      var items = safeRead(KEYS.contacts, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.contacts, next);
        emitChange('contacts', 'remove', { id: id });
        return true;
      }
      return false;
    },

    unreadCount: function () {
      var items = safeRead(KEYS.contacts, []);
      return items.filter(function (item) { return item.status === 'new'; }).length;
    }
  };

  // =========================================================================
  // 2. TESTS (Test / Pratik / Optik Sonuçları -> Başarı Analizi & Öğrenci)
  // =========================================================================
  var tests = {
    list: function (filter) {
      var items = safeRead(KEYS.tests, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.grade && Number(item.grade) !== Number(filter.grade)) return false;
        if (filter.topicKey && item.topicKey !== filter.topicKey) return false;
        if (filter.source && item.source !== filter.source) return false;
        return true;
      });
    },

    recordResult: function (data) {
      var items = safeRead(KEYS.tests, []);
      var total = Math.max(1, Number(data && data.total) || 1);
      var correct = Math.max(0, Math.min(total, Number(data && data.correct) || 0));
      var wrong = typeof (data && data.wrong) === 'number' ? Math.max(0, data.wrong) : Math.max(0, total - correct);
      var blank = typeof (data && data.blank) === 'number' ? Math.max(0, data.blank) : Math.max(0, total - correct - wrong);
      var score = typeof (data && data.score) === 'number'
        ? Math.max(0, Math.min(100, Math.round(data.score)))
        : Math.round((correct / total) * 100);
      var topicTitle = normalizeText(data && data.topicTitle) || 'Genel Matematik';
      var topicKey = normalizeText(data && data.topicKey) || slugify(topicTitle);

      var record = {
        id: uid('tst'),
        topicKey: topicKey,
        topicTitle: topicTitle,
        grade: Number(data && data.grade) || 7,
        source: normalizeText(data && data.source) || 'mini-test', // 'mini-test' | 'pratik' | 'optik' | 'quiz'
        studentName: normalizeText(data && data.studentName) || 'Öğrenci',
        total: total,
        correct: correct,
        wrong: wrong,
        blank: blank,
        score: score,
        durationSec: Number(data && data.durationSec) || 0,
        createdAt: (data && data.createdAt) || new Date().toISOString()
      };

      items.unshift(record);
      if (items.length > MAX_ITEMS.tests) items = items.slice(0, MAX_ITEMS.tests);
      safeWrite(KEYS.tests, items);
      emitChange('tests', 'add', record);
      return record;
    },

    getTopicSummary: function (grade) {
      var items = tests.list(grade ? { grade: grade } : null);
      var map = {};
      items.forEach(function (it) {
        var key = it.topicKey || slugify(it.topicTitle);
        if (!map[key]) {
          map[key] = {
            topicKey: key,
            topicTitle: it.topicTitle,
            grade: it.grade,
            attempts: 0,
            scoreSum: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            lastScore: it.score,
            lastDate: it.createdAt
          };
        }
        map[key].attempts += 1;
        map[key].scoreSum += Number(it.score) || 0;
        map[key].totalQuestions += Number(it.total) || 0;
        map[key].totalCorrect += Number(it.correct) || 0;
      });

      var topics = Object.keys(map).map(function (k) {
        var entry = map[k];
        var avgScore = Math.round(entry.scoreSum / Math.max(1, entry.attempts));
        var status = avgScore >= 80 ? 'strong' : (avgScore >= 60 ? 'improving' : 'review');
        return {
          topicKey: entry.topicKey,
          topicTitle: entry.topicTitle,
          grade: entry.grade,
          attempts: entry.attempts,
          avgScore: avgScore,
          lastScore: entry.lastScore,
          totalQuestions: entry.totalQuestions,
          totalCorrect: entry.totalCorrect,
          lastDate: entry.lastDate,
          status: status
        };
      });

      topics.sort(function (a, b) { return a.avgScore - b.avgScore; });

      var weakest = topics.length ? topics[0] : null;
      var recommendation = weakest
        ? (weakest.avgScore < 60
            ? weakest.topicTitle + ' konusunda başarı oranın %' + weakest.avgScore + '. Önce konu özetini tekrar edip ardından 5 soruluk mini testi çözmeni öneririz.'
            : weakest.avgScore < 80
              ? weakest.topicTitle + ' konusunda %' + weakest.avgScore + ' seviyesindesin. Bir pratik seti daha çözerek %80 üzerine çıkabilirsin.'
              : 'Harika gidiyorsun! Tüm çalıştığın konularda %80 üzeri başarı yakaladın; yeni bir tema veya deneme sınavına geçebilirsin.')
        : 'Henüz kayıtlı test sonucun yok. İlk mini testi veya pratik setini çözdüğünde konu bazlı kişisel önerin burada oluşacak.';

      return {
        topics: topics,
        weakest: weakest,
        recommendation: recommendation
      };
    },

    getWeeklyTrend: function (weeks) {
      var count = weeks || 6;
      var items = tests.list();
      var now = Date.now();
      var weekMs = 7 * 24 * 60 * 60 * 1000;
      var buckets = [];
      for (var i = count - 1; i >= 0; i--) {
        buckets.push({
          label: 'H' + (count - i),
          start: now - (i + 1) * weekMs,
          end: now - i * weekMs,
          scores: []
        });
      }
      items.forEach(function (it) {
        var t = new Date(it.createdAt || 0).getTime();
        for (var b = 0; b < buckets.length; b++) {
          if (t >= buckets[b].start && t <= buckets[b].end) {
            buckets[b].scores.push(Number(it.score) || 0);
            break;
          }
        }
      });
      return buckets.map(function (b) {
        var avg = b.scores.length
          ? Math.round(b.scores.reduce(function (s, v) { return s + v; }, 0) / b.scores.length)
          : 0;
        return { label: b.label, avgScore: avg, count: b.scores.length };
      });
    },

    getStats: function () {
      var items = tests.list();
      var totalTests = items.length;
      var totalQuestions = 0;
      var totalCorrect = 0;
      var scoreSum = 0;
      var lowScoreCount = 0;
      items.forEach(function (it) {
        totalQuestions += Number(it.total) || 0;
        totalCorrect += Number(it.correct) || 0;
        scoreSum += Number(it.score) || 0;
        if ((Number(it.score) || 0) < 60) lowScoreCount += 1;
      });
      return {
        totalTests: totalTests,
        totalQuestions: totalQuestions,
        totalCorrect: totalCorrect,
        avgScore: totalTests ? Math.round(scoreSum / totalTests) : 0,
        lowScoreCount: lowScoreCount
      };
    }
  };

  // =========================================================================
  // 3. ASSIGNMENTS (Öğretmen "Çalışma Ata" -> Öğrenci Ödevler / Çalışma Planım)
  // =========================================================================
  var assignments = {
    list: function (filter) {
      var items = safeRead(KEYS.assignments, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
        if (filter.grade && Number(item.grade) !== Number(filter.grade)) return false;
        return true;
      });
    },

    add: function (data) {
      var items = safeRead(KEYS.assignments, []);
      var now = new Date().toISOString();
      var topicTitle = normalizeText(data && data.topicTitle) || 'Matematik Tekrar Çalışması';
      var defaultDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      var record = {
        id: uid('asg'),
        studentName: normalizeText(data && data.studentName) || 'Tüm Sınıf / Öğrenci',
        studentId: normalizeText(data && data.studentId),
        grade: Number(data && data.grade) || 7,
        topicKey: normalizeText(data && data.topicKey) || slugify(topicTitle),
        topicTitle: topicTitle,
        note: normalizeText(data && data.note) || 'Öğretmenin başarı analizine göre tekrar ve pratik çalışması atadı.',
        teacherName: normalizeText(data && data.teacherName) || (global.localStorage && global.localStorage.getItem('zarif_teacher_name')) || 'Matematik Öğretmeni',
        sourceTestTitle: normalizeText(data && data.sourceTestTitle),
        scoreAtAssign: typeof (data && data.scoreAtAssign) === 'number' ? data.scoreAtAssign : null,
        dueDate: normalizeText(data && data.dueDate) || defaultDue,
        status: 'pending', // 'pending' | 'completed'
        createdAt: now,
        completedAt: null
      };
      items.unshift(record);
      if (items.length > MAX_ITEMS.assignments) items = items.slice(0, MAX_ITEMS.assignments);
      safeWrite(KEYS.assignments, items);
      emitChange('assignments', 'add', record);
      return record;
    },

    toggleComplete: function (id) {
      var items = safeRead(KEYS.assignments, []);
      var updated = null;
      items = items.map(function (item) {
        if (item.id === id) {
          var nextStatus = item.status === 'completed' ? 'pending' : 'completed';
          updated = Object.assign({}, item, {
            status: nextStatus,
            completedAt: nextStatus === 'completed' ? new Date().toISOString() : null
          });
          return updated;
        }
        return item;
      });
      if (updated) {
        safeWrite(KEYS.assignments, items);
        emitChange('assignments', 'toggle', updated);
      }
      return updated;
    },

    remove: function (id) {
      var items = safeRead(KEYS.assignments, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.assignments, next);
        emitChange('assignments', 'remove', { id: id });
        return true;
      }
      return false;
    },

    pendingCount: function () {
      return safeRead(KEYS.assignments, []).filter(function (a) { return a.status !== 'completed'; }).length;
    }
  };

  // =========================================================================
  // 4. EVENTS (Canlı Sekme & Sayfa İçi Senkronizasyon)
  // =========================================================================
  var events = {
    subscribe: function (channel, callback) {
      if (typeof callback !== 'function') return function () {};

      function onCustom(e) {
        var detail = e && e.detail;
        if (!detail) return;
        if (channel === '*' || detail.channel === channel) {
          callback(detail);
        }
      }

      function onStorage(e) {
        if (!e || !e.key) return;
        var matchedChannel = null;
        if (e.key === KEYS.contacts) matchedChannel = 'contacts';
        else if (e.key === KEYS.tests) matchedChannel = 'tests';
        else if (e.key === KEYS.assignments) matchedChannel = 'assignments';
        if (matchedChannel && (channel === '*' || channel === matchedChannel)) {
          callback({ channel: matchedChannel, action: 'storage', ts: Date.now() });
        }
      }

      global.addEventListener(EVENT_NAME, onCustom);
      global.addEventListener('storage', onStorage);

      return function unsubscribe() {
        global.removeEventListener(EVENT_NAME, onCustom);
        global.removeEventListener('storage', onStorage);
      };
    }
  };

  global.ZarifStore = {
    VERSION: '1.0.0',
    KEYS: KEYS,
    contacts: contacts,
    tests: tests,
    assignments: assignments,
    events: events
  };
})(window);
