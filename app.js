// DOM Elements
const elements = {
  pbWpm: document.getElementById('pb-wpm'),
  currentWpm: document.getElementById('current-wpm'),
  currentAccuracy: document.getElementById('current-accuracy'),
  currentTime: document.getElementById('current-time'),
  passageDisplay: document.getElementById('passage-display'),
  startOverlay: document.getElementById('start-overlay'),
  btnStart: document.getElementById('btn-start'),
  difficultyBtns: document.querySelectorAll('#difficulty-toggle .toggle-btn'),
  modeBtns: document.querySelectorAll('#mode-toggle .toggle-btn'),
  resultsModal: document.getElementById('results-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalSubtitle: document.getElementById('modal-subtitle'),
  modalIcon: document.getElementById('modal-icon'),
  finalWpm: document.getElementById('final-wpm'),
  finalAccuracy: document.getElementById('final-accuracy'),
  finalCharacters: document.getElementById('final-characters'),
  btnRestart: document.getElementById('btn-restart'),
  typingAreaContainer: document.querySelector('.typing-area-container')
};

// State
let state = {
  data: null,
  difficulty: 'easy',
  mode: 'timed', // 'timed' or 'passage'
  currentPassage: '',
  charsTyped: [], // array of { char, isCorrect }
  currentIndex: 0,
  errors: 0,
  totalKeystrokes: 0,
  timer: 60,
  intervalId: null,
  isActive: false,
  personalBest: localStorage.getItem('typingSpeedPB') || 0
};

// Initialization
async function init() {
  elements.pbWpm.textContent = state.personalBest;
  
  try {
    const response = await fetch('data.json');
    state.data = await response.json();
    setRandomPassage();
  } catch (error) {
    console.error('Error loading passage data:', error);
    elements.passageDisplay.innerHTML = '<span class="char">Error loading data. Please try again.</span>';
  }

  setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
  // Difficulty Toggle
  elements.difficultyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (state.isActive) return; // Prevent changing during test
      elements.difficultyBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.difficulty = e.target.dataset.difficulty;
      setRandomPassage();
    });
  });

  // Mode Toggle
  elements.modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (state.isActive) return;
      elements.modeBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.mode = e.target.dataset.mode;
      resetTest();
    });
  });

  // Start Buttons
  elements.btnStart.addEventListener('click', startTest);
  
  // Click on passage to start
  elements.passageDisplay.addEventListener('click', () => {
    if (!state.isActive) startTest();
  });

  // Restart Button
  elements.btnRestart.addEventListener('click', () => {
    elements.resultsModal.classList.add('hidden');
    // Remove confetti if present
    const confetti = document.querySelector('.confetti');
    if (confetti) confetti.remove();
    setRandomPassage();
  });

  // Typing logic
  document.addEventListener('keydown', handleTyping);
}

// Test Logic
function setRandomPassage() {
  if (!state.data) return;
  const passages = state.data[state.difficulty];
  const random = passages[Math.floor(Math.random() * passages.length)];
  state.currentPassage = random.text;
  resetTest();
}

function resetTest() {
  clearInterval(state.intervalId);
  state.isActive = false;
  state.currentIndex = 0;
  state.errors = 0;
  state.totalKeystrokes = 0;
  state.charsTyped = [];
  state.timer = state.mode === 'timed' ? 60 : 0;
  
  updateTimerDisplay();
  elements.currentWpm.textContent = '0';
  elements.currentAccuracy.textContent = '100%';
  
  renderPassage();
  elements.startOverlay.classList.remove('hidden');
  elements.passageDisplay.classList.add('blurred');
}

function renderPassage() {
  elements.passageDisplay.innerHTML = '';
  const chars = state.currentPassage.split('');
  
  chars.forEach((char, index) => {
    const span = document.createElement('span');
    span.textContent = char;
    span.classList.add('char');
    
    if (index === state.currentIndex && state.isActive) {
      span.classList.add('cursor');
    }
    
    if (state.charsTyped[index]) {
      if (state.charsTyped[index].isCorrect) {
        span.classList.add('correct');
      } else {
        span.classList.add('incorrect');
      }
    }
    
    elements.passageDisplay.appendChild(span);
  });
  
  // Handle cursor at the very end
  if (state.currentIndex === chars.length && state.isActive) {
    const spaceSpan = document.createElement('span');
    spaceSpan.classList.add('char', 'cursor');
    spaceSpan.textContent = ' ';
    elements.passageDisplay.appendChild(spaceSpan);
  }
}

function startTest() {
  state.isActive = true;
  elements.startOverlay.classList.add('hidden');
  elements.passageDisplay.classList.remove('blurred');
  renderPassage(); // Update cursor visibility
  
  state.intervalId = setInterval(() => {
    if (state.mode === 'timed') {
      state.timer--;
      if (state.timer <= 0) {
        endTest();
      }
    } else {
      state.timer++;
    }
    updateTimerDisplay();
    updateStats();
  }, 1000);
}

function handleTyping(e) {
  if (!state.isActive) return;
  
  // Ignore modifier keys
  if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Shift' || e.key === 'CapsLock' || e.key === 'Tab') {
    return;
  }

  // Handle backspace
  if (e.key === 'Backspace') {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      state.charsTyped.pop();
      renderPassage();
    }
    return;
  }

  // Handle printable characters
  if (e.key.length === 1 && state.currentIndex < state.currentPassage.length) {
    state.totalKeystrokes++;
    const expectedChar = state.currentPassage[state.currentIndex];
    const isCorrect = e.key === expectedChar;
    
    if (!isCorrect) {
      state.errors++;
    }
    
    state.charsTyped.push({ char: e.key, isCorrect });
    state.currentIndex++;
    
    renderPassage();
    updateStats();
    
    // Check passage completion
    if (state.currentIndex === state.currentPassage.length && state.mode === 'passage') {
      endTest();
    }
  }
}

function updateTimerDisplay() {
  const timeStr = state.mode === 'timed' ? `${state.timer}s` : `${state.timer}s`;
  elements.currentTime.textContent = timeStr;
}

function calculateWPM() {
  const correctChars = state.charsTyped.filter(c => c.isCorrect).length;
  // Standard WPM calculation: (total characters / 5) / time in minutes
  // We use correctChars to reward accuracy
  const timeInMinutes = state.mode === 'timed' ? (60 - state.timer) / 60 : state.timer / 60;
  
  if (timeInMinutes === 0) return 0;
  
  const wpm = Math.round((correctChars / 5) / timeInMinutes);
  return wpm > 0 ? wpm : 0;
}

function calculateAccuracy() {
  if (state.totalKeystrokes === 0) return 100;
  const correctKeystrokes = state.totalKeystrokes - state.errors;
  const accuracy = Math.round((correctKeystrokes / state.totalKeystrokes) * 100);
  return accuracy > 0 ? accuracy : 0;
}

function updateStats() {
  const wpm = calculateWPM();
  const accuracy = calculateAccuracy();
  
  elements.currentWpm.textContent = wpm;
  elements.currentAccuracy.textContent = `${accuracy}%`;
}

function endTest() {
  clearInterval(state.intervalId);
  state.isActive = false;
  
  const wpm = calculateWPM();
  const accuracy = calculateAccuracy();
  const correctChars = state.charsTyped.filter(c => c.isCorrect).length;
  const incorrectChars = state.totalKeystrokes - state.errors < 0 ? 0 : state.errors;
  
  elements.finalWpm.textContent = wpm;
  elements.finalAccuracy.textContent = `${accuracy}%`;
  elements.finalCharacters.textContent = `${correctChars} / ${incorrectChars}`;
  
  let isNewPB = false;
  let isFirstTest = state.personalBest == 0;

  if (wpm > state.personalBest) {
    state.personalBest = wpm;
    localStorage.setItem('typingSpeedPB', state.personalBest);
    elements.pbWpm.textContent = state.personalBest;
    isNewPB = true;
  }

  // Update Modal Content
  if (isFirstTest) {
    elements.modalTitle.textContent = "Baseline Established!";
    elements.modalSubtitle.textContent = "Great start. Now let's see if you can beat it.";
    elements.modalIcon.src = "./assets/images/icon-new-pb.svg";
  } else if (isNewPB) {
    elements.modalTitle.textContent = "High Score Smashed!";
    elements.modalSubtitle.textContent = "Incredible performance! You set a new personal best.";
    elements.modalIcon.src = "./assets/images/icon-new-pb.svg";
    createConfetti();
  } else {
    elements.modalTitle.textContent = "Test Complete!";
    elements.modalSubtitle.textContent = "Solid run. Keep pushing to beat your high score.";
    elements.modalIcon.src = "./assets/images/icon-completed.svg";
  }

  elements.resultsModal.classList.remove('hidden');
}

function createConfetti() {
  const confettiLayer = document.createElement('div');
  confettiLayer.classList.add('confetti');
  elements.resultsModal.querySelector('.modal-content').appendChild(confettiLayer);
}

// Start
init();
