/**
 * Organic Chemistry Reaction Mechanism LLM Wiki & Learning Hub
 * assets/app.js — Core Interactive Functionality
 * Grounded in AGENTS.md, wiki/sn1.md, wiki/sn2.md, wiki/e1.md, wiki/e2.md
 */

// ==========================================================================
// 1. Theme Management (Light / Dark Mode)
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('ochem_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ochem_theme', newTheme);
  updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}

// ==========================================================================
// 2. Search Functionality (index.html)
// ==========================================================================

let mechanismsCache = null;

async function loadMechanismsData() {
  if (mechanismsCache) return mechanismsCache;
  try {
    const basePath = window.location.pathname.includes('/pages/') ? '../data/mechanisms.json' : 'data/mechanisms.json';
    const res = await fetch(basePath);
    mechanismsCache = await res.json();
    return mechanismsCache;
  } catch (err) {
    console.warn('Using inline fallback mechanism data:', err);
    mechanismsCache = [
      { id: "sn1", name: "SN1", fullName: "Unimolecular Nucleophilic Substitution", summary: "Two-step substitution via carbocation. Favors 3° substrates, weak nucleophiles, polar protic solvents. Gives racemization.", url: "pages/sn1.html", source: "wiki/sn1.md" },
      { id: "sn2", name: "SN2", fullName: "Bimolecular Nucleophilic Substitution", summary: "One-step concerted backside attack. Favors methyl/1° substrates, strong nucleophiles, polar aprotic solvents. Complete Walden inversion.", url: "pages/sn2.html", source: "wiki/sn2.md" },
      { id: "e1", name: "E1", fullName: "Unimolecular Elimination", summary: "Two-step elimination sharing carbocation with SN1. Weak base, polar protic, high temperature (heat). Zaitsev alkene product.", url: "pages/e1.html", source: "wiki/e1.md" },
      { id: "e2", name: "E2", fullName: "Bimolecular Elimination", summary: "Concerted elimination requiring anti-periplanar 180° geometry. Strong base. Zaitsev (small base) or Hofmann (bulky base).", url: "pages/e2.html", source: "wiki/e2.md" }
    ];
    return mechanismsCache;
  }
}

function initSearch() {
  const searchInput = document.getElementById('search-input');
  const dropdown = document.getElementById('search-results');
  if (!searchInput) return;

  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      if (dropdown) dropdown.style.display = 'none';
      filterCards('');
      return;
    }

    const data = await loadMechanismsData();
    const matches = data.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.fullName.toLowerCase().includes(query) ||
      m.summary.toLowerCase().includes(query)
    );

    filterCards(query);

    if (dropdown) {
      if (matches.length === 0) {
        dropdown.innerHTML = `<div style="padding: 0.85rem 1.25rem; color: var(--text-muted); font-size: 0.85rem;">No mechanisms found for "${query}".</div>`;
        dropdown.style.display = 'block';
      } else {
        dropdown.innerHTML = matches.map(m => {
          const pageUrl = window.location.pathname.includes('/pages/') ? m.url.replace('pages/', '') : m.url;
          return `
            <a href="${pageUrl}" class="search-result-item">
              <div class="item-title">${m.name} &mdash; ${m.fullName}</div>
              <div class="item-desc">${m.summary}</div>
            </a>
          `;
        }).join('');
        dropdown.style.display = 'block';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (dropdown && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function filterCards(query) {
  const cards = document.querySelectorAll('.mechanism-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (!query || text.includes(query)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// ==========================================================================
// 3. Reaction Mechanism Predictor (pages/predictor.html)
// ==========================================================================

function predictReaction(substrate, reagent, solvent, temperature) {
  // Grounded strictly in wiki/sn1.md, wiki/sn2.md, wiki/e1.md, wiki/e2.md
  let primary = "";
  let competing = "None";
  let stereochem = "";
  let regiochem = "N/A";
  let explanation = "";
  let source = "";

  if (substrate === "methyl") {
    if (reagent.startsWith("strong")) {
      primary = "SN2";
      stereochem = "Achiral starting material; 100% inversion geometry";
      explanation = "Methyl substrates are unhindered with no β-hydrogens for elimination and cannot form methyl carbocations. A strong nucleophile forces S_N2 exclusively.";
      source = "wiki/sn2.md";
    } else {
      primary = "No Reaction";
      explanation = "Methyl carbocations are too high in energy to form (ruling out S_N1/E1), and weak nucleophiles are too sluggish to displace leaving groups on methyl without activation.";
      source = "wiki/sn1.md";
    }
  } 
  else if (substrate === "primary") {
    if (reagent === "strong_base_bulky") {
      primary = "E2";
      competing = "Minor S_N2";
      regiochem = "Hofmann Product (less substituted alkene)";
      stereochem = "Anti-periplanar (180° dihedral angle required)";
      explanation = "Bulky sterically hindered bases (such as KOtBu or DBU) cannot access the electrophilic carbon for backside attack, steering even primary substrates into E2 elimination to give the Hofmann product.";
      source = "wiki/e2.md";
    } else if (reagent.startsWith("strong")) {
      primary = "SN2";
      competing = reagent === "strong_base_small" ? "Minor E2" : "None";
      stereochem = "100% Walden Inversion";
      explanation = "Primary substrates experience minimal steric hindrance. Strong nucleophiles attack rapidly from the backside (180°) in a single concerted step, outcompeting elimination.";
      source = "wiki/sn2.md";
    } else {
      primary = "No Reaction (Extremely Slow)";
      explanation = "Primary carbocations are too unstable to undergo S_N1 or E1. Weak nucleophiles lack the driving force to achieve bimolecular displacement at practical rates.";
      source = "wiki/sn1.md";
    }
  } 
  else if (substrate === "secondary") {
    if (reagent === "strong_base_bulky") {
      primary = "E2";
      regiochem = "Hofmann Product (less substituted alkene)";
      stereochem = "Anti-periplanar geometry (180° dihedral angle)";
      explanation = "Secondary substrates readily undergo E2 when exposed to strong bases. Bulky bases (KOtBu, LDA) abstract the less hindered terminal β-hydrogen, favoring the Hofmann product.";
      source = "wiki/e2.md";
    } else if (reagent === "strong_base_small") {
      primary = "E2";
      competing = "S_N2";
      regiochem = "Zaitsev Product (more substituted alkene)";
      stereochem = "Anti-periplanar requirement";
      explanation = "Secondary substrates treated with strong unhindered bases (such as NaOH or NaOEt) undergo both E2 and S_N2. Higher temperature and steric demand shift the predominant pathway to E2 (Zaitsev alkene).";
      source = "wiki/e2.md";
    } else if (reagent === "strong_nuc_weak_base") {
      primary = "SN2";
      competing = "Very minor E2";
      stereochem = "100% Walden Inversion";
      explanation = "Species that are excellent nucleophiles but weak conjugate bases (I⁻, RS⁻, CN⁻, N₃⁻) perform backside displacement without initiating elimination. Polar aprotic solvents strongly enhance this pathway.";
      source = "wiki/sn2.md";
    } else {
      // Weak nucleophile / weak base (H2O, ROH)
      if (temperature === "high") {
        primary = "E1";
        competing = "S_N1";
        regiochem = "Zaitsev Product";
        stereochem = "Non-stereospecific (mixture of E and Z isomers, E major)";
        explanation = "Secondary substrates can ionize into a secondary carbocation in polar protic solvents. Elevated temperature (heat / reflux) favors elimination (E1) over substitution (S_N1) due to positive reaction entropy (ΔS° > 0).";
        source = "wiki/e1.md";
      } else {
        primary = "SN1";
        competing = "E1";
        stereochem = "Racemization (with slight excess of inversion due to ion-pair shielding)";
        explanation = "Secondary substrates ionize into a carbocation in polar protic solvent. At lower temperatures, nucleophilic capture (S_N1) dominates over elimination, giving racemization.";
        source = "wiki/sn1.md";
      }
    }
  } 
  else if (substrate === "tertiary") {
    if (reagent.startsWith("strong")) {
      primary = "E2";
      stereochem = "Strictly anti-periplanar (trans-diaxial in cyclohexanes)";
      regiochem = reagent === "strong_base_bulky" ? "Hofmann Product (less substituted)" : "Zaitsev Product (more substituted)";
      explanation = "Backside attack is completely blocked by the three bulky alkyl groups (S_N2 rate = 0). Treatment with any strong base exclusively yields E2 elimination.";
      source = "wiki/e2.md";
    } else {
      // Weak nucleophile / weak base (solvolysis)
      if (temperature === "high") {
        primary = "E1";
        competing = "S_N1";
        regiochem = "Zaitsev Product (more substituted alkene)";
        stereochem = "Non-stereospecific (E/Z mixture)";
        explanation = "Tertiary substrates readily ionize to form stable 3° carbocations. At high temperatures (reflux), deprotonation by the weak solvent base dominates, yielding the Zaitsev E1 alkene.";
        source = "wiki/e1.md";
      } else {
        primary = "SN1";
        competing = "E1 (minor)";
        stereochem = "Racemization (± slight inversion excess from ion-pair effect)";
        explanation = "Tertiary substrates ionize readily (slow RDS). At moderate temperatures, the planar carbocation is trapped by the weak nucleophile from both faces, producing a racemic mixture.";
        source = "wiki/sn1.md";
      }
    }
  }

  return { primary, competing, stereochem, regiochem, explanation, source };
}

// ==========================================================================
// 4. Interactive Quiz Engine (pages/quiz.html)
// ==========================================================================

let allQuestions = [];
let userAnswers = {};

async function initQuiz() {
  const container = document.getElementById('quiz-questions-container');
  if (!container) return;

  try {
    const res = await fetch('../data/questions.json');
    allQuestions = await res.json();
  } catch (err) {
    console.warn('Could not load data/questions.json via fetch, using fallback data:', err);
    allQuestions = getFallbackQuestions();
  }

  renderQuiz('all');
}

function renderQuiz(filterMechanism) {
  const container = document.getElementById('quiz-questions-container');
  if (!container) return;

  const filtered = filterMechanism === 'all' 
    ? allQuestions 
    : allQuestions.filter(q => q.mechanism === filterMechanism);

  container.innerHTML = filtered.map((q, idx) => {
    const qId = `${q.mechanism}_${idx}`;
    return `
      <div class="quiz-card" id="card_${qId}" data-mechanism="${q.mechanism}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span class="type-pill ${q.mechanism}">${q.mechanism.toUpperCase()}</span>
          <span style="font-size: 0.8rem; color: var(--text-subtle);">Question ${idx + 1} of ${filtered.length}</span>
        </div>
        <div class="question-text">${q.question}</div>
        <div class="quiz-options">
          ${q.options.map((opt, optIdx) => `
            <button type="button" class="quiz-opt-btn" onclick="handleQuizAnswer('${qId}', ${optIdx}, ${q.answer})">
              ${String.fromCharCode(65 + optIdx)}. ${opt}
            </button>
          `).join('')}
        </div>
        <div class="quiz-explanation" id="exp_${qId}">
          <strong>Explanation:</strong> ${q.explanation}
          <div style="margin-top: 0.35rem; font-size: 0.8rem; color: var(--primary);">
            📖 Source: <code>${q.source}</code>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateScoreDisplay();
}

function handleQuizAnswer(qId, selectedIdx, correctIdx) {
  if (userAnswers[qId] !== undefined) return; // Already answered
  userAnswers[qId] = { selected: selectedIdx, correct: correctIdx };

  const card = document.getElementById(`card_${qId}`);
  const buttons = card.querySelectorAll('.quiz-opt-btn');

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIdx) {
      btn.classList.add('correct');
    } else if (idx === selectedIdx) {
      btn.classList.add('incorrect');
    }
  });

  const expBox = document.getElementById(`exp_${qId}`);
  if (expBox) expBox.style.display = 'block';

  updateScoreDisplay();
}

function updateScoreDisplay() {
  const scoreText = document.getElementById('score-text');
  const progressBar = document.getElementById('score-bar');
  if (!scoreText) return;

  const answeredKeys = Object.keys(userAnswers);
  const correctCount = answeredKeys.filter(k => userAnswers[k].selected === userAnswers[k].correct).length;
  const total = allQuestions.length || 20;

  scoreText.innerHTML = `Score: <strong>${correctCount}</strong> / ${answeredKeys.length} answered (Total questions: ${total})`;
  if (progressBar) {
    const pct = Math.round((answeredKeys.length / total) * 100);
    progressBar.style.width = `${pct}%`;
  }
}

// Fallback questions if running offline or on strict local file origins
function getFallbackQuestions() {
  return [
    { mechanism: "sn1", question: "What is the rate law for an SN1 reaction?", options: ["Rate = k[substrate]", "Rate = k[substrate][Nu]", "Rate = k[Nu]", "Rate = k[substrate]²"], answer: 0, explanation: "Unimolecular rate-determining ionization.", source: "wiki/sn1.md" },
    { mechanism: "sn2", question: "What is the stereochemical outcome of an SN2 reaction?", options: ["Racemization", "100% Inversion (Walden)", "Retention", "Diastereomers"], answer: 1, explanation: "Backside attack inverts the umbrella.", source: "wiki/sn2.md" },
    { mechanism: "e1", question: "Which alkene product does Zaitsev's rule favor?", options: ["The terminal alkene", "The more substituted alkene", "The cis-alkene exclusively", "The less stable alkene"], answer: 1, explanation: "More substituted alkene is more thermodynamically stable.", source: "wiki/e1.md" },
    { mechanism: "e2", question: "What geometric conformation is required for an E2 elimination?", options: ["Anti-periplanar (180°)", "Syn-periplanar (0°)", "Gauche (60°)", "Perpendicular (90°)"], answer: 0, explanation: "180° dihedral angle allows maximum orbital overlap.", source: "wiki/e2.md" }
  ];
}

// ==========================================================================
// 5. Comparison Tool (pages/compare.html)
// ==========================================================================

async function renderComparison() {
  const m1Select = document.getElementById('mech-1-select');
  const m2Select = document.getElementById('mech-2-select');
  const container = document.getElementById('comparison-output');
  if (!m1Select || !m2Select || !container) return;

  const data = await loadMechanismsData();
  const m1 = data.find(m => m.id === m1Select.value);
  const m2 = data.find(m => m.id === m2Select.value);

  if (!m1 || !m2) return;

  const rows = [
    { label: "Full Name", key: "fullName" },
    { label: "Molecularity", key: "molecularity" },
    { label: "Rate Law", key: "rateLaw" },
    { label: "Steps", key: "steps" },
    { label: "Intermediate", key: "intermediate" },
    { label: "Stereochemistry", key: "stereochemistry" },
    { label: "Regiochemistry", key: "regiochemistry" },
    { label: "Rearrangements?", key: "rearrangements" },
    { label: "Substrate Reactivity", key: "substrateReactivity" },
    { label: "Reagent Needed", key: "nucleophileRequirement" },
    { label: "Preferred Solvent", key: "solvent" },
    { label: "Temperature", key: "temperature" },
    { label: "Energy Diagram Profile", key: "energyProfile" },
    { label: "Grounded Source", key: "source" }
  ];

  container.innerHTML = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Chemical Property</th>
          <th style="color: var(--${m1.id}-color); font-size: 1.1rem;">${m1.name} (${m1.display})</th>
          <th style="color: var(--${m2.id}-color); font-size: 1.1rem;">${m2.name} (${m2.display})</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td>${m1[r.key]}</td>
            <td>${m2[r.key]}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==========================================================================
// Global Lifecycle
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSearch();
});
