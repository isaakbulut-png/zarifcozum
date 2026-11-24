const express = require('express');
const mongoose = require('mongoose');
const TopicContent = require('../models/TopicContent');
const StudentTopicProgress = require('../models/StudentTopicProgress');
const User = require('../models/User');
const { getCurriculumTree } = require('../lib/meb-curriculum');
const { getAllowedGradesForStudent, canStudentAccessGrade } = require('../lib/konu-erisimi');
const { resolveUserPlan } = require('../middleware/aiQuota');

async function resolveStudentAccess(sessionUser) {
  const isStaff = Boolean(sessionUser && (sessionUser.role === 'admin' || sessionUser.role === 'teacher' || sessionUser.adminRole));
  if (isStaff) {
    return {
      isStaff: true,
      plan: 'vip',
      registeredGrade: 8,
      allowedGrades: [5, 6, 7, 8, 9, 10, 11, 12],
      userDoc: sessionUser
    };
  }
  const uid = String(sessionUser?._id || sessionUser?.id || '');
  const userDoc = uid
    ? await User.findById(uid).select('role subscriptionStatus subscriptionPlan subscriptionTier paketTipi expiresAt subscriptionEndDate grade kayitliSinif seciliTelafiSinif').lean()
    : null;
  const effectiveUser = userDoc || sessionUser || { role: 'student' };
  const plan = resolveUserPlan(effectiveUser);
  const registeredGrade = Number(effectiveUser.kayitliSinif || effectiveUser.grade) || 8;
  const allowedGrades = getAllowedGradesForStudent({ ...effectiveUser, role: 'student', kayitliSinif: registeredGrade });
  return {
    isStaff: false,
    plan,
    registeredGrade,
    allowedGrades,
    userDoc: { ...effectiveUser, role: 'student', kayitliSinif: registeredGrade }
  };
}

function deriveThemeCode(grade, themeTitle, outcomeCode, themeIndex) {
  if (outcomeCode && typeof outcomeCode === 'string') {
    const parts = outcomeCode.trim().split('.');
    if (parts.length >= 3) return parts.slice(0, 3).join('.');
    if (outcomeCode.trim()) return outcomeCode.trim();
  }
  const numMatch = String(themeTitle || '').match(/^(\d+)\./);
  const idx = numMatch ? numMatch[1] : String((themeIndex || 0) + 1);
  return `MAT.${grade}.${idx}`;
}

function normalizeLessonPages(doc) {
  if (Array.isArray(doc.lessonPages) && doc.lessonPages.length > 0) {
    return doc.lessonPages.map((p, i) => ({
      pageNumber: p.pageNumber || (i + 1),
      title: p.title || `${i + 1}. Sayfa`,
      storyOrContext: p.storyOrContext || '',
      keyRuleBox: p.keyRuleBox || '',
      visualSvg: p.visualSvg || p.svgDiagram || '',
      commonMistakeBox: p.commonMistakeBox || '',
      miniChallenge: p.miniChallenge || '',
      content: p.content || '',
      svgDiagram: p.svgDiagram || p.visualSvg || ''
    }));
  }
  const raw = doc.detailed_content || '';
  if (!raw) return [];
  const parts = raw.split(/\[SAYFA_(\d+)\]/gi);
  const defaultTitles = [
    'Gerçek Hayat Keşfi',
    'Kavram İnşası & Şemalar',
    'Çözümlü Örnekler',
    'Kavram Yanılgıları',
    'Kendini Dene'
  ];
  if (parts.length >= 3) {
    const pages = [];
    for (let i = 1; i < parts.length; i += 2) {
      const no = Number(parts[i]) || (pages.length + 1);
      pages.push({
        pageNumber: no,
        title: defaultTitles[no - 1] || `${no}. Sayfa`,
        content: (parts[i + 1] || '').trim(),
        svgDiagram: ''
      });
    }
    return pages;
  }
  return [{ pageNumber: 1, title: doc.title || doc.subTopicTitle || doc.sub_topic || 'Konu Anlatımı', content: raw, svgDiagram: '' }];
}

function createStudentTopicsRouter({ requireAuth }) {
  const router = express.Router();

  // 1. Yayınlanmış konuları tema kartları halinde, paket kilidi ve öğrenci ilerlemesiyle getir (0 AI Maliyeti)
  router.get('/', requireAuth, async (req, res) => {
    try {
      const studentId = String(req.session.user._id || req.session.user.id);
      const access = await resolveStudentAccess(req.session.user);
      const requestedGrade = Number(req.query.grade);
      const grade = (requestedGrade >= 5 && requestedGrade <= 12) ? requestedGrade : access.registeredGrade;
      const gradeLocked = !access.isStaff && !access.allowedGrades.includes(grade);
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase('tr-TR') : '';

      const [topics, gradeProgress, lastProgressDoc] = await Promise.all([
        TopicContent.find({ grade, status: 'published' })
          .sort({ order: 1, createdAt: 1 })
          .lean(),
        StudentTopicProgress.find({ studentId, grade }).lean(),
        StudentTopicProgress.findOne({ studentId })
          .sort({ lastAccessedAt: -1 })
          .populate('topicId', 'grade themeCode themeTitle unit_topic subTopicTitle sub_topic title status')
          .lean()
      ]);

      const progressByTopicId = new Map();
      gradeProgress.forEach(p => {
        progressByTopicId.set(String(p.topicId), p);
      });

      // Müfredat ağacından tema sırası ve kod referansı al
      const tree = getCurriculumTree();
      const gradeTreeTemalar = tree[String(grade)]?.temalar ? Object.keys(tree[String(grade)].temalar) : [];

      const themesMap = new Map();
      topics.forEach(t => {
        const tTitle = t.themeTitle || t.unit_topic || 'Genel';
        const sTitle = t.subTopicTitle || t.sub_topic || t.title || 'Alt Konu';

        if (q) {
          const haystack = `${tTitle} ${sTitle} ${t.themeCode || ''} ${t.outcome_code || ''} ${t.short_summary || ''}`.toLocaleLowerCase('tr-TR');
          if (!haystack.includes(q)) return;
        }

        const treeIdx = gradeTreeTemalar.indexOf(tTitle);
        const tCode = t.themeCode || deriveThemeCode(grade, tTitle, t.outcome_code, treeIdx >= 0 ? treeIdx : themesMap.size);

        if (!themesMap.has(tTitle)) {
          themesMap.set(tTitle, {
            themeCode: tCode,
            themeTitle: tTitle,
            sortOrder: treeIdx >= 0 ? treeIdx : 999,
            topics: [],
            completedCount: 0,
            inProgressCount: 0,
            totalCount: 0
          });
        }

        const prog = progressByTopicId.get(String(t._id));
        const status = prog?.status || 'not_started';
        const bucket = themesMap.get(tTitle);

        bucket.totalCount += 1;
        if (status === 'completed') bucket.completedCount += 1;
        else if (status === 'in_progress') bucket.inProgressCount += 1;

        bucket.topics.push({
          id: String(t._id),
          grade: t.grade,
          themeCode: tCode,
          themeTitle: tTitle,
          subTopicTitle: sTitle,
          title: t.title || sTitle,
          outcome_code: t.outcome_code || '',
          short_summary: t.short_summary || '',
          pageCount: (Array.isArray(t.lessonPages) && t.lessonPages.length) ? t.lessonPages.length : 5,
          practicalNotesCount: Array.isArray(t.practicalNotes) ? t.practicalNotes.length : 0,
          flashcardsCount: Array.isArray(t.flashcards) ? t.flashcards.length : 0,
          progressStatus: status,
          lastPage: prog?.lastPage || 1,
          lastAccessedAt: prog?.lastAccessedAt || null,
          completedAt: prog?.completedAt || null
        });
      });

      const themes = Array.from(themesMap.values())
        .sort((a, b) => a.sortOrder - b.sortOrder || a.themeTitle.localeCompare(b.themeTitle, 'tr'))
        .map((th, themeIdx) => {
          const isFreePlan = !access.isStaff && access.plan === 'free';
          const themeLocked = gradeLocked || (isFreePlan && themeIdx > 0);
          const mappedTopics = th.topics.map((tp, topicIdx) => {
            const topicLocked = gradeLocked || (isFreePlan && (themeIdx > 0 || topicIdx > 0));
            return {
              ...tp,
              locked: topicLocked,
              isFreeTrial: isFreePlan && !gradeLocked && themeIdx === 0 && topicIdx === 0,
              lockReason: gradeLocked ? 'GRADE_LOCKED' : (topicLocked ? 'PLAN_UPGRADE_REQUIRED' : null)
            };
          });
          return {
            themeCode: th.themeCode,
            themeTitle: th.themeTitle,
            completedCount: th.completedCount,
            inProgressCount: th.inProgressCount,
            totalCount: th.totalCount,
            percent: th.totalCount > 0 ? Math.round((th.completedCount / th.totalCount) * 100) : 0,
            locked: themeLocked,
            isFreeTrial: isFreePlan && !gradeLocked && themeIdx === 0,
            lockReason: gradeLocked ? 'GRADE_LOCKED' : (themeLocked ? 'PLAN_UPGRADE_REQUIRED' : null),
            topics: mappedTopics
          };
        });

      const overallTotal = topics.length;
      const overallCompleted = topics.filter(t => progressByTopicId.get(String(t._id))?.status === 'completed').length;
      const overallPercent = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

      // Kaldığın yerden devam et şeridi
      let lastAccessed = null;
      if (lastProgressDoc && lastProgressDoc.topicId && lastProgressDoc.topicId.status === 'published') {
        const lt = lastProgressDoc.topicId;
        lastAccessed = {
          topicId: String(lt._id),
          grade: lt.grade,
          themeCode: lt.themeCode || lastProgressDoc.themeCode || `MAT.${lt.grade}`,
          themeTitle: lt.themeTitle || lt.unit_topic || lastProgressDoc.themeTitle || '',
          subTopicTitle: lt.subTopicTitle || lt.sub_topic || lt.title || lastProgressDoc.subTopicTitle || '',
          status: lastProgressDoc.status,
          lastPage: lastProgressDoc.lastPage || 1,
          percent: lastProgressDoc.status === 'completed' ? 100 : Math.min(90, Math.round(((lastProgressDoc.lastPage || 1) / 5) * 100)),
          lastAccessedAt: lastProgressDoc.lastAccessedAt
        };
      }

      res.json({
        basarili: true,
        grade,
        access: {
          plan: access.plan,
          isStaff: access.isStaff,
          registeredGrade: access.registeredGrade,
          allowedGrades: access.allowedGrades,
          gradeLocked
        },
        overall: {
          completed: overallCompleted,
          total: overallTotal,
          percent: overallPercent
        },
        lastAccessed,
        themes
      });
    } catch (err) {
      console.error('[StudentTopics] Liste hatası:', err);
      res.status(500).json({ mesaj: 'Konu listesi alınamadı: ' + err.message });
    }
  });

  // 2. Tek bir yayınlanmış konuyu aç ve ilerlemeyi in_progress olarak kaydet (0 AI Maliyeti)
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const topic = await TopicContent.findOne({ _id: id, status: 'published' }).lean();
      if (!topic) {
        return res.status(404).json({ mesaj: 'Yayınlanmış konu anlatımı bulunamadı.' });
      }

      // Paket & Sınıf Erişim Kilidi Denetimi (lib/konu-erisimi.js kuralları)
      const access = await resolveStudentAccess(req.session.user);
      if (!access.isStaff) {
        if (!canStudentAccessGrade(access.userDoc, topic.grade)) {
          return res.status(403).json({
            kod: 'GRADE_ACCESS_DENIED',
            mesaj: `${topic.grade}. sınıf konu anlatımları mevcut paketinizin (${access.plan.toUpperCase()}) kapsamı dışındadır. Tüm sınıflara erişmek için paketinizi yükseltebilirsiniz.`,
            plan: access.plan,
            allowedGrades: access.allowedGrades
          });
        }
        if (access.plan === 'free') {
          // Ücretsiz planda yalnızca kayıtlı sınıfın ilk temasındaki ilk konu deneme olarak açıktır
          const gradeTopics = await TopicContent.find({ grade: topic.grade, status: 'published' })
            .sort({ order: 1, createdAt: 1 })
            .select('_id themeTitle unit_topic')
            .lean();
          const tree = getCurriculumTree();
          const gradeTreeTemalar = tree[String(topic.grade)]?.temalar ? Object.keys(tree[String(topic.grade)].temalar) : [];
          const sortedTopics = gradeTopics.sort((a, b) => {
            const ta = a.themeTitle || a.unit_topic || '';
            const tb = b.themeTitle || b.unit_topic || '';
            const ia = gradeTreeTemalar.indexOf(ta);
            const ib = gradeTreeTemalar.indexOf(tb);
            const sa = ia >= 0 ? ia : 999;
            const sb = ib >= 0 ? ib : 999;
            return sa - sb || ta.localeCompare(tb, 'tr');
          });
          const firstTrialId = sortedTopics[0] ? String(sortedTopics[0]._id) : null;
          if (firstTrialId && String(topic._id) !== firstTrialId) {
            return res.status(403).json({
              kod: 'PLAN_UPGRADE_REQUIRED',
              mesaj: 'Ücretsiz hesap ile yalnızca ilk deneme konusunu inceleyebilirsiniz. Tüm konu anlatımları, hap bilgiler ve bilgi kartları için paketinizi yükseltin.',
              plan: access.plan
            });
          }
        }
      }

      const studentId = String(req.session.user._id || req.session.user.id);
      const existing = await StudentTopicProgress.findOne({ studentId, topicId: topic._id });
      const themeTitle = topic.themeTitle || topic.unit_topic || '';
      const subTopicTitle = topic.subTopicTitle || topic.sub_topic || topic.title || '';
      const themeCode = topic.themeCode || deriveThemeCode(topic.grade, themeTitle, topic.outcome_code, 0);

      let progress;
      if (existing) {
        existing.lastAccessedAt = new Date();
        existing.themeCode = themeCode;
        existing.themeTitle = themeTitle;
        existing.subTopicTitle = subTopicTitle;
        progress = await existing.save();
      } else {
        progress = await StudentTopicProgress.create({
          studentId,
          topicId: topic._id,
          grade: topic.grade,
          themeCode,
          themeTitle,
          subTopicTitle,
          status: 'in_progress',
          lastPage: 1,
          lastAccessedAt: new Date()
        });
      }

      res.json({
        basarili: true,
        topic: {
          id: String(topic._id),
          grade: topic.grade,
          themeCode,
          themeTitle,
          subTopicTitle,
          title: topic.title || subTopicTitle,
          outcome_code: topic.outcome_code || '',
          short_summary: topic.short_summary || '',
          lessonPages: normalizeLessonPages(topic),
          practicalNotes: Array.isArray(topic.practicalNotes) ? topic.practicalNotes : [],
          flashcards: Array.isArray(topic.flashcards) ? topic.flashcards : [],
          referenceBookPages: Array.isArray(topic.referenceBookPages) ? topic.referenceBookPages : [],
          detailed_content: topic.detailed_content || ''
        },
        progress: {
          status: progress.status,
          lastPage: progress.lastPage || 1,
          lastAccessedAt: progress.lastAccessedAt,
          completedAt: progress.completedAt
        }
      });
    } catch (err) {
      console.error('[StudentTopics] Konu açma hatası:', err);
      res.status(500).json({ mesaj: 'Konu anlatımı açılamadı: ' + err.message });
    }
  });

  // 3. Sayfa ilerlemesini güncelle
  router.post('/:id/progress', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const studentId = String(req.session.user._id || req.session.user.id);
      const lastPage = Math.max(1, Math.min(10, Number(req.body?.lastPage) || 1));

      const updated = await StudentTopicProgress.findOneAndUpdate(
        { studentId, topicId: id },
        { $set: { lastPage, lastAccessedAt: new Date() } },
        { new: true }
      ).lean();

      res.json({ basarili: true, progress: updated });
    } catch (err) {
      res.status(500).json({ mesaj: 'İlerleme güncellenemedi.' });
    }
  });

  // 4. Konuyu Tamamladım ✓
  router.post('/:id/complete', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ mesaj: 'Geçersiz konu kimliği.' });
      }
      const topic = await TopicContent.findOne({ _id: id, status: 'published' }).lean();
      if (!topic) {
        return res.status(404).json({ mesaj: 'Konu bulunamadı.' });
      }
      const studentId = String(req.session.user._id || req.session.user.id);
      const themeTitle = topic.themeTitle || topic.unit_topic || '';
      const subTopicTitle = topic.subTopicTitle || topic.sub_topic || topic.title || '';
      const themeCode = topic.themeCode || deriveThemeCode(topic.grade, themeTitle, topic.outcome_code, 0);

      const now = new Date();
      const progress = await StudentTopicProgress.findOneAndUpdate(
        { studentId, topicId: topic._id },
        {
          $set: {
            grade: topic.grade,
            themeCode,
            themeTitle,
            subTopicTitle,
            status: 'completed',
            lastPage: 5,
            lastAccessedAt: now,
            completedAt: now
          }
        },
        { upsert: true, new: true }
      ).lean();

      res.json({
        basarili: true,
        mesaj: 'Tebrikler! Konuyu tamamladın.',
        progress
      });
    } catch (err) {
      console.error('[StudentTopics] Tamamlama hatası:', err);
      res.status(500).json({ mesaj: 'Konu tamamlanamadı: ' + err.message });
    }
  });

  return router;
}

module.exports = { createStudentTopicsRouter };
