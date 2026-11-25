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

  if (global.ZarifStore && global.ZarifStore.VERSION === '1.2.0') {
    return;
  }

  var KEYS = {
    contacts: 'zc_contacts_v1',
    tests: 'zc_test_results_v1',
    assignments: 'zc_assignments_v1',
    publishedTests: 'zc_published_tests_v1',
    liveClasses: 'zc_live_classes_v1',
    notifications: 'zc_notifications_v1',
    mockExams: 'zc_mock_exams_v1',
    mockAttempts: 'zc_mock_attempts_v1'
  };

  var MAX_ITEMS = {
    contacts: 300,
    tests: 500,
    assignments: 300,
    publishedTests: 250,
    liveClasses: 150,
    notifications: 200,
    mockExams: 120,
    mockAttempts: 200
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
  // 4. PUBLISHED TESTS (Öğretmen Onayla & Yayınla -> Öğrenci Soru & Test Merkezi)
  // =========================================================================
  var WORK_TYPE_LABELS = {
    coktan_secmeli: 'Çoktan Seçmeli Öğrenme Çıktısı Testi',
    baglam_temelli: 'Bağlam Temelli Beceri Sorusu (TYMM)',
    acik_uclu: 'Açık Uçlu & Gerekçelendirme (Rubrikli)',
    tanilayici_hizli: 'Tanılayıcı Hızlı Araçlar (D/Y & Grid)',
    performans_gorevi: 'Ünite Performans & Süreç Görevi'
  };

  var publishedTests = {
    WORK_TYPE_LABELS: WORK_TYPE_LABELS,

    list: function (filter) {
      var items = safeRead(KEYS.publishedTests, []);
      items.sort(function (a, b) {
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
        if (filter.grade && Number(item.grade) !== Number(filter.grade)) return false;
        if (filter.workType && filter.workType !== 'all' && item.workType !== filter.workType) return false;
        return true;
      });
    },

    publish: function (data) {
      var items = safeRead(KEYS.publishedTests, []);
      var now = new Date().toISOString();
      var workType = normalizeText(data && data.workType) || 'coktan_secmeli';
      var topicTitle = normalizeText(data && (data.topicTitle || data.topic)) || 'Genel Matematik';
      var questions = Array.isArray(data && data.questions) ? data.questions : [];
      var record = {
        id: (data && data.id) || uid('pub'),
        title: normalizeText(data && data.title) || (topicTitle + ' — ' + (WORK_TYPE_LABELS[workType] || 'Test')),
        grade: Number(data && data.grade) || 7,
        unitTopic: normalizeText(data && data.unitTopic),
        topicTitle: topicTitle,
        topicKey: slugify(topicTitle),
        workType: workType,
        workTypeLabel: normalizeText(data && data.workTypeLabel) || WORK_TYPE_LABELS[workType] || 'Öğrenme Çıktısı Testi',
        difficulty: normalizeText(data && data.difficulty) || 'Orta',
        questionCount: questions.length || Number(data && data.questionCount) || 0,
        questions: questions,
        teacherName: normalizeText(data && data.teacherName) || (global.localStorage && global.localStorage.getItem('zarif_teacher_name')) || 'Matematik Öğretmeni',
        status: (data && data.status === 'draft') ? 'draft' : 'published',
        createdAt: now,
        updatedAt: now
      };
      items.unshift(record);
      if (items.length > MAX_ITEMS.publishedTests) items = items.slice(0, MAX_ITEMS.publishedTests);
      safeWrite(KEYS.publishedTests, items);
      emitChange('publishedTests', 'publish', record);
      return record;
    },

    toggleStatus: function (id) {
      var items = safeRead(KEYS.publishedTests, []);
      var updated = null;
      items = items.map(function (item) {
        if (item.id === id) {
          updated = Object.assign({}, item, {
            status: item.status === 'published' ? 'draft' : 'published',
            updatedAt: new Date().toISOString()
          });
          return updated;
        }
        return item;
      });
      if (updated) {
        safeWrite(KEYS.publishedTests, items);
        emitChange('publishedTests', 'toggle', updated);
      }
      return updated;
    },

    remove: function (id) {
      var items = safeRead(KEYS.publishedTests, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.publishedTests, next);
        emitChange('publishedTests', 'remove', { id: id });
        return true;
      }
      return false;
    }
  };

  // =========================================================================
  // 5. NOTIFICATIONS (Veli / Öğrenci / Öğretmen Canlı Bildirim Merkezi)
  // =========================================================================
  var notifications = {
    list: function (filter) {
      var items = safeRead(KEYS.notifications, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.audience && filter.audience !== 'all' && item.audience !== 'all' && item.audience !== filter.audience) return false;
        if (filter.unreadOnly && item.read) return false;
        if (filter.type && item.type !== filter.type) return false;
        return true;
      });
    },

    add: function (data) {
      var items = safeRead(KEYS.notifications, []);
      var now = new Date().toISOString();
      var record = {
        id: (data && data.id) || uid('ntf'),
        audience: normalizeText(data && data.audience) || 'parent', // 'parent' | 'student' | 'teacher' | 'all'
        type: normalizeText(data && data.type) || 'general', // 'live_class_15m' | 'assignment' | 'exam' | 'general'
        title: normalizeText(data && data.title) || 'ZarifÇözüm Bildirimi',
        message: normalizeText(data && data.message) || '',
        lessonId: normalizeText(data && data.lessonId),
        lessonTitle: normalizeText(data && data.lessonTitle),
        startsAt: normalizeText(data && data.startsAt),
        zoomUrl: normalizeText(data && data.zoomUrl),
        read: false,
        createdAt: now
      };
      items.unshift(record);
      if (items.length > MAX_ITEMS.notifications) items = items.slice(0, MAX_ITEMS.notifications);
      safeWrite(KEYS.notifications, items);
      emitChange('notifications', 'add', record);
      return record;
    },

    markRead: function (id) {
      var items = safeRead(KEYS.notifications, []);
      var updated = null;
      items = items.map(function (item) {
        if (item.id === id) {
          updated = Object.assign({}, item, { read: true });
          return updated;
        }
        return item;
      });
      if (updated) {
        safeWrite(KEYS.notifications, items);
        emitChange('notifications', 'read', updated);
      }
      return updated;
    },

    markAllRead: function (audience) {
      var items = safeRead(KEYS.notifications, []);
      var changed = false;
      items = items.map(function (item) {
        var matches = !audience || audience === 'all' || item.audience === audience || item.audience === 'all';
        if (matches && !item.read) {
          changed = true;
          return Object.assign({}, item, { read: true });
        }
        return item;
      });
      if (changed) {
        safeWrite(KEYS.notifications, items);
        emitChange('notifications', 'readAll', { audience: audience || 'all' });
      }
      return changed;
    },

    unreadCount: function (audience) {
      return notifications.list({ audience: audience || 'all', unreadOnly: true }).length;
    },

    remove: function (id) {
      var items = safeRead(KEYS.notifications, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.notifications, next);
        emitChange('notifications', 'remove', { id: id });
        return true;
      }
      return false;
    }
  };

  // =========================================================================
  // 6. LIVE CLASSES (Öğretmen Zoom Planlama -> Öğrenci Canlı Ders & Veli 15 Dk Uyarısı)
  // =========================================================================
  var liveClasses = {
    list: function (filter) {
      var items = safeRead(KEYS.liveClasses, []);
      items.sort(function (a, b) {
        return new Date(a.startsAt || 0) - new Date(b.startsAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
        if (filter.grade && Number(item.grade) !== Number(filter.grade)) return false;
        return true;
      });
    },

    upsert: function (data) {
      var items = safeRead(KEYS.liveClasses, []);
      var now = new Date().toISOString();
      var id = (data && data.id) || uid('live');
      var existingIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { existingIdx = i; break; }
      }
      var existing = existingIdx >= 0 ? items[existingIdx] : {};
      var record = Object.assign({}, existing, {
        id: id,
        title: normalizeText((data && data.title) || existing.title) || 'Matematik Canlı Dersi',
        teacherName: normalizeText((data && data.teacherName) || existing.teacherName) || (global.localStorage && global.localStorage.getItem('zarif_teacher_name')) || 'Matematik Öğretmeni',
        grade: Number((data && data.grade) || existing.grade) || 7,
        startsAt: normalizeText((data && data.startsAt) || existing.startsAt) || now,
        duration: Number((data && data.duration) || existing.duration) || 45,
        zoomUrl: normalizeText((data && (data.zoomUrl || data.link)) || existing.zoomUrl) || '/canli.html',
        meetingId: normalizeText((data && data.meetingId) || existing.meetingId),
        status: normalizeText((data && data.status) || existing.status) || 'scheduled', // 'scheduled' | 'active' | 'completed'
        recordingUrl: normalizeText((data && data.recordingUrl) || existing.recordingUrl),
        notified15m: Boolean(data && typeof data.notified15m === 'boolean' ? data.notified15m : existing.notified15m),
        updatedAt: now,
        createdAt: existing.createdAt || now
      });

      if (existingIdx >= 0) items[existingIdx] = record;
      else items.unshift(record);
      if (items.length > MAX_ITEMS.liveClasses) items = items.slice(0, MAX_ITEMS.liveClasses);
      safeWrite(KEYS.liveClasses, items);
      emitChange('liveClasses', existingIdx >= 0 ? 'update' : 'add', record);
      liveClasses.checkAndTrigger15MinParentAlerts();
      return record;
    },

    markActive: function (id, zoomUrl) {
      var items = safeRead(KEYS.liveClasses, []);
      var updated = null;
      items = items.map(function (item) {
        if (item.id === id) {
          updated = Object.assign({}, item, {
            status: 'active',
            zoomUrl: zoomUrl || item.zoomUrl || '/canli.html',
            updatedAt: new Date().toISOString()
          });
          return updated;
        }
        return item;
      });
      if (updated) {
        safeWrite(KEYS.liveClasses, items);
        emitChange('liveClasses', 'active', updated);
      }
      return updated;
    },

    sendParent15MinAlert: function (lesson) {
      var cls = lesson || {};
      var titleText = normalizeText(cls.title) || 'Matematik Canlı Dersi';
      return notifications.add({
        audience: 'parent',
        type: 'live_class_15m',
        title: '🎥 Canlı Ders 15 Dakika İçinde Başlıyor',
        message: 'Sayın Veli, öğrencinizin Matematik Canlı Dersi 15 dakika içinde Zoom üzerinden başlayacaktır.',
        lessonId: cls.id || '',
        lessonTitle: titleText,
        startsAt: cls.startsAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        zoomUrl: cls.zoomUrl || '/canli.html'
      });
    },

    checkAndTrigger15MinParentAlerts: function () {
      var items = safeRead(KEYS.liveClasses, []);
      var nowMs = Date.now();
      var triggered = [];
      var changed = false;

      items = items.map(function (item) {
        if (item.status !== 'scheduled' || item.notified15m) return item;
        var startMs = new Date(item.startsAt || 0).getTime();
        if (!Number.isFinite(startMs)) return item;
        var diffMs = startMs - nowMs;
        if (diffMs > 0 && diffMs <= 15 * 60 * 1000) {
          changed = true;
          var ntf = liveClasses.sendParent15MinAlert(item);
          triggered.push(ntf);
          return Object.assign({}, item, { notified15m: true, updatedAt: new Date().toISOString() });
        }
        return item;
      });

      if (changed) {
        safeWrite(KEYS.liveClasses, items);
        emitChange('liveClasses', 'notified15m', { count: triggered.length });
      }
      return triggered;
    },

    remove: function (id) {
      var items = safeRead(KEYS.liveClasses, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.liveClasses, next);
        emitChange('liveClasses', 'remove', { id: id });
        return true;
      }
      return false;
    }
  };

  // =========================================================================
  // 7. MOCK EXAMS (İl Geneli & Türkiye Geneli Deneme Sınavları + Optik Karneler)
  // =========================================================================
  var mockExams = {
    list: function (filter) {
      var items = safeRead(KEYS.mockExams, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      if (!filter) return items;
      return items.filter(function (item) {
        if (filter.scope && filter.scope !== 'all' && item.scope !== filter.scope) return false;
        if (filter.grade && Number(item.grade) !== Number(filter.grade)) return false;
        return true;
      });
    },

    publish: function (data) {
      var items = safeRead(KEYS.mockExams, []);
      var now = new Date().toISOString();
      var scope = (data && data.scope === 'il') ? 'il' : 'turkiye';
      var province = normalizeText(data && data.province) || 'Samsun';
      var questions = Array.isArray(data && data.questions) ? data.questions : [];
      var record = {
        id: (data && data.id) || uid('deneme'),
        title: normalizeText(data && data.title) || (scope === 'il' ? (province + ' İl Geneli Matematik Denemesi') : 'Türkiye Geneli Matematik Denemesi'),
        grade: Number(data && data.grade) || 5,
        scope: scope, // 'turkiye' | 'il'
        province: scope === 'il' ? province : 'Türkiye Geneli',
        durationMin: Number(data && data.durationMin) || Math.max(15, questions.length * 2),
        startsAt: normalizeText(data && data.startsAt) || now,
        isFreeIntro: Boolean(data && data.isFreeIntro),
        teacherName: normalizeText(data && data.teacherName) || (global.localStorage && global.localStorage.getItem('zarif_teacher_name')) || 'ZarifÇözüm Ölçme Kurulu',
        questions: questions,
        status: 'published',
        createdAt: now
      };
      items.unshift(record);
      if (items.length > MAX_ITEMS.mockExams) items = items.slice(0, MAX_ITEMS.mockExams);
      safeWrite(KEYS.mockExams, items);
      emitChange('mockExams', 'publish', record);
      return record;
    },

    remove: function (id) {
      var items = safeRead(KEYS.mockExams, []);
      var next = items.filter(function (item) { return item.id !== id; });
      if (next.length !== items.length) {
        safeWrite(KEYS.mockExams, next);
        emitChange('mockExams', 'remove', { id: id });
        return true;
      }
      return false;
    },

    listAttempts: function () {
      var items = safeRead(KEYS.mockAttempts, []);
      items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      return items;
    },

    recordAttempt: function (data) {
      var items = safeRead(KEYS.mockAttempts, []);
      var record = Object.assign({
        id: uid('att'),
        createdAt: new Date().toISOString()
      }, data || {});
      items.unshift(record);
      if (items.length > MAX_ITEMS.mockAttempts) items = items.slice(0, MAX_ITEMS.mockAttempts);
      safeWrite(KEYS.mockAttempts, items);
      emitChange('mockExams', 'attempt', record);
      if (record.total > 0) {
        tests.recordResult({
          grade: record.grade || 5,
          topicTitle: record.title || 'Deneme Sınavı',
          source: 'optik',
          total: record.total,
          correct: record.correct,
          wrong: record.wrong,
          blank: record.blank,
          score: record.score,
          durationSec: record.durationSec || 0
        });
      }
      return record;
    }
  };

  // =========================================================================
  // 8. EVENTS (Canlı Sekme & Sayfa İçi Senkronizasyon)
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
        else if (e.key === KEYS.publishedTests) matchedChannel = 'publishedTests';
        else if (e.key === KEYS.liveClasses) matchedChannel = 'liveClasses';
        else if (e.key === KEYS.notifications) matchedChannel = 'notifications';
        else if (e.key === KEYS.mockExams || e.key === KEYS.mockAttempts) matchedChannel = 'mockExams';
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
    VERSION: '1.2.0',
    KEYS: KEYS,
    contacts: contacts,
    tests: tests,
    assignments: assignments,
    publishedTests: publishedTests,
    liveClasses: liveClasses,
    notifications: notifications,
    mockExams: mockExams,
    events: events
  };
})(window);
