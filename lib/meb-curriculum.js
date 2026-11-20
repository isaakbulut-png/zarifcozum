const fs = require('fs');
const path = require('path');

let curriculumTree = null;

function loadCurriculumTree() {
  if (curriculumTree) return curriculumTree;
  try {
    const jsonPath = path.join(__dirname, 'meb-curriculum-tree.json');
    if (fs.existsSync(jsonPath)) {
      curriculumTree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return curriculumTree;
    }
  } catch (err) {
    console.warn('[Curriculum] JSON yükleme hatası:', err.message);
  }
  return {};
}

function getCurriculumTree() {
  return loadCurriculumTree();
}

function getGrades() {
  const tree = loadCurriculumTree();
  return Object.keys(tree).map(Number).sort((a, b) => a - b);
}

function getThemes(grade) {
  const tree = loadCurriculumTree();
  const gradeData = tree[grade] || tree[String(grade)];
  if (!gradeData || !gradeData.temalar) return [];
  return Object.keys(gradeData.temalar);
}

function getSubTopics(grade, theme) {
  const tree = loadCurriculumTree();
  const gradeData = tree[grade] || tree[String(grade)];
  if (!gradeData || !gradeData.temalar) return [];
  const themeData = gradeData.temalar[theme];
  if (!themeData) return [];
  return themeData.alt_konular || [];
}

function findSubTopicMeta(grade, theme, subTopicName) {
  const subTopics = getSubTopics(grade, theme);
  const found = subTopics.find(s => s.name === subTopicName);
  if (found) return found;

  // Fallback: search across all themes for this grade
  const tree = loadCurriculumTree();
  const gradeData = tree[grade] || tree[String(grade)];
  if (gradeData && gradeData.temalar) {
    for (const [tName, tObj] of Object.entries(gradeData.temalar)) {
      const match = (tObj.alt_konular || []).find(s => s.name === subTopicName);
      if (match) return { ...match, unit_topic: tName };
    }
  }
  return null;
}

// Geriye dönük uyumluluk için düz konu listesi (SINIF_KONULARI)
function buildLegacyTopicsMap() {
  const tree = loadCurriculumTree();
  const legacyMap = {};
  for (const grade of Object.keys(tree)) {
    legacyMap[grade] = [];
    const temalar = tree[grade].temalar || {};
    for (const [tName, tObj] of Object.entries(temalar)) {
      legacyMap[grade].push(tName);
      for (const sub of (tObj.alt_konular || [])) {
        if (!legacyMap[grade].includes(sub.name)) {
          legacyMap[grade].push(sub.name);
        }
      }
    }
  }
  return legacyMap;
}

const SINIF_KONULARI_V2 = buildLegacyTopicsMap();

module.exports = {
  getCurriculumTree,
  getGrades,
  getThemes,
  getSubTopics,
  findSubTopicMeta,
  buildLegacyTopicsMap,
  SINIF_KONULARI_V2
};
