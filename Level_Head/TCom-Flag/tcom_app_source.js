var $D = `1vmpKeQj8JUBC4oPE2Kog-JzPsr7e0oNfC4Vj8QF5pgY`;

// 1. ฟังก์ชันตัดคำนำหน้าชื่อ (นาย, นาง, นางสาว, น.ส., ว่าที่ร้อยตรี, ส.ต.ต., ดร., Mr., Miss ฯลฯ) เหลือเฉพาะ "ชื่อ นามสกุล"
var cleanTeacherName = raw => {
  if (!raw) return ``;
  let s = String(raw).replace(/[\u00A0\s]+/g, ` `).trim();
  let prefixRegex = /^(?:(?:ว่าที่\s*ร้อยตรี\s*หญิง|ว่าที่\s*ร้อยตรี|ว่าที่\s*ร\.?\s*ต\.?\s*หญิง|ว่าที่\s*ร\.?\s*ต\.?|ส\.?\s*ต\.?\s*[ทอต]\.?|จ\.?\s*ส\.?\s*[ตทอ]\.?|ร\.?\s*ต\.?\s*[อทต]\.?|ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|ผศ\.?\s*ดร\.?|รศ\.?\s*ดร\.?|ผศ\.?|รศ\.?|ดร\.?|นางสาว|น\.?\s*ส\.?|นาง|นาย|คุณครู|ครู|อาจารย์|ผอ\.?|Miss\.?|Mrs\.?|Mr\.?|Ms\.?|Dr\.?|Teacher)\s*)+/i;
  s = s.replace(prefixRegex, ``).replace(/[\u00A0\s]+/g, ` `).trim();
  return s || String(raw).trim();
};

// 2. ฟังก์ชันคำนวณระยะห่างตัวอักษร (Levenshtein Edit Distance) สำหรับตรวจจับชื่อสะกดเพี้ยน เช่น สุมาลี <-> สุมาสี
var calcEditDistance = (a, b) => {
  let s = a || ``, t = b || ``;
  let m = s.length, n = t.length;
  if (!m) return n;
  if (!n) return m;
  let dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      let cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

// 3. ฟังก์ชันค้นหาครูที่เป็นคนเดียวกัน (รองรับทั้งคำนำหน้าติดมา เว้นวรรคเพี้ยน หรือสะกดเพี้ยน 1-2 ตัวอักษร เช่น สุมาลี เป็น สุมาสี)
var findFuzzyTeacherMatch = (inputName, rosterTeachers, aliasMap = {}) => {
  if (!inputName) return null;
  let rawTrim = String(inputName).trim();
  let cleanedInput = cleanTeacherName(rawTrim);

  // 3.1 ตรวจสอบจากตารางจับคู่ชื่อเพี้ยนที่เคยบันทึกไว้ (Alias Map)
  let aliasedTarget = aliasMap[rawTrim] || aliasMap[cleanedInput];
  if (aliasedTarget) {
    let foundAlias = rosterTeachers.find(t => t.id === aliasedTarget || t.name === aliasedTarget);
    if (foundAlias) {
      return {
        teacher: foundAlias,
        cleanedInput,
        matchType: rawTrim === foundAlias.id ? `EXACT` : `ALIAS_MAPPED`,
        similarity: 100,
        distance: 0,
        reason: `ผูกเป็นคนเดียวกันไว้แล้ว`
      };
    }
  }

  // 3.2 ตรงกับชื่อ-นามสกุลที่คลีนแล้วแบบเป๊ะๆ
  for (let t of rosterTeachers) {
    if (cleanedInput === t.id) {
      return {
        teacher: t,
        cleanedInput,
        matchType: rawTrim === t.id ? `EXACT` : `PREFIX_CLEANED`,
        similarity: 100,
        distance: 0,
        reason: rawTrim === t.id ? `ตรงกัน 100%` : `ตัดคำนำหน้าออกเป็นคนเดียวกัน`
      };
    }
  }

  // 3.3 ตรงกันเมื่อตัดช่องว่างทั้งหมดออก
  let compactInput = cleanedInput.replace(/\s+/g, ``);
  for (let t of rosterTeachers) {
    if (compactInput && compactInput === t.id.replace(/\s+/g, ``)) {
      return {
        teacher: t,
        cleanedInput,
        matchType: `SPACE_CLEANED`,
        similarity: 100,
        distance: 0,
        reason: `ปรับช่องว่างให้ตรงกัน`
      };
    }
  }

  // 3.4 ตรวจสอบกรณีสะกดเพี้ยนเล็กน้อย (Fuzzy Typo Match เช่น สุมาลี <-> สุมาสี)
  let partsInput = cleanedInput.split(` `);
  let firstInput = partsInput[0] || ``;
  let lastInput = partsInput.slice(1).join(` `) || ``;

  let bestMatch = null;
  let bestScore = 0;

  for (let t of rosterTeachers) {
    let target = t.id;
    let compactTarget = target.replace(/\s+/g, ``);
    let dist = calcEditDistance(compactInput, compactTarget);
    let maxLen = Math.max(compactInput.length, compactTarget.length, 1);
    let sim = Math.round(((maxLen - dist) / maxLen) * 100);

    let partsTarget = target.split(` `);
    let firstTarget = partsTarget[0] || ``;
    let lastTarget = partsTarget.slice(1).join(` `) || ``;
    let firstDist = calcEditDistance(firstInput, firstTarget);
    let lastDist = lastInput && lastTarget ? calcEditDistance(lastInput, lastTarget) : 99;

    let isCandidate = false;
    let effectiveSim = sim;
    let reason = ``;

    if (lastDist === 0 && lastTarget.length >= 3 && firstDist <= 2) {
      isCandidate = true;
      effectiveSim = Math.max(sim, 92);
      reason = `นามสกุลตรงกัน ชื่อต่างกัน ${firstDist} จุด (${firstInput} ≈ ${firstTarget})`;
    } else if (firstDist === 0 && firstTarget.length >= 3 && lastDist <= 2) {
      isCandidate = true;
      effectiveSim = Math.max(sim, 92);
      reason = `ชื่อตรงกัน นามสกุลต่างกัน ${lastDist} จุด`;
    } else if (dist <= 2 && sim >= 78 && compactInput.length >= 5) {
      isCandidate = true;
      reason = `ชื่อ-นามสกุลคล้ายกัน ${sim}% (ต่างกัน ${dist} จุด)`;
    } else if (!lastInput && firstInput.length >= 4 && firstDist <= 1) {
      isCandidate = true;
      effectiveSim = Math.round(((Math.max(firstInput.length, firstTarget.length) - firstDist) / Math.max(firstInput.length, firstTarget.length)) * 100);
      reason = `ชื่อต้นคล้ายกัน (${firstInput} ≈ ${firstTarget})`;
    }

    if (isCandidate && effectiveSim > bestScore) {
      bestScore = effectiveSim;
      bestMatch = {
        teacher: t,
        cleanedInput,
        matchType: `FUZZY_TYPO`,
        similarity: effectiveSim,
        distance: dist,
        reason
      };
    }
  }

  return bestMatch;
};

// 4. โหลด/บันทึก Alias Map (ตารางจำชื่อที่เคยคลีนว่าเป็นคนเดียวกัน)
var loadAliases = async grade => {
  let localKey = `teacher_aliases_${grade}`;
  let localData = {};
  try {
    let raw = localStorage.getItem(localKey);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {}
  try {
    let snap = await RD(rv(KD, `attendance_records`, `aliases_${grade}`));
    if (snap.exists() && snap.data().aliases) {
      let merged = { ...localData, ...snap.data().aliases };
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {}
  return localData;
};

var saveAliases = async (grade, newAliases) => {
  let localKey = `teacher_aliases_${grade}`;
  let current = {};
  try {
    let raw = localStorage.getItem(localKey);
    if (raw) current = JSON.parse(raw);
  } catch (e) {}
  let merged = { ...current, ...newAliases };
  localStorage.setItem(localKey, JSON.stringify(merged));
  try {
    await zD(rv(KD, `attendance_records`, `aliases_${grade}`), {
      grade,
      updatedAt: Tv(),
      aliases: merged
    }, { merge: !0 });
  } catch (e) {
    console.warn(`Could not sync aliases to Firestore:`, e);
  }
  return merged;
};

// 5. แปลงข้อมูลเช็คชื่อจาก Firebase ให้ตรงกับ "ชื่อ นามสกุล" ปัจจุบัน พร้อมตรวจจับรายการที่ควรคลีน
var resolveAttendanceRecords = (rosterTeachers, rawRecords = {}, aliasMap = {}, dateKey = ``) => {
  let resolved = {};
  let issues = [];
  let exactTeacherIds = new Set(rosterTeachers.map(t => t.id));

  // รอบที่ 1: ดึงรายการที่ตรงกับชื่อคลีนปัจจุบันเป๊ะๆ ก่อน
  Object.keys(rawRecords).forEach(k => {
    let val = rawRecords[k];
    if (!val) return;
    if (exactTeacherIds.has(k)) {
      resolved[k] = val;
    }
  });

  // รอบที่ 2: ตรวจสอบ Key อื่นๆ (ชื่อมีคำนำหน้า, ชื่อสะกดเพี้ยน, หรือรหัสแถวเก่า t0, t1...)
  Object.keys(rawRecords).forEach(k => {
    let val = rawRecords[k];
    if (!val || exactTeacherIds.has(k)) return;

    // เช็คว่าเป็นรหัสลำดับแถวแบบเก่า (t0, t1, ...) หรือไม่
    if (/^t\d+$/.test(k)) {
      let legacyTeacher = rosterTeachers.find(t => t.legacyId === k);
      if (legacyTeacher) {
        if (!resolved[legacyTeacher.id]) {
          resolved[legacyTeacher.id] = val;
        }
        issues.push({
          dateKey,
          rawKey: k,
          cleanedKey: legacyTeacher.id,
          targetTeacherId: legacyTeacher.id,
          statusValue: val,
          matchType: `LEGACY_ID`,
          similarity: 100,
          reason: `รหัสลำดับแถวแบบเก่า (${k}) ➔ แปลงเป็นชื่อ-นามสกุลจริง`
        });
      }
      return;
    }

    // เช็คด้วย Fuzzy & Prefix Matcher
    let match = findFuzzyTeacherMatch(k, rosterTeachers, aliasMap);
    if (match && match.teacher) {
      if (!resolved[match.teacher.id]) {
        resolved[match.teacher.id] = val;
      }
      issues.push({
        dateKey,
        rawKey: k,
        cleanedKey: match.cleanedInput,
        targetTeacherId: match.teacher.id,
        statusValue: val,
        matchType: match.matchType,
        similarity: match.similarity,
        reason: match.reason
      });
    } else {
      issues.push({
        dateKey,
        rawKey: k,
        cleanedKey: cleanTeacherName(k),
        targetTeacherId: ``,
        statusValue: val,
        matchType: `UNMATCHED`,
        similarity: 0,
        reason: `ไม่พบชื่อที่ตรงกันใน Sheet ปัจจุบัน (อาจย้ายออก หรือสะกดต่างกันมาก)`
      });
    }
  });

  return { resolved, issues };
};

// 6. โหลด/บันทึกการเพิ่มครูใหม่หรือเอาครูเก่าออกผ่านหน้าเว็บ (เก็บใน Firebase คู่กับ Google Sheet)
var loadRosterChanges = async grade => {
  let localKey = `roster_changes_${grade}`;
  let localData = { added: [], removed: [] };
  try {
    let raw = localStorage.getItem(localKey);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {}
  try {
    let snap = await RD(rv(KD, `attendance_records`, `roster_changes_${grade}`));
    if (snap.exists()) {
      let data = snap.data();
      let merged = {
        added: Array.isArray(data.added) ? data.added : (localData.added || []),
        removed: Array.isArray(data.removed) ? data.removed : (localData.removed || [])
      };
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {}
  return localData;
};

var saveRosterChanges = async (grade, changes) => {
  let localKey = `roster_changes_${grade}`;
  localStorage.setItem(localKey, JSON.stringify(changes));
  try {
    await zD(rv(KD, `attendance_records`, `roster_changes_${grade}`), {
      grade,
      updatedAt: Tv(),
      added: changes.added || [],
      removed: changes.removed || []
    }, { merge: !0 });
  } catch (e) {
    console.warn(`Could not sync roster changes to Firestore:`, e);
  }
  return changes;
};

var applyRosterChanges = (sheetList, changes) => {
  let removedSet = new Set((changes.removed || []).map(x => cleanTeacherName(x)));
  let filtered = sheetList.filter(t => !removedSet.has(t.id));
  let existingIds = new Set(filtered.map(t => t.id));
  (changes.added || []).forEach((item, idx) => {
    let cleaned = cleanTeacherName(item.name || item.id);
    if (cleaned && !removedSet.has(cleaned) && !existingIds.has(cleaned)) {
      existingIds.add(cleaned);
      filtered.push({
        id: cleaned,
        name: cleaned,
        rawName: item.rawName || cleaned,
        legacyId: `added_${idx}`,
        dutyDay: item.dutyDay || ``,
        room: item.room || ``,
        isCustomAdded: !0
      });
    }
  });
  return filtered;
};

// ดึงรายชื่อครูจาก Google Sheet พร้อมคลีนคำนำหน้าออกอัตโนมัติ (ใช้ "ชื่อ นามสกุล" เป็น ID หลัก) และรวมรายการที่เพิ่ม/ลบผ่านเว็บ
var eO = async (e, forceRefresh = !1) => {
  let changes = await loadRosterChanges(e);
  let baseList = await new Promise((t, n) => {
    let r = `https://docs.google.com/spreadsheets/d/${$D}/gviz/tq?tqx=out:csv&sheet=${e}`,
        i = `teachers_cache_v2_${e}`;
    QD.default.parse(r, {
      download: !0,
      header: !1,
      complete: e => {
        let usedIds = new Set();
        let n = e.data.filter(e => e[0] && String(e[0]).trim()).map((e, idx) => {
          let rawName = String(e[0]).trim();
          let cleaned = cleanTeacherName(rawName);
          let uniqueId = cleaned;
          if (usedIds.has(uniqueId)) {
            uniqueId = `${cleaned} (${idx + 1})`;
          }
          usedIds.add(uniqueId);
          return {
            id: uniqueId,
            name: uniqueId,
            rawName,
            legacyId: `t${idx}`,
            dutyDay: e[1] ? String(e[1]).trim() : ``,
            room: e[2] ? String(e[2]).trim() : ``
          };
        });
        localStorage.setItem(i, JSON.stringify(n));
        t(n);
      },
      error: e => {
        console.warn(`Offline or error fetching sheet, trying cache...`, e);
        let r = localStorage.getItem(i);
        r ? t(JSON.parse(r)) : n(e);
      }
    });
  });
  return applyRosterChanges(baseList, changes);
};

var tO = e => {
  if (e === [`อาทิตย์`, `จันทร์`, `อังคาร`, `พุธ`, `พฤหัสบดี`, `ศุกร์`, `เสาร์`][new Date().getDay()]) return `เวร`;
  let t = new Date, n = t.getHours(), r = t.getMinutes(), i = n * 60 + r;
  return i < 480 ? `มาทันเวลา` : i <= 500 ? `มาแต่ไม่ทันเวลา` : `ไม่มา`;
};

// 7. คอมโพเนนต์ Modal "ตรวจสอบและคลีนชื่อครู" (รองรับตรวจชื่อเพี้ยน เช่น สุมาลี <-> สุมาสี และตัดคำนำหน้า)
function NameCleanerModal({ isOpen, onClose, grade, rosterTeachers, detectedIssues, aliasMap, onCleanAndMerge, onRefreshSheet }) {
  let [testInput, setTestInput] = (0, _.useState)(``);
  let [manualTargets, setManualTargets] = (0, _.useState)({});
  let [isCleaning, setIsCleaning] = (0, _.useState)(!1);
  let [selectedManualTarget, setSelectedManualTarget] = (0, _.useState)(``);
  let [newTeacherName, setNewTeacherName] = (0, _.useState)(``);
  let [newTeacherDuty, setNewTeacherDuty] = (0, _.useState)(`จันทร์`);
  let [newTeacherRoom, setNewTeacherRoom] = (0, _.useState)(``);

  if (!isOpen) return null;

  let testMatch = testInput.trim() ? findFuzzyTeacherMatch(testInput, rosterTeachers, aliasMap) : null;
  let cleanedTest = cleanTeacherName(testInput);

  let handleAddNewTeacher = async () => {
    let cleaned = cleanTeacherName(newTeacherName);
    if (!cleaned) {
      alert(`กรุณากรอกชื่อ-นามสกุลครูใหม่ก่อนครับ`);
      return;
    }
    setIsCleaning(!0);
    let changes = await loadRosterChanges(grade);
    let removedList = (changes.removed || []).filter(x => cleanTeacherName(x) !== cleaned);
    let addedList = [...(changes.added || [])];
    if (!addedList.some(x => cleanTeacherName(x.name || x.id) === cleaned)) {
      addedList.push({
        id: cleaned,
        name: cleaned,
        rawName: newTeacherName.trim(),
        dutyDay: newTeacherDuty,
        room: newTeacherRoom.trim() || `ชั้นมัธยมศึกษาปีที่ ${grade.replace(`m`, ``)}`
      });
    }
    await saveRosterChanges(grade, { added: addedList, removed: removedList });
    setNewTeacherName(``);
    setNewTeacherRoom(``);
    await onRefreshSheet();
    setIsCleaning(!1);
    alert(`✅ เพิ่มคุณครู "${cleaned}" เข้าสายชั้น ${grade.toUpperCase()} เรียบร้อยแล้ว!`);
  };

  let handleRemoveTeacher = async teacherObj => {
    if (!confirm(`ยืนยันการเอาชื่อ "${teacherObj.id}" ออกจากหน้าเช็คชื่อสายชั้น ${grade.toUpperCase()} ใช่หรือไม่?\n(ประวัติการเช็คชื่อเก่าในฐานข้อมูลจะยังคงอยู่ครบถ้วน)`)) return;
    setIsCleaning(!0);
    let changes = await loadRosterChanges(grade);
    let removedSet = new Set(changes.removed || []);
    removedSet.add(teacherObj.id);
    let addedList = (changes.added || []).filter(x => cleanTeacherName(x.name || x.id) !== teacherObj.id);
    await saveRosterChanges(grade, { added: addedList, removed: Array.from(removedSet) });
    await onRefreshSheet();
    setIsCleaning(!1);
  };

  let handleQuickBind = async () => {
    let targetId = selectedManualTarget || (testMatch && testMatch.teacher ? testMatch.teacher.id : ``);
    if (!testInput.trim() || !targetId) return;
    setIsCleaning(!0);
    await onCleanAndMerge([{
      rawKey: testInput.trim(),
      cleanedKey: cleanedTest,
      targetTeacherId: targetId,
      dateKey: ``
    }], !0);
    setTestInput(``);
    setSelectedManualTarget(``);
    setIsCleaning(!1);
  };

  let handleCleanAll = async () => {
    let actionable = detectedIssues.map((iss, idx) => ({
      ...iss,
      targetTeacherId: manualTargets[idx] !== void 0 ? manualTargets[idx] : iss.targetTeacherId
    })).filter(iss => iss.targetTeacherId);

    if (actionable.length === 0) {
      alert(`กรุณาเลือกชื่อครูที่ต้องการรวมข้อมูลก่อนครับ`);
      return;
    }
    setIsCleaning(!0);
    await onCleanAndMerge(actionable, !1);
    setIsCleaning(!1);
  };

  return (0, $.jsx)(`div`, {
    className: `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto`,
    children: (0, $.jsxs)(`div`, {
      className: `bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border-t-8 border-purple-600 max-h-[90vh] overflow-y-auto space-y-6`,
      children: [
        (0, $.jsxs)(`div`, {
          className: `flex justify-between items-start border-b border-gray-100 pb-4`,
          children: [
            (0, $.jsxs)(`div`, {
              children: [
                (0, $.jsx)(`h2`, {
                  className: `text-2xl font-bold text-gray-800`,
                  children: `🔍 ตรวจสอบและคลีนชื่อครู (สายชั้น ${grade.toUpperCase()})`
                }),
                (0, $.jsx)(`p`, {
                  className: `text-sm text-gray-500 mt-1 font-medium`,
                  children: `ระบบตัดคำนำหน้า (นาย/นาง/นางสาว/น.ส.) อัตโนมัติ และช่วยรวมชื่อที่สะกดเพี้ยนให้เป็นคนเดียวกัน`
                })
              ]
            }),
            (0, $.jsx)(`button`, {
              onClick: onClose,
              className: `text-gray-400 hover:text-gray-700 text-2xl font-bold px-3 py-1 rounded-xl bg-gray-50 hover:bg-gray-100`,
              children: `✕`
            })
          ]
        }),

        // กล่องที่ 1: ทดสอบและผูกชื่อที่สะกดเพี้ยน (เช่น สุมาสี -> สุมาลี)
        (0, $.jsxs)(`div`, {
          className: `bg-purple-50/70 border border-purple-100 rounded-2xl p-4 space-y-3`,
          children: [
            (0, $.jsx)(`h3`, {
              className: `font-bold text-purple-800 text-base`,
              children: `🧪 ทดสอบตรวจชื่อเพี้ยน / จับคู่ชื่อที่เป็นคนเดียวกัน (เช่น สุมาสี ➔ สุมาลี)`
            }),
            (0, $.jsxs)(`div`, {
              className: `flex flex-col sm:flex-row gap-2`,
              children: [
                (0, $.jsx)(`input`, {
                  type: `text`,
                  value: testInput,
                  onChange: e => setTestInput(e.target.value),
                  placeholder: `พิมพ์ชื่อที่ต้องการตรวจ เช่น นางสาวสุมาสี อุดารักษ์...`,
                  className: `flex-1 px-4 py-3 rounded-xl border border-purple-200 bg-white font-bold text-gray-700 focus:ring-2 focus:ring-purple-400 outline-none`
                }),
                (0, $.jsx)(`button`, {
                  onClick: onRefreshSheet,
                  className: `px-4 py-3 bg-white hover:bg-purple-100 text-purple-700 font-bold text-sm rounded-xl border border-purple-200 transition whitespace-nowrap`,
                  children: `🔄 ดึง Sheet ล่าสุด`
                })
              ]
            }),
            testInput.trim() && (0, $.jsxs)(`div`, {
              className: `bg-white rounded-xl p-4 border border-purple-200 space-y-3 text-sm`,
              children: [
                (0, $.jsxs)(`div`, {
                  className: `flex flex-wrap items-center gap-2`,
                  children: [
                    (0, $.jsx)(`span`, { className: `text-gray-500 font-medium`, children: `ชื่อหลังตัดคำนำหน้า:` }),
                    (0, $.jsx)(`span`, { className: `px-3 py-1 bg-gray-100 text-gray-800 font-bold rounded-lg`, children: cleanedTest })
                  ]
                }),
                testMatch ? (0, $.jsxs)(`div`, {
                  className: `flex flex-wrap items-center justify-between gap-2 bg-green-50 p-3 rounded-xl border border-green-200`,
                  children: [
                    (0, $.jsxs)(`div`, {
                      children: [
                        (0, $.jsxs)(`div`, {
                          className: `font-bold text-green-800 text-base`,
                          children: [`✅ ตรงกับครู: "`, testMatch.teacher.id, `" (ความคล้าย `, testMatch.similarity, `%)`]
                        }),
                        (0, $.jsx)(`div`, {
                          className: `text-xs text-green-600 mt-0.5`,
                          children: testMatch.reason
                        })
                      ]
                    }),
                    (0, $.jsx)(`button`, {
                      onClick: handleQuickBind,
                      disabled: isCleaning,
                      className: `px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-sm transition`,
                      children: `✨ จำว่าเป็นคนเดียวกัน`
                    })
                  ]
                }) : (0, $.jsxs)(`div`, {
                  className: `flex flex-wrap items-center justify-between gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200`,
                  children: [
                    (0, $.jsx)(`span`, {
                      className: `text-amber-800 font-bold`,
                      children: `⚠️ สะกดต่างกันมาก เลือกผูกกับครูในสายชั้น:`
                    }),
                    (0, $.jsxs)(`div`, {
                      className: `flex gap-2 flex-1 sm:flex-initial`,
                      children: [
                        (0, $.jsxs)(`select`, {
                          value: selectedManualTarget,
                          onChange: e => setSelectedManualTarget(e.target.value),
                          className: `px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold text-gray-700`,
                          children: [
                            (0, $.jsx)(`option`, { value: ``, children: `-- เลือกครูที่เป็นคนเดียวกัน --` }),
                            rosterTeachers.map(t => (0, $.jsx)(`option`, { value: t.id, children: t.id }, t.id))
                          ]
                        }),
                        (0, $.jsx)(`button`, {
                          onClick: handleQuickBind,
                          disabled: !selectedManualTarget || isCleaning,
                          className: `px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl`,
                          children: `ผูกชื่อ`
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),

        // กล่องที่ 2: รายการชื่อใน Firebase ที่ตรวจพบว่ามีคำนำหน้า/สะกดเพี้ยน/รหัสเก่า
        (0, $.jsxs)(`div`, {
          className: `space-y-3`,
          children: [
            (0, $.jsxs)(`div`, {
              className: `flex justify-between items-center`,
              children: [
                (0, $.jsxs)(`h3`, {
                  className: `font-bold text-gray-800 text-base`,
                  children: [`🛠️ รายการชื่อในฐานข้อมูลที่รอคลีน (`, detectedIssues.length, ` รายการ)`]
                }),
                detectedIssues.length > 0 && (0, $.jsx)(`button`, {
                  onClick: handleCleanAll,
                  disabled: isCleaning,
                  className: `px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md transition`,
                  children: isCleaning ? `กำลังคลีนข้อมูล...` : `✨ คลีนและรวมเป็นคนเดียวกันทั้งหมด`
                })
              ]
            }),
            detectedIssues.length === 0 ? (0, $.jsx)(`div`, {
              className: `p-5 bg-green-50 border border-green-100 rounded-2xl text-center text-green-700 font-bold`,
              children: `✅ ข้อมูลชื่อครูในฐานข้อมูลที่โหลดมา คลีนเป็น "ชื่อ นามสกุล" ตรงกันครบถ้วนแล้ว!`
            }) : (0, $.jsx)(`div`, {
              className: `space-y-2 max-h-60 overflow-y-auto pr-1`,
              children: detectedIssues.map((iss, idx) => (0, $.jsxs)(`div`, {
                className: `p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm`,
                children: [
                  (0, $.jsxs)(`div`, {
                    children: [
                      (0, $.jsxs)(`div`, {
                        className: `font-bold text-gray-800`,
                        children: [
                          iss.dateKey ? `[${iss.dateKey}] ` : ``,
                          `"`, iss.rawKey, `" `,
                          (0, $.jsx)(`span`, { className: `text-purple-600 mx-1`, children: `➔` }),
                          (0, $.jsx)(`span`, { className: `text-green-700`, children: `"${(manualTargets[idx] !== void 0 ? manualTargets[idx] : iss.targetTeacherId) || `ยังไม่ระบุ`}"` })
                        ]
                      }),
                      (0, $.jsx)(`div`, {
                        className: `text-xs text-gray-500 mt-0.5`,
                        children: `${iss.reason} (สถานะ: ${iss.statusValue})`
                      })
                    ]
                  }),
                  (0, $.jsxs)(`select`, {
                    value: manualTargets[idx] !== void 0 ? manualTargets[idx] : iss.targetTeacherId,
                    onChange: e => setManualTargets(prev => ({ ...prev, [idx]: e.target.value })),
                    className: `px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-bold text-xs text-gray-700`,
                    children: [
                      (0, $.jsx)(`option`, { value: ``, children: `-- ข้าม / ไม่รวม --` }),
                      rosterTeachers.map(t => (0, $.jsx)(`option`, { value: t.id, children: `รวมเป็น: ${t.id}` }, t.id))
                    ]
                  })
                ]
              }, `${iss.dateKey}_${iss.rawKey}_${idx}`))
            })
          ]
        }),

        // กล่องที่ 3: เพิ่มครูใหม่ / เอาครูย้ายออก + ตารางตรวจสอบรายชื่อครูในสายชั้นปัจจุบัน
        (0, $.jsxs)(`div`, {
          className: `space-y-3 border-t border-gray-100 pt-4`,
          children: [
            (0, $.jsxs)(`div`, {
              className: `flex flex-wrap justify-between items-center gap-2`,
              children: [
                (0, $.jsxs)(`h3`, {
                  className: `font-bold text-gray-800 text-base`,
                  children: [`👩‍🏫 จัดการรายชื่อครูในสายชั้น (`, rosterTeachers.length, ` คน)`]
                }),
                (0, $.jsx)(`a`, {
                  href: `https://docs.google.com/spreadsheets/d/${$D}/edit`,
                  target: `_blank`,
                  rel: `noopener noreferrer`,
                  className: `px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition`,
                  children: `📗 เปิดแก้ไขใน Google Sheet`
                })
              ]
            }),

            // ฟอร์มเพิ่มครูใหม่ด่วน
            (0, $.jsxs)(`div`, {
              className: `bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5`,
              children: [
                (0, $.jsx)(`div`, { className: `text-xs font-bold text-gray-600`, children: `➕ เพิ่มครูย้ายเข้าใหม่ (ระบบตัดคำนำหน้าให้อัตโนมัติ)` }),
                (0, $.jsxs)(`div`, {
                  className: `grid grid-cols-1 sm:grid-cols-3 gap-2`,
                  children: [
                    (0, $.jsx)(`input`, {
                      type: `text`,
                      value: newTeacherName,
                      onChange: e => setNewTeacherName(e.target.value),
                      placeholder: `ชื่อ นามสกุล...`,
                      className: `px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-800`
                    }),
                    (0, $.jsxs)(`select`, {
                      value: newTeacherDuty,
                      onChange: e => setNewTeacherDuty(e.target.value),
                      className: `px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-700`,
                      children: [
                        (0, $.jsx)(`option`, { value: `จันทร์`, children: `เวรวันจันทร์` }),
                        (0, $.jsx)(`option`, { value: `อังคาร`, children: `เวรวันอังคาร` }),
                        (0, $.jsx)(`option`, { value: `พุธ`, children: `เวรวันพุธ` }),
                        (0, $.jsx)(`option`, { value: `พฤหัสบดี`, children: `เวรวันพฤหัสบดี` }),
                        (0, $.jsx)(`option`, { value: `ศุกร์`, children: `เวรวันศุกร์` }),
                        (0, $.jsx)(`option`, { value: `เฉพาะ`, children: `เฉพาะกิจ` })
                      ]
                    }),
                    (0, $.jsxs)(`div`, {
                      className: `flex gap-2`,
                      children: [
                        (0, $.jsx)(`input`, {
                          type: `text`,
                          value: newTeacherRoom,
                          onChange: e => setNewTeacherRoom(e.target.value),
                          placeholder: `ห้อง เช่น ม.1/1`,
                          className: `flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-sm text-gray-800`
                        }),
                        (0, $.jsx)(`button`, {
                          onClick: handleAddNewTeacher,
                          disabled: isCleaning,
                          className: `px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl whitespace-nowrap shadow-sm`,
                          children: `+ เพิ่ม`
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            (0, $.jsx)(`div`, {
              className: `max-h-56 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 text-sm`,
              children: rosterTeachers.map((t, i) => (0, $.jsxs)(`div`, {
                className: `p-3 flex items-center justify-between hover:bg-gray-50`,
                children: [
                  (0, $.jsxs)(`div`, {
                    className: `flex items-center gap-3`,
                    children: [
                      (0, $.jsx)(`span`, { className: `w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center`, children: i + 1 }),
                      (0, $.jsxs)(`div`, {
                        children: [
                          (0, $.jsxs)(`div`, {
                            className: `font-bold text-gray-800 text-base flex items-center gap-2`,
                            children: [
                              t.id,
                              t.dutyDay && (0, $.jsx)(`span`, { className: `text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md`, children: `เวร: ${t.dutyDay}` })
                            ]
                          }),
                          t.rawName !== t.id && (0, $.jsxs)(`div`, { className: `text-xs text-gray-400`, children: [`ชื่อใน Sheet: `, t.rawName] })
                        ]
                      })
                    ]
                  }),
                  (0, $.jsxs)(`div`, {
                    className: `flex items-center gap-2`,
                    children: [
                      (0, $.jsx)(`span`, { className: `text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg`, children: t.room || `-` }),
                      (0, $.jsx)(`button`, {
                        onClick: () => handleRemoveTeacher(t),
                        className: `text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-2.5 py-1 rounded-lg transition`,
                        title: `เอาออกจากหน้าเช็คชื่อ (ย้ายออก)`,
                        children: `เอาออก`
                      })
                    ]
                  })
                ]
              }, t.id))
            })
          ]
        })
      ]
    })
  });
}

// 8. หน้าเช็คชื่อรายวัน (/dashboard)
function nO() {
  let e = Dt(),
      [t, n] = (0, _.useState)([]),
      [r, i] = (0, _.useState)(!0),
      [a, o] = (0, _.useState)({}),
      [s, c] = (0, _.useState)([]),
      [l, u] = (0, _.useState)(``),
      [aliases, setAliases] = (0, _.useState)({}),
      [detectedIssues, setDetectedIssues] = (0, _.useState)([]),
      [rawDayRecords, setRawDayRecords] = (0, _.useState)({}),
      [isModalOpen, setIsModalOpen] = (0, _.useState)(!1);

  (0, _.useEffect)(() => {
    let t = GD.currentUser;
    t && t.email ? u(t.email.split(`@`)[0]) : e(`/`);
  }, [e]);

  let loadDashboardData = async (grade, forceSheet = !1) => {
    if (!grade) return;
    i(!0);
    try {
      let [roster, loadedAliases] = await Promise.all([
        eO(grade, forceSheet),
        loadAliases(grade)
      ]);
      n(roster);
      setAliases(loadedAliases);

      let statusMap = {};
      roster.forEach(item => {
        statusMap[item.id] = tO(item.dutyDay);
      });

      let now = new Date();
      let dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, `0`)}-${String(now.getDate()).padStart(2, `0`)}`;
      let snap = await RD(rv(KD, `attendance_records`, `${dateStr}_${grade}`));
      if (snap.exists()) {
        let rawRecs = snap.data().records || {};
        setRawDayRecords(rawRecs);
        let { resolved, issues } = resolveAttendanceRecords(roster, rawRecs, loadedAliases, dateStr);
        setDetectedIssues(issues);
        let checkedIds = [];
        Object.keys(resolved).forEach(teacherId => {
          if (resolved[teacherId]) {
            checkedIds.push(teacherId);
            statusMap[teacherId] = resolved[teacherId];
          }
        });
        c(checkedIds);
      } else {
        setRawDayRecords({});
        setDetectedIssues([]);
        c([]);
      }
      o(statusMap);
      i(!1);
    } catch (err) {
      console.error(`Error loading data: `, err);
      i(!1);
    }
  };

  (0, _.useEffect)(() => {
    if (l) loadDashboardData(l, !1);
  }, [l]);

  let handleCleanAndMerge = async (itemsToClean, isQuickBindOnly = !1) => {
    try {
      let newAliasEntries = {};
      itemsToClean.forEach(item => {
        if (item.rawKey && item.targetTeacherId && !/^t\d+$/.test(item.rawKey)) {
          newAliasEntries[item.rawKey] = item.targetTeacherId;
          if (item.cleanedKey) newAliasEntries[item.cleanedKey] = item.targetTeacherId;
        }
      });
      if (Object.keys(newAliasEntries).length > 0) {
        await saveAliases(l, newAliasEntries);
      }

      if (!isQuickBindOnly) {
        let now = new Date();
        let dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, `0`)}-${String(now.getDate()).padStart(2, `0`)}`;
        let docRef = rv(KD, `attendance_records`, `${dateStr}_${l}`);
        let snap = await RD(docRef);
        if (snap.exists()) {
          let data = snap.data();
          let updatedRecords = { ...(data.records || {}) };
          itemsToClean.forEach(item => {
            if (item.rawKey && item.targetTeacherId && updatedRecords[item.rawKey]) {
              let val = updatedRecords[item.rawKey];
              if (!updatedRecords[item.targetTeacherId]) {
                updatedRecords[item.targetTeacherId] = val;
              }
              if (item.rawKey !== item.targetTeacherId) {
                delete updatedRecords[item.rawKey];
              }
            }
          });
          await zD(docRef, {
            ...data,
            date: dateStr,
            grade: l,
            timestamp: Tv(),
            records: updatedRecords
          });
        }
      }
      await loadDashboardData(l, !1);
      alert(`✅ คลีนและรวมรายชื่อเป็นคนเดียวกันเรียบร้อยแล้ว!`);
    } catch (err) {
      console.error(`Error cleaning records:`, err);
      alert(`❌ เกิดข้อผิดพลาดในการคลีนข้อมูล`);
    }
  };

  let d = async teacherId => {
    c(prev => prev.includes(teacherId) ? prev : [...prev, teacherId]);
    try {
      let now = new Date(),
          dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, `0`)}-${String(now.getDate()).padStart(2, `0`)}`;
      await zD(rv(KD, `attendance_records`, `${dateStr}_${l}`), {
        date: dateStr,
        grade: l,
        timestamp: Tv(),
        records: { [teacherId]: a[teacherId] || `มาทันเวลา` }
      }, { merge: !0 });
      c(prev => prev.includes(teacherId) ? prev : [...prev, teacherId]);
    } catch (err) {
      console.error(`Error saving record: `, err);
      alert(`❌ เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่`);
    }
  };

  let f = async () => {
    await YD();
    e(`/`);
  };

  let p = e => e === `มาทันเวลา` ? `bg-green-50 border-green-200 text-green-700` : e === `มาแต่ไม่ทันเวลา` ? `bg-yellow-50 border-yellow-200 text-yellow-700` : e === `ไม่มา` ? `bg-red-50 border-red-200 text-red-700` : e === `เวร` ? `bg-blue-50 border-blue-200 text-blue-700` : e === `เฉพาะกิจ` ? `bg-orange-50 border-orange-200 text-orange-700` : e === `ขออนุญาต` ? `bg-teal-50 border-teal-200 text-teal-700` : `bg-gray-50 border-gray-200 text-gray-700`;
  let m = t.filter(e => !s.includes(e.id)),
      h = t.filter(e => s.includes(e.id));

  return (0, $.jsxs)(`div`, {
    className: `min-h-screen bg-[#F4F7F9] pb-32`,
    children: [
      (0, $.jsxs)(`header`, {
        className: `bg-white px-6 py-6 sticky top-0 z-10 flex flex-col space-y-4 rounded-b-3xl shadow-[0_10px_30px_rgb(0,0,0,0.03)] border-t-[12px] border-purple-600`,
        children: [
          (0, $.jsxs)(`div`, {
            className: `flex justify-between items-start`,
            children: [
              (0, $.jsxs)(`div`, {
                children: [
                  (0, $.jsxs)(`h1`, {
                    className: `text-3xl font-bold text-gray-800 leading-tight`,
                    children: [`เช็คชื่อกิจกรรม`, (0, $.jsx)(`br`, {}), `หน้าเสาธง`]
                  }),
                  (0, $.jsx)(`p`, {
                    className: `text-base text-purple-600 font-bold mt-2 tracking-wide uppercase`,
                    children: `ร.ร.บัวใหญ่ อบจ.นครราชสีมา`
                  })
                ]
              }),
              (0, $.jsxs)(`div`, {
                className: `flex flex-col items-end space-y-2`,
                children: [
                  (0, $.jsxs)(`div`, {
                    className: `flex items-center text-green-600 text-sm font-bold bg-green-50 px-3 py-1.5 rounded-full shadow-inner border border-green-100`,
                    children: [
                      (0, $.jsx)(`span`, { className: `w-2.5 h-2.5 rounded-full bg-green-500 mr-2 animate-pulse` }),
                      `ออนไลน์`
                    ]
                  }),
                  (0, $.jsxs)(`button`, {
                    onClick: () => setIsModalOpen(!0),
                    className: `text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${detectedIssues.length > 0 ? `bg-amber-50 border-amber-300 text-amber-800 animate-pulse` : `bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100`}`,
                    children: [
                      `🔍 ตรวจสอบ/คลีนชื่อ`,
                      detectedIssues.length > 0 && (0, $.jsx)(`span`, {
                        className: `bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]`,
                        children: detectedIssues.length
                      })
                    ]
                  }),
                  (0, $.jsx)(`button`, {
                    onClick: f,
                    className: `text-sm text-gray-400 hover:text-red-500 font-bold transition-colors`,
                    children: `ออกจากระบบ`
                  })
                ]
              })
            ]
          }),
          (0, $.jsxs)(`div`, {
            className: `pt-4 border-t border-gray-100 flex justify-between items-center`,
            children: [
              (0, $.jsxs)(`div`, {
                className: `flex items-center space-x-3`,
                children: [
                  (0, $.jsx)(`div`, {
                    className: `w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xl shadow-inner`,
                    children: l.toUpperCase()
                  }),
                  (0, $.jsxs)(`div`, {
                    children: [
                      (0, $.jsx)(`span`, { className: `font-bold text-gray-700 text-xl block`, children: `สายชั้น` }),
                      (0, $.jsx)(`span`, { className: `text-xs text-gray-400 font-medium`, children: `รูปแบบ: ชื่อ นามสกุล (ไร้คำนำหน้า)` })
                    ]
                  })
                ]
              }),
              (0, $.jsx)(`span`, {
                className: `text-gray-500 font-bold text-base bg-gray-50 px-4 py-2 rounded-full border border-gray-200`,
                children: new Date().toLocaleDateString(`th-TH`, { day: `numeric`, month: `short`, year: `numeric` })
              })
            ]
          })
        ]
      }),
      (0, $.jsx)(`div`, {
        className: `px-6 py-4 sticky top-[175px] z-10 bg-[#F4F7F9]/90 backdrop-blur-sm`,
        children: (0, $.jsxs)(`div`, {
          className: `bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white`,
          children: [
            (0, $.jsxs)(`div`, {
              className: `flex justify-between text-base font-bold mb-3`,
              children: [
                (0, $.jsx)(`span`, { className: `text-gray-500`, children: `ความคืบหน้าการเช็คชื่อ` }),
                (0, $.jsxs)(`span`, { className: `text-purple-600 bg-purple-50 px-3 py-1 rounded-lg text-lg`, children: [s.length, ` / `, t.length] })
              ]
            }),
            (0, $.jsx)(`div`, {
              className: `w-full bg-gray-100 rounded-full h-3.5 shadow-inner overflow-hidden`,
              children: (0, $.jsx)(`div`, {
                className: `bg-gradient-to-r from-purple-400 to-purple-600 h-3.5 rounded-full transition-all duration-700 ease-out`,
                style: { width: `${t.length === 0 ? 0 : s.length / t.length * 100}%` }
              })
            })
          ]
        })
      }),
      (0, $.jsxs)(`div`, {
        className: `px-6 space-y-6`,
        children: [
          r ? (0, $.jsx)(`div`, {
            className: `text-center py-10 text-gray-400 font-bold text-xl animate-pulse`,
            children: `กำลังโหลดรายชื่อ...`
          }) : m.length === 0 && t.length > 0 ? (0, $.jsxs)(`div`, {
            className: `text-center py-12 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col items-center`,
            children: [
              (0, $.jsx)(`div`, { className: `w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner`, children: `🎉` }),
              (0, $.jsx)(`h2`, { className: `text-3xl font-bold text-gray-800`, children: `ยอดเยี่ยม!` }),
              (0, $.jsx)(`p`, { className: `text-lg text-gray-500 mt-2 font-medium`, children: `เช็คชื่อครบทุกคนเรียบร้อยแล้ว` })
            ]
          }) : (0, $.jsxs)(`div`, {
            className: `space-y-4`,
            children: [
              (0, $.jsx)(`h2`, { className: `text-lg font-bold text-gray-500 mb-3`, children: `📌 รายชื่อที่ยังไม่ได้เช็ค` }),
              m.map(e => (0, $.jsxs)(`div`, {
                className: `bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col space-y-4 animate-fade-in relative overflow-hidden`,
                children: [
                  (0, $.jsx)(`div`, { className: `absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-10 -mt-10 z-0` }),
                  (0, $.jsxs)(`div`, {
                    className: `flex items-center space-x-5 relative z-10`,
                    children: [
                      (0, $.jsx)(`div`, {
                        className: `w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-2xl shadow-inner`,
                        children: e.name.charAt(0)
                      }),
                      (0, $.jsxs)(`div`, {
                        className: `flex-1`,
                        children: [
                          (0, $.jsx)(`h3`, { className: `font-bold text-gray-800 text-2xl`, children: e.name }),
                          (0, $.jsx)(`p`, { className: `text-base text-gray-400 font-medium mt-1`, children: e.room })
                        ]
                      }),
                      e.dutyDay === [`อาทิตย์`, `จันทร์`, `อังคาร`, `พุธ`, `พฤหัสบดี`, `ศุกร์`, `เสาร์`][new Date().getDay()] && (0, $.jsx)(`span`, {
                        className: `bg-purple-100 text-purple-700 text-sm px-3 py-1.5 rounded-full font-bold uppercase tracking-wider`,
                        children: `เวร`
                      })
                    ]
                  }),
                  (0, $.jsxs)(`div`, {
                    className: `flex space-x-3 mt-3 relative z-10`,
                    children: [
                      (0, $.jsxs)(`select`, {
                        value: a[e.id] || `มาทันเวลา`,
                        onChange: t => o(n => ({ ...n, [e.id]: t.target.value })),
                        className: `flex-1 p-4 rounded-xl font-bold text-lg border-0 bg-gray-50 focus:ring-2 focus:ring-purple-400 outline-none transition appearance-none ${p(a[e.id] || `มาทันเวลา`)}`,
                        children: [
                          (0, $.jsx)(`option`, { value: `มาทันเวลา`, children: `มาทันเวลา` }),
                          (0, $.jsx)(`option`, { value: `มาแต่ไม่ทันเวลา`, children: `มาแต่ไม่ทันเวลา` }),
                          (0, $.jsx)(`option`, { value: `ไม่มา`, children: `ไม่มา` }),
                          (0, $.jsx)(`option`, { value: `ลา`, children: `ลา` }),
                          (0, $.jsx)(`option`, { value: `ไปราชการ`, children: `ไปราชการ` }),
                          (0, $.jsx)(`option`, { value: `เวร`, children: `เวร` }),
                          (0, $.jsx)(`option`, { value: `เฉพาะกิจ`, children: `เฉพาะกิจ` }),
                          (0, $.jsx)(`option`, { value: `ขออนุญาต`, children: `ขออนุญาต` }),
                          (0, $.jsx)(`option`, { value: `ไม่ทราบสาเหตุ`, children: `ไม่ทราบสาเหตุ` })
                        ]
                      }),
                      (0, $.jsx)(`button`, {
                        onClick: () => d(e.id),
                        className: `w-28 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-xl shadow-[0_4px_12px_rgba(147,51,234,0.3)] transition active:scale-95 flex items-center justify-center`,
                        children: `บันทึก`
                      })
                    ]
                  })
                ]
              }, e.id))
            ]
          }),
          h.length > 0 && (0, $.jsxs)(`div`, {
            className: `mt-10 space-y-5 pt-8`,
            children: [
              (0, $.jsxs)(`div`, {
                className: `flex items-center justify-center space-x-4 mb-4 opacity-60`,
                children: [
                  (0, $.jsx)(`div`, { className: `h-px bg-gray-300 w-16` }),
                  (0, $.jsx)(`span`, { className: `text-base font-bold text-gray-500`, children: `เช็คชื่อแล้ว` }),
                  (0, $.jsx)(`div`, { className: `h-px bg-gray-300 w-16` })
                ]
              }),
              h.map(e => (0, $.jsxs)(`div`, {
                className: `bg-white/60 p-5 rounded-3xl border border-white flex flex-col space-y-4 opacity-80 hover:opacity-100 transition-opacity`,
                children: [
                  (0, $.jsxs)(`div`, {
                    className: `flex items-center space-x-5`,
                    children: [
                      (0, $.jsx)(`div`, { className: `w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl`, children: `✓` }),
                      (0, $.jsx)(`div`, { className: `flex-1`, children: (0, $.jsx)(`h3`, { className: `font-bold text-gray-600 text-xl`, children: e.name }) })
                    ]
                  }),
                  (0, $.jsxs)(`div`, {
                    className: `flex space-x-3`,
                    children: [
                      (0, $.jsxs)(`select`, {
                        value: a[e.id],
                        onChange: t => o(n => ({ ...n, [e.id]: t.target.value })),
                        className: `flex-1 p-3 text-base rounded-xl font-bold border-0 bg-white focus:ring-2 focus:ring-purple-400 outline-none transition appearance-none ${p(a[e.id])}`,
                        children: [
                          (0, $.jsx)(`option`, { value: `มาทันเวลา`, children: `มาทันเวลา` }),
                          (0, $.jsx)(`option`, { value: `มาแต่ไม่ทันเวลา`, children: `มาแต่ไม่ทันเวลา` }),
                          (0, $.jsx)(`option`, { value: `ไม่มา`, children: `ไม่มา` }),
                          (0, $.jsx)(`option`, { value: `ลา`, children: `ลา` }),
                          (0, $.jsx)(`option`, { value: `ไปราชการ`, children: `ไปราชการ` }),
                          (0, $.jsx)(`option`, { value: `เวร`, children: `เวร` }),
                          (0, $.jsx)(`option`, { value: `เฉพาะกิจ`, children: `เฉพาะกิจ` }),
                          (0, $.jsx)(`option`, { value: `ขออนุญาต`, children: `ขออนุญาต` }),
                          (0, $.jsx)(`option`, { value: `ไม่ทราบสาเหตุ`, children: `ไม่ทราบสาเหตุ` })
                        ]
                      }),
                      (0, $.jsx)(`button`, {
                        onClick: () => {
                          d(e.id);
                          alert(`✅ อัปเดตข้อมูลแก้ไขเรียบร้อยแล้ว`);
                        },
                        className: `px-6 bg-gray-100 hover:bg-gray-200 text-gray-600 text-base font-bold rounded-xl transition active:scale-95`,
                        children: `อัปเดต`
                      })
                    ]
                  })
                ]
              }, e.id))
            ]
          })
        ]
      }),
      (0, $.jsx)(NameCleanerModal, {
        isOpen: isModalOpen,
        onClose: () => setIsModalOpen(!1),
        grade: l,
        rosterTeachers: t,
        detectedIssues,
        aliasMap: aliases,
        onCleanAndMerge: handleCleanAndMerge,
        onRefreshSheet: () => loadDashboardData(l, !0)
      }),
      (0, $.jsxs)(`div`, {
        className: `fixed bottom-6 left-6 right-6 bg-purple-600 rounded-[32px] flex h-16 shadow-[0_10px_40px_-10px_rgba(147,51,234,0.6)] z-20 overflow-hidden`,
        children: [
          (0, $.jsxs)(`button`, {
            className: `flex-1 flex flex-col items-center justify-center text-white bg-white/20`,
            children: [
              (0, $.jsx)(`svg`, { xmlns: `http://www.w3.org/2000/svg`, className: `h-6 w-6 mb-1`, fill: `none`, viewBox: `0 0 24 24`, stroke: `currentColor`, children: (0, $.jsx)(`path`, { strokeLinecap: `round`, strokeLinejoin: `round`, strokeWidth: 2.5, d: `M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01` }) }),
              (0, $.jsx)(`span`, { className: `text-[10px] font-bold tracking-wide`, children: `เช็คชื่อ` })
            ]
          }),
          (0, $.jsxs)(`button`, {
            onClick: () => e(`/history`),
            className: `flex-1 flex flex-col items-center justify-center text-purple-200 hover:text-white hover:bg-white/5 transition-colors`,
            children: [
              (0, $.jsx)(`svg`, { xmlns: `http://www.w3.org/2000/svg`, className: `h-6 w-6 mb-1`, fill: `none`, viewBox: `0 0 24 24`, stroke: `currentColor`, children: (0, $.jsx)(`path`, { strokeLinecap: `round`, strokeLinejoin: `round`, strokeWidth: 2, d: `M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z` }) }),
              (0, $.jsx)(`span`, { className: `text-[10px] font-medium tracking-wide`, children: `ประวัติ` })
            ]
          })
        ]
      })
    ]
  });
}

// 9. หน้าประวัติการเช็คชื่อรายสัปดาห์ (/history)
function rO() {
  let e = Dt(),
      [t, n] = (0, _.useState)([]),
      [r, i] = (0, _.useState)(``),
      [a, o] = (0, _.useState)(new Date()),
      [s, c] = (0, _.useState)({}),
      [l, u] = (0, _.useState)(!0),
      [aliases, setAliases] = (0, _.useState)({}),
      [weekIssues, setWeekIssues] = (0, _.useState)([]),
      [isModalOpen, setIsModalOpen] = (0, _.useState)(!1);

  (0, _.useEffect)(() => {
    let t = GD.currentUser;
    t && t.email ? i(t.email.split(`@`)[0]) : e(`/`);
  }, [e]);

  let d = e => {
    let t = new Date(e), n = t.getDay(), r = n === 0 ? -6 : 1 - n, i = new Date(t);
    i.setDate(t.getDate() + r);
    let a = [];
    for (let e = 0; e < 5; e++) {
      let t = new Date(i);
      t.setDate(i.getDate() + e);
      a.push(t);
    }
    return a;
  };
  let f = d(a),
      p = [`จ.`, `อ.`, `พ.`, `พฤ.`, `ศ.`];

  let loadHistoryWeek = async (grade, currentAnchorDate, forceSheet = !1) => {
    if (!grade) return;
    u(!0);
    let [roster, loadedAliases] = await Promise.all([
      eO(grade, forceSheet),
      loadAliases(grade)
    ]);
    n(roster);
    setAliases(loadedAliases);

    let days = d(currentAnchorDate),
        resolvedWeek = {},
        allIssues = [];

    let promises = days.map(async dayObj => {
      let dateStr = `${dayObj.getFullYear()}-${String(dayObj.getMonth() + 1).padStart(2, `0`)}-${String(dayObj.getDate()).padStart(2, `0`)}`,
          docRef = rv(KD, `attendance_records`, `${dateStr}_${grade}`);
      try {
        let snap = await RD(docRef);
        if (snap.exists()) {
          let rawRecs = snap.data().records || {};
          let { resolved, issues } = resolveAttendanceRecords(roster, rawRecs, loadedAliases, dateStr);
          resolvedWeek[dateStr] = resolved;
          issues.forEach(iss => allIssues.push(iss));
        } else {
          resolvedWeek[dateStr] = {};
        }
      } catch (err) {
        console.error(`Error fetching`, dateStr, err);
        resolvedWeek[dateStr] = {};
      }
    });
    await Promise.all(promises);
    c(resolvedWeek);
    setWeekIssues(allIssues);
    u(!1);
  };

  (0, _.useEffect)(() => {
    if (r) loadHistoryWeek(r, a, !1);
  }, [r, a]);

  let handleCleanAndMergeWeek = async (itemsToClean, isQuickBindOnly = !1) => {
    try {
      let newAliasEntries = {};
      itemsToClean.forEach(item => {
        if (item.rawKey && item.targetTeacherId && !/^t\d+$/.test(item.rawKey)) {
          newAliasEntries[item.rawKey] = item.targetTeacherId;
          if (item.cleanedKey) newAliasEntries[item.cleanedKey] = item.targetTeacherId;
        }
      });
      if (Object.keys(newAliasEntries).length > 0) {
        await saveAliases(r, newAliasEntries);
      }

      if (!isQuickBindOnly) {
        let byDate = {};
        itemsToClean.forEach(item => {
          if (item.dateKey && item.rawKey && item.targetTeacherId) {
            if (!byDate[item.dateKey]) byDate[item.dateKey] = [];
            byDate[item.dateKey].push(item);
          }
        });
        for (let dateStr of Object.keys(byDate)) {
          let docRef = rv(KD, `attendance_records`, `${dateStr}_${r}`);
          let snap = await RD(docRef);
          if (snap.exists()) {
            let data = snap.data();
            let updatedRecords = { ...(data.records || {}) };
            byDate[dateStr].forEach(item => {
              if (updatedRecords[item.rawKey]) {
                let val = updatedRecords[item.rawKey];
                if (!updatedRecords[item.targetTeacherId]) {
                  updatedRecords[item.targetTeacherId] = val;
                }
                if (item.rawKey !== item.targetTeacherId) {
                  delete updatedRecords[item.rawKey];
                }
              }
            });
            await zD(docRef, {
              ...data,
              date: dateStr,
              grade: r,
              timestamp: Tv(),
              records: updatedRecords
            });
          }
        }
      }
      await loadHistoryWeek(r, a, !1);
      alert(`✅ คลีนและรวมรายชื่อในสัปดาห์นี้เรียบร้อยแล้ว!`);
    } catch (err) {
      console.error(`Error cleaning week records:`, err);
      alert(`❌ เกิดข้อผิดพลาดในการคลีนข้อมูล`);
    }
  };

  let m = () => {
    let e = new Date(a);
    e.setDate(e.getDate() - 7);
    o(e);
  };
  let h = () => {
    let e = new Date(a);
    e.setDate(e.getDate() + 7);
    o(e);
  };
  let g = e => e.toLocaleDateString(`th-TH`, { day: `numeric`, month: `short` });
  let v = e => {
    switch (e) {
      case `มาทันเวลา`: return { text: `มาทันเวลา`, style: `text-green-700 bg-green-100 border-green-200` };
      case `มาแต่ไม่ทันเวลา`: return { text: `มาแต่ไม่ทันเวลา`, style: `text-yellow-700 bg-yellow-100 border-yellow-200` };
      case `ไม่มา`: return { text: `ไม่มา`, style: `text-red-700 bg-red-100 border-red-200` };
      case `ลา`: return { text: `ลา`, style: `text-gray-700 bg-gray-200 border-gray-300` };
      case `ไปราชการ`: return { text: `ไปราชการ`, style: `text-purple-700 bg-purple-100 border-purple-200` };
      case `เวร`: return { text: `เวร`, style: `text-blue-700 bg-blue-100 border-blue-200` };
      case `เฉพาะกิจ`: return { text: `เฉพาะกิจ`, style: `text-orange-700 bg-orange-100 border-orange-200` };
      case `ขออนุญาต`: return { text: `ขออนุญาต`, style: `text-teal-700 bg-teal-100 border-teal-200` };
      case `ไม่ทราบสาเหตุ`: return { text: `ไม่ทราบสาเหตุ`, style: `text-gray-500 bg-gray-100 border-gray-200` };
      default: return { text: `-`, style: `text-gray-400` };
    }
  };

  return (0, $.jsxs)(`div`, {
    className: `min-h-screen bg-[#F4F7F9] pb-32`,
    children: [
      (0, $.jsxs)(`header`, {
        className: `bg-white px-6 py-6 sticky top-0 z-10 flex flex-col space-y-4 rounded-b-3xl shadow-[0_10px_30px_rgb(0,0,0,0.03)] border-t-[12px] border-purple-600`,
        children: [
          (0, $.jsxs)(`div`, {
            className: `flex justify-between items-start mb-2`,
            children: [
              (0, $.jsxs)(`div`, {
                children: [
                  (0, $.jsx)(`h1`, { className: `text-3xl font-bold text-gray-800 leading-tight`, children: `ประวัติการเช็คชื่อ` }),
                  (0, $.jsxs)(`p`, { className: `text-base text-purple-600 font-bold mt-2 tracking-wide uppercase`, children: [`สายชั้น `, r.toUpperCase(), ` (ชื่อ นามสกุล)`] })
                ]
              }),
              (0, $.jsxs)(`button`, {
                onClick: () => setIsModalOpen(!0),
                className: `text-xs font-bold px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 ${weekIssues.length > 0 ? `bg-amber-50 border-amber-300 text-amber-800 animate-pulse` : `bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100`}`,
                children: [
                  `🔍 ตรวจสอบ/คลีนชื่อ`,
                  weekIssues.length > 0 && (0, $.jsx)(`span`, {
                    className: `bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]`,
                    children: weekIssues.length
                  })
                ]
              })
            ]
          }),
          (0, $.jsxs)(`div`, {
            className: `bg-gray-50 border border-gray-100 p-3 rounded-2xl flex items-center justify-between shadow-inner`,
            children: [
              (0, $.jsx)(`button`, { onClick: m, className: `p-3 px-5 bg-white hover:bg-gray-100 rounded-xl font-bold text-xl transition shadow-sm text-purple-600`, children: `<` }),
              (0, $.jsxs)(`div`, {
                className: `text-center font-medium`,
                children: [
                  (0, $.jsx)(`span`, { className: `text-sm text-gray-500 font-bold uppercase tracking-wider`, children: `สัปดาห์` }),
                  (0, $.jsx)(`br`, {}),
                  (0, $.jsxs)(`span`, { className: `text-xl font-bold text-gray-800`, children: [g(f[0]), ` - `, g(f[4]), ` `, f[0].getFullYear() + 543] })
                ]
              }),
              (0, $.jsx)(`button`, { onClick: h, className: `p-3 px-5 bg-white hover:bg-gray-100 rounded-xl font-bold text-xl transition shadow-sm text-purple-600`, children: `>` })
            ]
          })
        ]
      }),
      (0, $.jsx)(`div`, {
        className: `p-6`,
        children: l ? (0, $.jsx)(`div`, {
          className: `text-center py-20 text-xl text-gray-500 font-bold animate-pulse`,
          children: `กำลังโหลดข้อมูลจากฐานข้อมูล...`
        }) : (0, $.jsx)(`div`, {
          className: `border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm`,
          children: (0, $.jsx)(`div`, {
            className: `overflow-x-auto w-full`,
            children: (0, $.jsxs)(`div`, {
              className: `min-w-[900px]`,
              children: [
                (0, $.jsxs)(`div`, {
                  className: `flex bg-gray-100 border-b border-gray-200`,
                  children: [
                    (0, $.jsx)(`div`, {
                      className: `w-[250px] flex-shrink-0 p-4 flex items-center border-r border-gray-200`,
                      children: (0, $.jsx)(`span`, { className: `text-xl font-bold text-gray-600`, children: `ชื่อ - นามสกุล` })
                    }),
                    (0, $.jsx)(`div`, {
                      className: `flex-1 flex`,
                      children: f.map((e, t) => (0, $.jsxs)(`div`, {
                        className: `flex-1 p-4 flex flex-col items-center justify-center border-r border-gray-200 last:border-r-0`,
                        children: [
                          (0, $.jsx)(`span`, { className: `text-base text-gray-500 font-bold`, children: p[t] }),
                          (0, $.jsx)(`span`, { className: `text-xl font-bold text-gray-800 mt-1`, children: e.getDate() })
                        ]
                      }, t))
                    })
                  ]
                }),
                (0, $.jsx)(`div`, {
                  className: `divide-y divide-gray-200`,
                  children: t.map(e => (0, $.jsxs)(`div`, {
                    className: `flex hover:bg-gray-50 transition-colors`,
                    children: [
                      (0, $.jsx)(`div`, {
                        className: `w-[250px] flex-shrink-0 p-4 flex items-center border-r border-gray-100`,
                        children: (0, $.jsxs)(`div`, {
                          className: `flex flex-col`,
                          children: [
                            (0, $.jsx)(`span`, { className: `text-xl font-bold text-gray-800 leading-tight`, children: e.name }),
                            (0, $.jsx)(`span`, { className: `text-base text-gray-400 mt-1`, children: e.room })
                          ]
                        })
                      }),
                      (0, $.jsx)(`div`, {
                        className: `flex-1 flex`,
                        children: f.map((t, n) => {
                          let r = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, `0`)}-${String(t.getDate()).padStart(2, `0`)}`,
                              i = s[r]?.[e.id],
                              a = v(i);
                          return (0, $.jsx)(`div`, {
                            className: `flex-1 p-3 flex items-center justify-center border-r border-gray-100 last:border-r-0`,
                            children: i ? (0, $.jsx)(`span`, { className: `text-base font-bold px-3 py-2 rounded-lg border shadow-sm ${a.style}`, children: a.text }) : (0, $.jsx)(`span`, { className: `text-lg ${a.style}`, children: a.text })
                          }, n);
                        })
                      })
                    ]
                  }, e.id))
                })
              ]
            })
          })
        })
      }),
      (0, $.jsx)(NameCleanerModal, {
        isOpen: isModalOpen,
        onClose: () => setIsModalOpen(!1),
        grade: r,
        rosterTeachers: t,
        detectedIssues: weekIssues,
        aliasMap: aliases,
        onCleanAndMerge: handleCleanAndMergeWeek,
        onRefreshSheet: () => loadHistoryWeek(r, a, !0)
      }),
      (0, $.jsxs)(`div`, {
        className: `fixed bottom-6 left-6 right-6 bg-purple-600 rounded-[32px] flex h-16 shadow-[0_10px_40px_-10px_rgba(147,51,234,0.6)] z-20 overflow-hidden`,
        children: [
          (0, $.jsxs)(`button`, {
            onClick: () => e(`/dashboard`),
            className: `flex-1 flex flex-col items-center justify-center text-purple-200 hover:text-white hover:bg-white/5 transition-colors`,
            children: [
              (0, $.jsx)(`svg`, { xmlns: `http://www.w3.org/2000/svg`, className: `h-6 w-6 mb-1`, fill: `none`, viewBox: `0 0 24 24`, stroke: `currentColor`, children: (0, $.jsx)(`path`, { strokeLinecap: `round`, strokeLinejoin: `round`, strokeWidth: 2, d: `M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01` }) }),
              (0, $.jsx)(`span`, { className: `text-[10px] font-medium tracking-wide`, children: `เช็คชื่อ` })
            ]
          }),
          (0, $.jsxs)(`button`, {
            className: `flex-1 flex flex-col items-center justify-center text-white bg-white/20`,
            children: [
              (0, $.jsx)(`svg`, { xmlns: `http://www.w3.org/2000/svg`, className: `h-6 w-6 mb-1`, fill: `none`, viewBox: `0 0 24 24`, stroke: `currentColor`, children: (0, $.jsx)(`path`, { strokeLinecap: `round`, strokeLinejoin: `round`, strokeWidth: 2.5, d: `M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z` }) }),
              (0, $.jsx)(`span`, { className: `text-[10px] font-bold tracking-wide`, children: `ประวัติ` })
            ]
          })
        ]
      })
    ]
  });
}

function iO() {
  return (0, $.jsx)(Rn, {
    children: (0, $.jsxs)($t, {
      children: [
        (0, $.jsx)(Zt, { path: `/`, element: (0, $.jsx)(ZD, {}) }),
        (0, $.jsx)(Zt, { path: `/dashboard`, element: (0, $.jsx)(nO, {}) }),
        (0, $.jsx)(Zt, { path: `/history`, element: (0, $.jsx)(rO, {}) }),
        (0, $.jsx)(Zt, { path: `*`, element: (0, $.jsx)(Xt, { to: `/`, replace: !0 }) })
      ]
    })
  });
}
(0, v.createRoot)(document.getElementById(`root`)).render((0, $.jsx)(_.StrictMode, { children: (0, $.jsx)(iO, {}) }));
