const express = require('express');
const mongoose = require('mongoose');
const Soru = require('../models/Soru');

function getSampleQuestions(filter = {}) {
  const allSamples = [
    {
      id: 'bank_q_8_1',
      _id: 'bank_q_8_1',
      grade: 8,
      ders: 'matematik',
      topic: 'Üslü İfadeler',
      difficulty: 'orta',
      outcomeCode: 'MAT.8.1.2.1',
      text: '2⁸ · 5⁶ işleminin sonucu kaç basamaklı bir sayıdır?',
      options: ['6', '7', '8', '9'],
      answer: 'C'
    },
    {
      id: 'bank_q_8_2',
      _id: 'bank_q_8_2',
      grade: 8,
      ders: 'matematik',
      topic: 'Kareköklü İfadeler',
      difficulty: 'kolay',
      outcomeCode: 'MAT.8.1.3.2',
      text: '√128 sayısı a√b şeklinde yazıldığında a + b toplamının en küçük değeri kaçtır?',
      options: ['10', '12', '14', '16'],
      answer: 'A'
    },
    {
      id: 'bank_q_8_3',
      _id: 'bank_q_8_3',
      grade: 8,
      ders: 'matematik',
      topic: 'Pisagor Bağıntısı',
      difficulty: 'zor',
      outcomeCode: 'MAT.8.3.1.5',
      text: 'Bir dik üçgende dik kenar uzunlukları 9 cm ve 12 cm olduğuna göre hipotenüse ait yüksekliğin uzunluğu kaç cm\'dir?',
      options: ['6.4', '7.2', '7.5', '8.0'],
      answer: 'B'
    },
    {
      id: 'bank_q_8_4',
      _id: 'bank_q_8_4',
      grade: 8,
      ders: 'matematik',
      topic: 'Çarpanlar ve Katlar',
      difficulty: 'kolay',
      outcomeCode: 'MAT.8.1.1.1',
      text: '48 ile 72 sayılarının EBOB ve EKOK değerlerinin toplamı kaçtır?',
      options: ['144', '168', '192', '216'],
      answer: 'B'
    },
    {
      id: 'bank_q_7_1',
      _id: 'bank_q_7_1',
      grade: 7,
      ders: 'matematik',
      topic: 'Rasyonel Sayılar',
      difficulty: 'orta',
      outcomeCode: 'MAT.7.1.2.2',
      text: '(1 - 1/2) · (1 - 1/3) · (1 - 1/4) işleminin sonucu kaçtır?',
      options: ['1/2', '1/3', '1/4', '1/6'],
      answer: 'C'
    },
    {
      id: 'bank_q_7_2',
      _id: 'bank_q_7_2',
      grade: 7,
      ders: 'matematik',
      topic: 'Birinci Dereceden Denklemler',
      difficulty: 'kolay',
      outcomeCode: 'MAT.7.2.1.3',
      text: '4x - 7 = 21 denklemini sağlayan x değeri kaçtır?',
      options: ['5', '6', '7', '8'],
      answer: 'C'
    },
    {
      id: 'bank_q_6_1',
      _id: 'bank_q_6_1',
      grade: 6,
      ders: 'matematik',
      topic: 'Tam Sayılar',
      difficulty: 'kolay',
      outcomeCode: 'MAT.6.1.4.1',
      text: '(-15) + (+23) + (-8) işleminin sonucu kaçtır?',
      options: ['-2', '0', '+2', '+4'],
      answer: 'B'
    },
    {
      id: 'bank_q_6_2',
      _id: 'bank_q_6_2',
      grade: 6,
      ders: 'matematik',
      topic: 'Kesirlerle İşlemler',
      difficulty: 'orta',
      outcomeCode: 'MAT.6.1.5.3',
      text: '3/4 + 2/5 işleminin sonucu kaçtır?',
      options: ['17/20', '21/20', '23/20', '19/20'],
      answer: 'C'
    },
    {
      id: 'bank_q_5_1',
      _id: 'bank_q_5_1',
      grade: 5,
      ders: 'matematik',
      topic: 'Doğal Sayılarla İşlemler',
      difficulty: 'kolay',
      outcomeCode: 'MAT.5.1.1.4',
      text: 'Bir okulda 18 sınıf ve her sınıfta 24 öğrenci bulunmaktadır. Okulda toplam kaç öğrenci vardır?',
      options: ['392', '412', '432', '452'],
      answer: 'C'
    },
    {
      id: 'bank_q_9_1',
      _id: 'bank_q_9_1',
      grade: 9,
      ders: 'matematik',
      topic: 'Kümeler',
      difficulty: 'orta',
      outcomeCode: 'MAT.9.2.1.1',
      text: 's(A) = 7, s(B) = 5 ve s(A ∩ B) = 3 olduğuna göre s(A ∪ B) kaçtır?',
      options: ['8', '9', '10', '11'],
      answer: 'B'
    },
    {
      id: 'bank_q_10_1',
      _id: 'bank_q_10_1',
      grade: 10,
      ders: 'matematik',
      topic: 'Fonksiyonlar',
      difficulty: 'orta',
      outcomeCode: 'MAT.10.2.1.2',
      text: 'f(x) = 3x - 4 olduğuna göre f(5) - f(2) farkı kaçtır?',
      options: ['7', '8', '9', '10'],
      answer: 'C'
    },
    {
      id: 'bank_q_11_1',
      _id: 'bank_q_11_1',
      grade: 11,
      ders: 'matematik',
      topic: 'Trigonometri',
      difficulty: 'zor',
      outcomeCode: 'MAT.11.1.2.1',
      text: 'sin(x) = 3/5 ve x dar açı olduğuna göre tan(x) + cos(x) toplamı kaçtır?',
      options: ['29/20', '31/20', '33/20', '37/20'],
      answer: 'B'
    },
    {
      id: 'bank_q_12_1',
      _id: 'bank_q_12_1',
      grade: 12,
      ders: 'matematik',
      topic: 'Logaritma',
      difficulty: 'orta',
      outcomeCode: 'MAT.12.1.1.3',
      text: 'log₂(16) + log₃(27) işleminin sonucu kaçtır?',
      options: ['5', '6', '7', '8'],
      answer: 'C'
    }
  ];

  return allSamples.filter(q => {
    if (filter.grade && q.grade !== filter.grade) return false;
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      const matchTopic = q.topic && q.topic.toLowerCase().includes(s);
      const matchText = q.text && q.text.toLowerCase().includes(s);
      const matchCode = q.outcomeCode && q.outcomeCode.toLowerCase().includes(s);
      if (!matchTopic && !matchText && !matchCode) return false;
    }
    return true;
  });
}

function createCentralQuestionBankRouter({ SoruModel } = {}) {
  const router = express.Router();
  const Model = SoruModel || Soru;

  router.get('/', async (req, res) => {
    try {
      const { grade, difficulty, search, limit = 50 } = req.query;
      const filter = {};

      if (grade && grade !== 'all') {
        const parsedGrade = Number(grade);
        if (!isNaN(parsedGrade)) filter.grade = parsedGrade;
      }
      if (difficulty && difficulty !== 'all') {
        filter.difficulty = difficulty.toLowerCase().trim();
      }
      if (search && search.trim()) {
        filter.search = search.trim();
      }

      let questions = [];

      // Eğer MongoDB bağlıysa Soru modelinden çek
      if (mongoose.connection && mongoose.connection.readyState === 1 && Model && Model.find) {
        try {
          const mongoQuery = {};
          if (filter.grade) mongoQuery.grade = filter.grade;
          if (filter.difficulty) mongoQuery.difficulty = filter.difficulty;
          if (filter.search) {
            const reg = new RegExp(filter.search, 'i');
            mongoQuery.$or = [{ topic: reg }, { text: reg }, { outcomeCode: reg }];
          }
          const docs = await Model.find(mongoQuery).sort({ createdAt: -1 }).limit(Number(limit)).lean().exec();
          if (Array.isArray(docs) && docs.length > 0) {
            questions = docs.map(q => ({
              id: (q._id || q.id).toString(),
              _id: (q._id || q.id).toString(),
              text: q.text,
              grade: q.grade,
              topic: q.topic,
              difficulty: q.difficulty,
              options: q.options,
              answer: q.answer,
              svg: q.svg,
              imageUrl: q.imageUrl,
              outcomeCode: q.outcomeCode,
              ders: q.ders
            }));
          }
        } catch (dbErr) {
          console.warn('Veritabanından sorular alınırken hata:', dbErr.message);
        }
      }

      // Veritabanı boşsa veya filtreye uygun DB sorusu yoksa zengin örnek soruları sun
      if (questions.length === 0) {
        questions = getSampleQuestions(filter);
      }

      res.json({
        success: true,
        count: questions.length,
        questions
      });
    } catch (err) {
      console.error('Merkezi soru havuzu hatası:', err);
      res.status(500).json({ success: false, mesaj: 'Soru havuzu yüklenemedi.' });
    }
  });

  return router;
}

module.exports = {
  createCentralQuestionBankRouter,
  getSampleQuestions
};
