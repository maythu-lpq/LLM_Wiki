/**
 * Organic Chemistry Reaction Mechanism LLM Wiki & Learning Hub
 * assets/chat.js — Section 8 Q&A Chatbot Engine
 * Mode A: Client-side RAG over wiki/*.md files
 * Grounded in AGENTS.md (Section 8)
 */

let wikiChunks = [];
let isWikiLoaded = false;
let isIndexing = false;

// Determine path prefixes based on page location
function getPathPrefix() {
  return window.location.pathname.includes('/pages/') ? '../' : './';
}

/**
 * 1. Auto-discover and parse all wiki files from wiki/index.md
 */
async function loadWikiKnowledgeBase() {
  if (isWikiLoaded || isIndexing) return;
  isIndexing = true;
  updateChatStatus('Indexing wiki knowledge base...', 'loading');

  const prefix = getPathPrefix();
  const indexUrl = `${prefix}wiki/index.md`;

  try {
    const res = await fetch(indexUrl);
    if (!res.ok) throw new Error(`Could not fetch ${indexUrl}`);
    const indexText = await res.text();

    // Extract all [label](filename.md) links from index.md
    const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    const fileSet = new Set();
    let match;
    while ((match = linkRegex.exec(indexText)) !== null) {
      const fileName = match[2].trim();
      if (!fileName.startsWith('http') && fileName.endsWith('.md')) {
        fileSet.add(fileName.replace(/^\.?\//, ''));
      }
    }

    // Always ensure core mechanisms and index are included
    ['sn1.md', 'sn2.md', 'e1.md', 'e2.md', 'index.md'].forEach(f => fileSet.add(f));

    wikiChunks = [];

    // Fetch and chunk each markdown file
    for (const fileName of fileSet) {
      const fileUrl = `${prefix}wiki/${fileName}`;
      try {
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) continue;
        const markdown = await fileRes.text();
        const chunks = parseMarkdownChunks(fileName, markdown);
        wikiChunks.push(...chunks);
      } catch (err) {
        console.warn(`Could not load wiki file ${fileName}:`, err);
      }
    }

    isWikiLoaded = true;
    isIndexing = false;
    updateChatStatus(`Knowledge base active (${wikiChunks.length} chunks indexed)`, 'ready');
  } catch (err) {
    console.error('Failed to load wiki knowledge base:', err);
    isIndexing = false;
    updateChatStatus('Error indexing wiki. Running with fallback.', 'error');
  }
}

/**
 * 2. Split markdown by '## ' headings into distinct topical chunks
 */
function parseMarkdownChunks(fileName, text) {
  const chunks = [];
  const mechId = fileName.replace('.md', '').toLowerCase();
  const pageUrl = mechId === 'index' ? '../index.html' : `${mechId}.html`;

  // Split by ## headings
  const sections = text.split(/\n(?=##\s+)/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    let heading = 'General Overview';
    let body = trimmed;

    if (trimmed.startsWith('## ')) {
      const firstLineEnd = trimmed.indexOf('\n');
      if (firstLineEnd !== -1) {
        heading = trimmed.substring(3, firstLineEnd).trim();
        body = trimmed.substring(firstLineEnd).trim();
      } else {
        heading = trimmed.substring(3).trim();
        body = '';
      }
    } else if (trimmed.startsWith('# ')) {
      const firstLineEnd = trimmed.indexOf('\n');
      if (firstLineEnd !== -1) {
        heading = trimmed.substring(2, firstLineEnd).trim();
        body = trimmed.substring(firstLineEnd).trim();
      }
    }

    if (!body && !heading) continue;

    // Tokenize text for ranking
    const combinedText = `${heading} ${body}`.toLowerCase();
    const tokens = tokenize(combinedText);

    chunks.push({
      fileName: fileName,
      sourceDisplay: `wiki/${fileName}`,
      heading: heading,
      mechId: mechId,
      pageUrl: pageUrl,
      rawContent: body,
      tokens: tokens,
      text: combinedText
    });
  }

  return chunks;
}

/**
 * 3. Text Tokenizer and Stopwords Filter
 */
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should', 'so', 'some', 
  'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function tokenize(text) {
  const words = text
    .replace(/[^\w\s\u00C0-\u017F°⁺⁻¹²³–—\-\/]/g, ' ')
    .toLowerCase()
    .split(/\s+/);
  
  const tokens = [];
  for (const w of words) {
    const clean = w.replace(/^[-_]+|[-_]+$/g, '');
    if (clean.length >= 2 && !STOPWORDS.has(clean)) {
      tokens.push(clean);
    }
  }
  return tokens;
}

/**
 * 4. Keyword Ranking Engine (Mode A)
 */
function rankChunks(query) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const qLower = query.toLowerCase();
  
  // Detect targeted mechanism mentions in query
  const mentionsSn1 = /\bsn1\b|\bs_n1\b|\bunimolecular substitution\b/i.test(qLower);
  const mentionsSn2 = /\bsn2\b|\bs_n2\b|\bbimolecular substitution\b/i.test(qLower);
  const mentionsE1  = /\be1\b|\bunimolecular elimination\b/i.test(qLower);
  const mentionsE2  = /\be2\b|\bbimolecular elimination\b/i.test(qLower);

  const scored = [];

  for (const chunk of wikiChunks) {
    let score = 0;
    const headingLower = chunk.heading.toLowerCase();

    // Mechanism matching boost
    if (mentionsSn1 && chunk.mechId === 'sn1') score += 15;
    if (mentionsSn2 && chunk.mechId === 'sn2') score += 15;
    if (mentionsE1  && chunk.mechId === 'e1')  score += 15;
    if (mentionsE2  && chunk.mechId === 'e2')  score += 15;

    // Direct phrase matching
    if (qLower.length > 5 && chunk.text.includes(qLower)) {
      score += 25;
    }

    // Token frequency & heading weighting
    for (const token of queryTokens) {
      if (headingLower.includes(token)) {
        score += 8;
      }
      
      let count = 0;
      for (const t of chunk.tokens) {
        if (t === token || t.startsWith(token) || token.startsWith(t)) {
          count++;
        }
      }
      if (count > 0) {
        // Log-damped term frequency
        score += (1 + Math.log(count)) * 2;
      }
    }

    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 5. Formatting Markdown to Clean HTML
 */
function markdownToHtml(md) {
  if (!md) return '';

  let html = md
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Restore safe sub/sup if they were written
    .replace(/&lt;sub&gt;/gi, '<sub>')
    .replace(/&lt;\/sub&gt;/gi, '</sub>')
    .replace(/&lt;sup&gt;/gi, '<sup>')
    .replace(/&lt;\/sup&gt;/gi, '</sup>')

    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')

    // Bold & italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // Headings (### and ####)
    .replace(/^####\s+(.+)$/gm, '<h5 style="margin: 0.5rem 0; color: var(--primary);">$1</h5>')
    .replace(/^###\s+(.+)$/gm, '<h4 style="margin: 0.75rem 0 0.25rem; color: var(--primary);">$1</h4>')

    // Blockquotes
    .replace(/^>\s+(.+)$/gm, '<blockquote class="chat-quote">$1</blockquote>')

    // Markdown tables (simple conversion)
    .replace(/\|(.+)\|/g, function(match) {
      if (match.includes('---')) return '';
      const cells = match.split('|').slice(1, -1);
      const isHeader = false;
      const tdList = cells.map(c => `<td style="padding: 4px 8px; border: 1px solid var(--border); font-size: 0.85rem;">${c.trim()}</td>`).join('');
      return `<tr>${tdList}</tr>`;
    });

  // Wrap tables
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, '<table style="width: 100%; border-collapse: collapse; margin: 0.75rem 0;">$1</table>');

  // Convert bullet lists
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="padding-left: 1.25rem; margin: 0.5rem 0;">$1</ul>');

  // Convert clean paragraphs
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<') && (p.startsWith('<pre') || p.startsWith('<table') || p.startsWith('<blockquote') || p.startsWith('<h') || p.startsWith('<ul'))) {
      return p;
    }
    return `<p style="margin-bottom: 0.6rem; line-height: 1.6;">${p}</p>`;
  }).join('');

  return html;
}

/**
 * 6. Generate Answer from User Question
 */
async function answerQuestion(query) {
  if (!isWikiLoaded) {
    await loadWikiKnowledgeBase();
  }

  const trimmed = query.trim();
  if (!trimmed) return;

  // Add User Message to Chat UI
  appendMessage(trimmed, 'user');
  clearInput();

  // Show Typing Indicator
  const typingId = showTypingIndicator();

  // Search Knowledge Base Chunks
  setTimeout(() => {
    removeTypingIndicator(typingId);

    const scoredResults = rankChunks(trimmed);
    const topResult = scoredResults[0];

    // Check if matching chunks were found with reasonable relevance
    const MIN_SCORE_THRESHOLD = 5;

    if (!topResult || topResult.score < MIN_SCORE_THRESHOLD) {
      // Suggest fallback file based on query context
      const qLower = trimmed.toLowerCase();
      let suggestedFile = 'index.md';
      if (qLower.includes('sn1')) suggestedFile = 'sn1.md';
      else if (qLower.includes('sn2')) suggestedFile = 'sn2.md';
      else if (qLower.includes('e1')) suggestedFile = 'e1.md';
      else if (qLower.includes('e2')) suggestedFile = 'e2.md';

      const fallbackMsg = `This is not in the wiki yet. Suggested: add it to <code>wiki/${suggestedFile}</code>.`;
      appendBotResponse(fallbackMsg, null);
      return;
    }

    // Pick top 1 to 3 chunks whose score is at least 40% of the top score
    const topScore = topResult.score;
    const selected = scoredResults
      .filter(item => item.score >= topScore * 0.45)
      .slice(0, 3);

    // Format compound response with citations
    let botHtml = '';
    const citations = [];

    selected.forEach((item, index) => {
      const chunk = item.chunk;
      const citationText = `Source: ${chunk.sourceDisplay} › ${chunk.heading}`;
      citations.push({
        text: citationText,
        url: chunk.pageUrl
      });

      botHtml += `
        <div class="chat-chunk-result" ${index > 0 ? 'style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);"' : ''}>
          <div class="chat-chunk-header" style="font-size: 0.95rem; font-weight: 700; color: var(--primary); margin-bottom: 0.4rem;">
            📌 ${chunk.heading} <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-subtle);">(${chunk.sourceDisplay})</span>
          </div>
          <div class="chat-chunk-body">
            ${markdownToHtml(chunk.rawContent)}
          </div>
          <div class="chat-citation-bar" style="margin-top: 0.6rem; font-size: 0.8rem;">
            <a href="${chunk.pageUrl}" class="source-tag" target="_self">
              📖 ${citationText} &rarr;
            </a>
          </div>
        </div>
      `;
    });

    appendBotResponse(botHtml, citations);
  }, 350);
}

/**
 * 7. Chat UI Helper Functions
 */
function appendMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-${sender}`;

  if (sender === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = text;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendBotResponse(html, citations) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bot';
  bubble.innerHTML = html;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return null;

  const id = 'typing-' + Date.now();
  const typing = document.createElement('div');
  typing.id = id;
  typing.className = 'chat-bubble chat-bot typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';

  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearInput() {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function updateChatStatus(text, statusClass) {
  const statusEl = document.getElementById('chat-status');
  if (statusEl) {
    statusEl.innerHTML = `<strong>Mode A:</strong> ${text}`;
    statusEl.className = `chat-status ${statusClass || ''}`;
  }
}

function askSuggested(questionText) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = questionText;
  }
  answerQuestion(questionText);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadWikiKnowledgeBase();

  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (input && input.value.trim()) {
        answerQuestion(input.value.trim());
      }
    });
  }
});
