const bank = window.INSURANCE_QUESTION_BANK || { total: 0, questions: [] };
const STORAGE_KEY = "hk-insurance-question-bank-v1";
const NEXT_BUFFER_SIZE = 2;

const els = {
  paperFilter: document.querySelector("#paperFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  chapterFilter: document.querySelector("#chapterFilter"),
  nextQuestion: document.querySelector("#nextQuestion"),
  nextQuestionBottom: document.querySelector("#nextQuestionBottom"),
  showAnswer: document.querySelector("#showAnswer"),
  retryWrong: document.querySelector("#retryWrong"),
  resetStats: document.querySelector("#resetStats"),
  questionSubject: document.querySelector("#questionSubject"),
  questionSource: document.querySelector("#questionSource"),
  questionChapter: document.querySelector("#questionChapter"),
  questionText: document.querySelector("#questionText"),
  options: document.querySelector("#options"),
  result: document.querySelector("#result"),
  answeredCount: document.querySelector("#answeredCount"),
  accuracyRate: document.querySelector("#accuracyRate"),
  availableCount: document.querySelector("#availableCount"),
  wrongCount: document.querySelector("#wrongCount"),
  totalCount: document.querySelector("#totalCount"),
  panel: document.querySelector(".question-panel"),
};

const state = {
  current: null,
  answered: false,
  wrongOnly: false,
  previousStack: [],
  nextStack: [],
  animating: false,
  touch: {
    startX: 0,
    startY: 0,
    startTime: 0,
    tracking: false,
    swiped: false,
    pointerId: null,
    fromPanel: false,
  },
  history: loadHistory(),
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function setOptions(select, values, allLabel) {
  const current = select.value;
  select.innerHTML = "";
  select.append(new Option(allLabel, "all"));
  values.forEach((value) => select.append(new Option(value, value)));
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function populateFilters() {
  setOptions(els.paperFilter, unique(bank.questions.map((q) => q.paper)), "全部科目");
  setOptions(els.sourceFilter, unique(bank.questions.map((q) => q.source)), "全部題庫");
  refreshChapterFilter();
}

function refreshChapterFilter() {
  const questions = filteredQuestions({ includeChapter: false, includeWrongMode: false });
  setOptions(els.chapterFilter, unique(questions.map((q) => q.chapter)), "全部章節");
}

function filteredQuestions({ includeChapter = true, includeWrongMode = true } = {}) {
  const paper = els.paperFilter.value;
  const source = els.sourceFilter.value;
  const chapter = els.chapterFilter.value;

  return bank.questions.filter((question) => {
    if (paper !== "all" && question.paper !== paper) return false;
    if (source !== "all" && question.source !== source) return false;
    if (includeChapter && chapter !== "all" && question.chapter !== chapter) return false;
    if (includeWrongMode && state.wrongOnly && !state.history[question.id]?.wrong) return false;
    return true;
  });
}

function resetQuestionFlow() {
  state.current = null;
  state.previousStack = [];
  state.nextStack = [];

  const questions = filteredQuestions();
  els.availableCount.textContent = questions.length;
  if (!questions.length) {
    showEmptyState();
    return;
  }

  const first = pickRandomQuestion(questions);
  state.current = first;
  fillNextBuffer();
  renderQuestion(first, "none");
}

function fillNextBuffer() {
  const questions = filteredQuestions();
  while (state.nextStack.length < NEXT_BUFFER_SIZE && questions.length) {
    state.nextStack.push(pickRandomQuestion(questions));
  }
}

function pickRandomQuestion(questions) {
  const blockedIds = new Set([
    state.current?.id,
    ...state.previousStack.slice(-4).map((q) => q.id),
    ...state.nextStack.map((q) => q.id),
  ].filter(Boolean));

  const candidates = questions.filter((question) => !blockedIds.has(question.id));
  const pool = candidates.length ? candidates : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}

function goNext({ animate = true } = {}) {
  const questions = filteredQuestions();
  els.availableCount.textContent = questions.length;

  if (!questions.length) {
    showEmptyState();
    return;
  }

  fillNextBuffer();
  const next = state.nextStack.shift() || pickRandomQuestion(questions);
  if (state.current) {
    state.previousStack.push(state.current);
  }
  fillNextBuffer();
  renderQuestion(next, animate ? "next" : "none");
}

function goPrevious() {
  if (!state.previousStack.length) return;
  const previous = state.previousStack.pop();
  if (state.current) {
    state.nextStack.unshift(state.current);
  }
  renderQuestion(previous, "previous");
}

window.__questionFlowDebug = () => ({
  current: state.current?.number,
  previous: state.previousStack.map((q) => q.number),
  next: state.nextStack.map((q) => q.number),
});

function showEmptyState() {
  state.current = null;
  els.questionSubject.textContent = "沒有符合條件的題目";
  els.questionSource.textContent = "";
  els.questionChapter.textContent = "";
  els.questionText.textContent = state.wrongOnly
    ? "目前篩選條件下沒有錯題。"
    : "目前篩選條件下沒有可練習的題目。";
  els.options.innerHTML = "";
  els.result.hidden = true;
  els.showAnswer.disabled = true;
}

function renderQuestion(question, direction = "none") {
  state.current = question;
  state.answered = false;
  els.showAnswer.disabled = false;
  els.result.hidden = true;
  els.result.className = "result";

  applyPanelAnimation(direction);

  els.questionSubject.textContent = `${question.paper} · ${question.subject}`;
  els.questionSource.textContent = question.source;
  els.questionChapter.textContent = `第 ${question.chapter} 章`;
  els.questionText.textContent = `${question.number}. ${question.question}`;

  els.options.innerHTML = "";
  Object.entries(question.options).forEach(([letter, text]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.letter = letter;
    button.innerHTML = `<span class="letter">${letter}</span><span>${escapeHtml(text)}</span>`;
    button.addEventListener("click", () => chooseAnswer(letter));
    els.options.append(button);
  });
}

function applyPanelAnimation(direction) {
  if (direction === "none") return;
  state.animating = true;
  els.panel.classList.remove("slide-next", "slide-previous");
  void els.panel.offsetWidth;
  els.panel.classList.add(direction === "next" ? "slide-next" : "slide-previous");
  window.setTimeout(() => {
    els.panel.classList.remove("slide-next", "slide-previous");
    state.animating = false;
  }, 280);
}

function chooseAnswer(letter) {
  if (!state.current || state.answered) return;
  const isCorrect = letter === state.current.answer;
  state.answered = true;

  const record = state.history[state.current.id] || {
    attempts: 0,
    correct: 0,
    wrong: false,
  };
  record.attempts += 1;
  if (isCorrect) {
    record.correct += 1;
    record.wrong = false;
  } else {
    record.wrong = true;
  }
  state.history[state.current.id] = record;
  saveHistory();

  revealAnswer(letter);
  updateStats();
}

function revealAnswer(selectedLetter = null) {
  if (!state.current) return;
  state.answered = true;

  [...els.options.children].forEach((button) => {
    const letter = button.dataset.letter;
    button.disabled = true;
    button.classList.toggle("correct", letter === state.current.answer);
    button.classList.toggle("wrong", selectedLetter === letter && letter !== state.current.answer);
  });

  const isWrong = selectedLetter && selectedLetter !== state.current.answer;
  const prefix = !selectedLetter ? "正確答案" : isWrong ? "答錯了" : "答對了";
  els.result.className = `result${isWrong ? " is-wrong" : ""}`;
  els.result.innerHTML = `
    <strong>${prefix}: ${state.current.answer}. ${escapeHtml(state.current.options[state.current.answer])}</strong>
    <span>${escapeHtml(state.current.explanation || "此題暫無解析。")}</span>
  `;
  els.result.hidden = false;
}

function updateStats() {
  const records = Object.values(state.history);
  const answered = records.reduce((sum, record) => sum + record.attempts, 0);
  const correct = records.reduce((sum, record) => sum + record.correct, 0);
  const wrong = records.filter((record) => record.wrong).length;

  els.answeredCount.textContent = answered;
  els.accuracyRate.textContent = answered ? `${Math.round((correct / answered) * 100)}%` : "0%";
  els.wrongCount.textContent = wrong;
  els.totalCount.textContent = bank.total || bank.questions.length;
  els.availableCount.textContent = filteredQuestions().length;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function beginSwipe(event) {
  if (event.touches.length !== 1) return;
  if (event.target.closest("select, input, textarea, .actions button")) return;
  if (!event.target.closest(".question-panel")) return;

  const touch = event.touches[0];
  state.touch = {
    startX: touch.clientX,
    startY: touch.clientY,
    startTime: Date.now(),
    tracking: true,
    swiped: false,
    pointerId: null,
    fromPanel: true,
  };
}

function finishSwipe(event) {
  if (!state.touch.tracking || !state.touch.fromPanel || event.changedTouches.length !== 1) return;

  const touch = event.changedTouches[0];
  completeSwipe(touch.clientX, touch.clientY);
}

function moveSwipe(event) {
  if (!state.touch.tracking || !state.touch.fromPanel || event.touches.length !== 1) return;

  const touch = event.touches[0];
  if (isSwipeReady(touch.clientX, touch.clientY)) {
    event.preventDefault();
    completeSwipe(touch.clientX, touch.clientY);
  }
}

function swipeDelta(clientX, clientY) {
  return {
    x: clientX - state.touch.startX,
    y: clientY - state.touch.startY,
    elapsed: Date.now() - state.touch.startTime,
  };
}

function isSwipeReady(clientX, clientY) {
  const delta = swipeDelta(clientX, clientY);
  return Math.abs(delta.x) > 42 && Math.abs(delta.x) > Math.abs(delta.y) * 1.25 && delta.elapsed < 1500;
}

function completeSwipe(clientX, clientY) {
  if (!isSwipeReady(clientX, clientY)) {
    state.touch.tracking = false;
    state.touch.fromPanel = false;
    return;
  }

  const delta = swipeDelta(clientX, clientY);
  state.touch.tracking = false;
  state.touch.fromPanel = false;
  state.touch.swiped = true;

  if (delta.x < 0) {
    goNext();
  } else {
    goPrevious();
  }
}

function cancelSwipe() {
  state.touch.tracking = false;
  state.touch.fromPanel = false;
}

function cancelClickAfterSwipe(event) {
  if (!state.touch.swiped) return;
  state.touch.swiped = false;
  event.preventDefault();
  event.stopPropagation();
}

function beginPointerSwipe(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (event.target.closest("select, input, textarea, .actions button")) return;
  if (!event.target.closest(".question-panel")) return;

  state.touch = {
    startX: event.clientX,
    startY: event.clientY,
    startTime: Date.now(),
    tracking: true,
    swiped: false,
    pointerId: event.pointerId,
    fromPanel: true,
  };
}

function finishPointerSwipe(event) {
  if (!state.touch.tracking || state.touch.pointerId !== event.pointerId) return;
  completeSwipe(event.clientX, event.clientY);
}

function movePointerSwipe(event) {
  if (!state.touch.tracking || state.touch.pointerId !== event.pointerId) return;

  if (isSwipeReady(event.clientX, event.clientY)) {
    event.preventDefault();
    completeSwipe(event.clientX, event.clientY);
  }
}

function handleFilterChange({ refreshChapters = false } = {}) {
  if (refreshChapters) {
    refreshChapterFilter();
  }
  updateStats();
  resetQuestionFlow();
}

els.paperFilter.addEventListener("change", () => handleFilterChange({ refreshChapters: true }));
els.sourceFilter.addEventListener("change", () => handleFilterChange({ refreshChapters: true }));
els.chapterFilter.addEventListener("change", () => handleFilterChange());
els.nextQuestion.addEventListener("click", () => goNext());
els.nextQuestionBottom.addEventListener("click", () => goNext());
els.showAnswer.addEventListener("click", () => revealAnswer());
els.retryWrong.addEventListener("click", () => {
  state.wrongOnly = !state.wrongOnly;
  els.retryWrong.textContent = state.wrongOnly ? "退出錯題練習" : "只練錯題";
  updateStats();
  resetQuestionFlow();
});
els.resetStats.addEventListener("click", () => {
  state.history = {};
  saveHistory();
  updateStats();
  resetQuestionFlow();
});

document.addEventListener("touchstart", beginSwipe, { passive: true, capture: true });
document.addEventListener("touchmove", moveSwipe, { passive: false, capture: true });
document.addEventListener("touchend", finishSwipe, { passive: true, capture: true });
document.addEventListener("touchcancel", cancelSwipe, { passive: true, capture: true });
els.panel.addEventListener("pointerdown", beginPointerSwipe);
els.panel.addEventListener("pointermove", movePointerSwipe);
els.panel.addEventListener("pointerup", finishPointerSwipe);
els.panel.addEventListener("pointercancel", cancelSwipe);
els.panel.addEventListener("click", cancelClickAfterSwipe, true);

populateFilters();
updateStats();
resetQuestionFlow();
