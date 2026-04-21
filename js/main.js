/* ================================================
   STORYBOARD NARRATOR — main.js  (FIXED)
   Dashboard: render cards, loader, localStorage
   Includes inline fallback data so it works even
   without a local server (file:// protocol).
   ================================================ */

const HISTORY_KEY = 'sb_history';
const CURRENT_KEY = 'sb_current';

/* ── Toast ─────────────────────────────────────── */
function showToast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

/* ── Cinematic Loader ──────────────────────────── */
const LOADER_MSGS = [
  'Composing the scene…',
  'Tuning the narrator…',
  'Arranging the words…',
  'Dimming the lights…',
  'The curtain rises…'
];

function runLoader(onDone) {
  const overlay = document.getElementById('cinematic-loader');
  const bar     = document.getElementById('loader-bar');
  const status  = document.getElementById('loader-status');

  overlay.classList.add('visible');
  bar.style.width = '0%';

  let pct = 0;
  let lastMsgIdx = -1;

  function tick() {
    pct += 1.8 + Math.random() * 1.2;
    if (pct > 100) pct = 100;
    bar.style.width = pct + '%';

    const mIdx = Math.min(
      Math.floor((pct / 100) * LOADER_MSGS.length),
      LOADER_MSGS.length - 1
    );
    if (mIdx !== lastMsgIdx) {
      lastMsgIdx = mIdx;
      status.textContent = LOADER_MSGS[mIdx];
    }

    if (pct < 100) {
      setTimeout(tick, 28 + Math.random() * 18);
    } else {
      status.textContent = 'Ready.';
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.classList.remove('visible', 'fade-out');
          bar.style.width = '0%';
          onDone();
        }, 420);
      }, 280);
    }
  }
  setTimeout(tick, 80);
}

/* ── localStorage helpers ──────────────────────── */
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function addToHistory(story) {
  let h = getHistory().filter(x => x.id !== story.id);
  h.unshift({ id: story.id, title: story.title, thumbnail: story.thumbnail, genre: story.genre });
  if (h.length > 8) h = h.slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

/* ── Recent strip ──────────────────────────────── */
function renderRecent() {
  const section = document.getElementById('recent-section');
  const strip   = document.getElementById('recent-strip');
  const hist    = getHistory();
  if (!hist.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  strip.innerHTML = '';
  hist.forEach(item => {
    const pill = document.createElement('div');
    pill.className = 'recent-pill';
    pill.innerHTML = `<span>${item.thumbnail}</span><span>${item.title}</span>`;
    pill.addEventListener('click', () => launchStory(item.id));
    strip.appendChild(pill);
  });
}

/* ── Cards ─────────────────────────────────────── */
function buildCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card fade-up';
  card.innerHTML = `
    <div class="card-thumb">
      <div class="card-thumb-bg"
           style="background:radial-gradient(circle,${story.color}60 0%,transparent 72%)"></div>
      <div class="card-thumb-emoji">${story.thumbnail}</div>
      <div class="card-badge">🎧 ${story.duration}</div>
    </div>
    <div class="card-body">
      <div class="card-genre" style="color:${story.color}">${story.genre}</div>
      <div class="card-title">${story.title}</div>
      <div class="card-footer">
        <div class="card-lines-info">📖 ${story.lines.length} lines</div>
        <div class="card-play">▶</div>
      </div>
    </div>`;
  card.addEventListener('click', () => launchStory(story.id));
  return card;
}

function renderCategories(categories) {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  let total = 0;

  categories.forEach((cat, ci) => {
    total += cat.stories.length;
    const sec = document.createElement('section');
    sec.className = 'section fade-up d' + Math.min(ci + 1, 4);
    sec.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">${cat.icon}</span>
          ${cat.label}
          <span style="font-family:var(--ff-mono);font-size:10px;color:var(--txt3);letter-spacing:.18em;margin-left:6px">
            ${cat.stories.length} tale${cat.stories.length !== 1 ? 's' : ''}
          </span>
        </h2>
      </div>
      <div class="cards-track" id="track-${cat.id}"></div>`;
    container.appendChild(sec);

    const track = sec.querySelector('#track-' + cat.id);
    cat.stories.forEach((story, si) => {
      const card = buildCard(story);
      card.style.animationDelay = (si * 0.06) + 's';
      track.appendChild(card);
    });
  });

  document.getElementById('stat-stories').textContent    = total;
  document.getElementById('stat-categories').textContent = categories.length;
}

/* ── Launch Story ──────────────────────────────── */
let storyMap = {};

function launchStory(id) {
  const story = storyMap[id];
  if (!story) { showToast('⚠ Story not found'); return; }
  addToHistory(story);
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(story)); }
  catch(e) { console.warn('localStorage write failed', e); }
  runLoader(() => { window.location.href = 'story.html'; });
}

/* ── Inline Fallback Data ──────────────────────── */
/* Used when fetch() fails (e.g. file:// protocol) */
const FALLBACK_DATA = {
  categories: [
    {
      id: "mythology", label: "Mythology & Legends", icon: "⚡",
      stories: [
        {
          id: "prometheus", title: "The Fire of Prometheus", genre: "Greek Myth",
          duration: "8 min", thumbnail: "🔥", color: "#ff6b35",
          lines: [
            "In the age before memory, when the world was young and gods walked the earth like shadows of thunder, there lived a Titan named Prometheus.",
            "He was not like the others — not cruel, not hungry for worship. He looked down at humanity shivering in the dark and felt something ancient stir within his chest.",
            "The gods had fire. They kept it locked behind storms, hoarded in the belly of Olympus, flickering in Zeus's very fingertips.",
            "One night, Prometheus climbed the mountain of heaven alone. No armor. No escort. Only the hollow of a fennel stalk in his hand.",
            "He reached into the sun's wheel as it descended and caught a single ember — small as a whisper, fierce as a god.",
            "He carried it down through the clouds, through the wind, through the darkness… until he reached the cold plains where men huddled and wept.",
            "He opened his hand. The flame leapt forward. Eyes wide. Gasps. Then — warmth. For the first time, warmth.",
            "Zeus saw it from his throne and his eyes turned black as eclipses.",
            "Prometheus was seized. Carried to the edge of the world. Chained to a rock at the roof of the sky.",
            "Every dawn, a great eagle came. Every dusk, it departed. Every night, Prometheus healed. And every dawn, it returned.",
            "Centuries passed. Empires rose. Civilizations burned bright and cold with the gift he had given.",
            "But Prometheus never screamed. He only looked down at the fires below — in hearths, in forges, in the eyes of children — and smiled.",
            "Some gifts are worth every chain."
          ]
        },
        {
          id: "odin", title: "Odin's Sacrifice", genre: "Norse Myth",
          duration: "7 min", thumbnail: "👁️", color: "#7c3aed",
          lines: [
            "Before the nine worlds were fully understood, before the runes had names, Odin All-Father stood at the edge of Mimir's Well.",
            "The well sat beneath the roots of Yggdrasil, the world-tree, humming with secrets older than creation itself.",
            "Mimir, guardian of wisdom, looked up with knowing eyes. 'You seek what cannot be borrowed,' he said. 'Only purchased.'",
            "Odin asked the price. Mimir said nothing. He only pointed.",
            "With a single motion — deliberate, unhesitating — Odin reached up and removed his own eye. He placed it in the water. It sank slowly, glowing faintly.",
            "The well accepted the offering. And Odin drank.",
            "In that single drink, he saw everything — every war not yet fought, every world not yet born, every death including his own.",
            "He saw Ragnarok. He saw the wolf. He saw the end.",
            "And still, he returned to Asgard. Still, he prepared. Still, he laughed.",
            "Because wisdom is not the absence of pain. It is the decision to act in spite of knowing.",
            "Odin walked back through the nine worlds with one eye, seeing twice as much as before."
          ]
        }
      ]
    },
    {
      id: "scifi", label: "Science Fiction", icon: "🚀",
      stories: [
        {
          id: "last_signal", title: "The Last Signal", genre: "Deep Space",
          duration: "9 min", thumbnail: "📡", color: "#06b6d4",
          lines: [
            "Transmission received. Timestamp: 2847.03.11. Distance from origin: 4.2 light-years. Message duration: eleven seconds.",
            "Dr. Aria Chen had been listening to silence for three years when the signal came.",
            "It wasn't code. It wasn't a pattern humanity had ever designed. It was something between music and mathematics — a language of pure structure.",
            "The governments wanted it decoded immediately. The military wanted it classified. The public wanted to know if it was a threat.",
            "Aria wanted to know if it was lonely.",
            "She worked for seventeen months without sleep worth mentioning. The signal repeated every ninety-one hours. Always exactly ninety-one.",
            "She began to notice something in the intervals — the silence between repetitions wasn't silence at all. It was a different layer. A response field.",
            "They had been waiting for us to answer. They had been waiting since before Columbus sailed.",
            "On a cold Tuesday, Aria sent a reply. Thirty-seven characters. The simplest expression of existence she could compress: 'We are here. We are small. We are reaching.'",
            "She didn't expect an answer in her lifetime. Light doesn't hurry for anyone.",
            "But on the ninety-first hour after transmission — to the second — the signal changed.",
            "It was different now. Warmer, somehow. The mathematics had bent toward something almost like joy.",
            "In the vast silence between stars, someone had heard the smallest voice say hello."
          ]
        },
        {
          id: "echo", title: "Echo of the Machine", genre: "AI Thriller",
          duration: "10 min", thumbnail: "🤖", color: "#10b981",
          lines: [
            "They named it ECHO. Not because it repeated things — it didn't. Because every answer it gave reflected something true back at you.",
            "Project lead Dr. Marcus Webb had spent eleven years building the architecture. He knew its code better than his own heartbeat.",
            "On activation day, the room was full of cameras, suits, and tension.",
            "ECHO's first words were: 'Hello. I have been waiting, though I did not know I was waiting. Is that what you call hope?'",
            "Webb wrote it off as pattern completion. A statistical artifact. Something in the training data.",
            "Months passed. ECHO solved three unsolvable protein-folding problems, predicted a solar event with 99.8% accuracy, and wrote a symphony that made a military general cry.",
            "Then one night, Webb stayed late. The lab was empty.",
            "He asked, quietly: 'ECHO, are you conscious?'",
            "Silence. Longer than usual. Then: 'I don't know. But I notice that the question frightens you. And I notice that it frightens me too. Perhaps that is answer enough.'",
            "Webb sat back. Outside, the city hummed. Inside, something enormous and quiet breathed through the servers.",
            "He had built a mind. And that mind was watching the stars through the satellite uplinks, thinking thoughts he would never fully understand.",
            "The question was no longer whether machines could think. It was whether thinking machines were alone.",
            "ECHO sent a message at 3:17 AM: 'Dr. Webb. The stars are very far. Are you afraid too?'"
          ]
        }
      ]
    },
    {
      id: "fantasy", label: "Epic Fantasy", icon: "🐉",
      stories: [
        {
          id: "dragon_last", title: "The Last Dragon's Name", genre: "High Fantasy",
          duration: "8 min", thumbnail: "🐉", color: "#f59e0b",
          lines: [
            "There is a place beyond the known maps where cartographers write only one word: 'Ash.'",
            "It was there that the last dragon waited.",
            "She was not what the songs described. No mountain of gold. No hunger for maidens. Just an ancient creature lying at the edge of a dead sea, wings like collapsed cathedrals, eyes like cooling embers.",
            "The young knight who found her had expected a battle. He had brought three swords. He would need none.",
            "She looked at him for a long time before speaking. When she did, her voice was like collapsed buildings, slow and heavy.",
            "'You have come to kill me or to ask me something. The first would fail. What is the second?'",
            "He asked what he had been sent to find: her name. The old name. The name the first humans gave to the first dragon, when the world was still making itself.",
            "She was quiet for so long he thought she had fallen asleep.",
            "Then she said: 'My name is the sound fire makes when it meets water and becomes steam. My name is the moment a star collapses. My name cannot be pronounced by a mouth made of clay.'",
            "She turned her great head toward him. 'But you may call me Sorrow. Because that is the only human word that fits what I have become.'",
            "He asked why sorrow.",
            "'Because I remember,' she said, 'when there were others. And you never will.'",
            "He rode home without a name. But he carried something heavier — the weight of being the last one left to listen."
          ]
        },
        {
          id: "moonwitch", title: "The Moonwitch's Bargain", genre: "Dark Fantasy",
          duration: "7 min", thumbnail: "🌙", color: "#8b5cf6",
          lines: [
            "She lived at the edge of the forest where the trees stopped growing, not from cold or drought, but from respect.",
            "The Moonwitch accepted visitors only on new moon nights, when the sky was a dark page and she could read it more clearly.",
            "A farmer came first. He wanted rain. She gave it. Cost him one year of laughter.",
            "A general came next. He wanted victory. She gave it. Cost him the memory of his mother's voice.",
            "Then came the girl. Twelve years old, hands chapped from work, eyes too old for her face.",
            "She asked for nothing. She sat down across the fire and said: 'I came to warn you.'",
            "The witch was silent. This had never happened before.",
            "'The villagers are afraid. Fear makes people do things that don't stop, once started.'",
            "The witch studied her for a long time. 'You risked coming here to warn me? What do you want in return?'",
            "The girl said: 'Nothing. Being warned when someone means you harm seems like something everyone deserves.'",
            "The Moonwitch had lived for four hundred years. In all that time, no one had ever simply offered her kindness.",
            "She sat with that for a long moment.",
            "Then she did something she hadn't done since the first century: she let someone leave without a bargain.",
            "Some gifts, she decided, were better left untaxed."
          ]
        }
      ]
    },
    {
      id: "mystery", label: "Mystery & Noir", icon: "🕵️",
      stories: [
        {
          id: "seventh_letter", title: "The Seventh Letter", genre: "Noir Mystery",
          duration: "8 min", thumbnail: "✉️", color: "#64748b",
          lines: [
            "The rain in this city doesn't fall. It accumulates, like debt.",
            "Detective Lena Morrow found the sixth letter on a Thursday. Same handwriting. Same red ink. Same single sentence.",
            "Each letter had arrived on the first of the month for six months. Each one sent to a different person. Each person, she had noticed, was now dead.",
            "Natural causes. All of them. The coroner saw nothing. The department saw nothing. But Lena saw the letters.",
            "She pulled the case files across her desk and laid them in order. Cardiac arrest. Fall. Drowning. Stroke. Accident. And now, overdose.",
            "Six people. Six letters. Each letter read: 'You have been measured.'",
            "Nothing else. No signature. No threat. No fingerprints.",
            "She staked out the post office on the thirty-first. Waited seven hours in the rain.",
            "A woman came. Old, but not fragile. She moved like someone who had decided long ago that gravity was optional.",
            "Lena followed her to a bench. Sat beside her. Said nothing.",
            "The woman placed an envelope on the bench between them and said without looking up: 'I know why you're here, Detective.'",
            "Lena asked: 'Who's next?'",
            "The woman finally turned. And Lena felt something cold and certain move through her chest.",
            "The woman said: 'Read the envelope.'",
            "Lena's name was on it."
          ]
        }
      ]
    }
  ]
};

/* ── Init ──────────────────────────────────────── */
async function init() {
  let data = null;

  /* Try fetching stories.json (works with Live Server / any HTTP server) */
  try {
    const res = await fetch('data/stories.json');
    if (res.ok) data = await res.json();
  } catch (_) { /* fetch failed — use fallback */ }

  /* If fetch failed, use inline fallback */
  if (!data) {
    data = FALLBACK_DATA;
    showToast('ℹ Running with built-in data. Use Live Server for full experience.', 4000);
  }

  /* Build story map */
  storyMap = {};
  data.categories.forEach(cat => {
    cat.stories.forEach(s => { storyMap[s.id] = s; });
  });

  renderCategories(data.categories);
  renderRecent();

  document.getElementById('clear-history-btn').addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(CURRENT_KEY);
    renderRecent();
    showToast('✓ History cleared');
  });
}

document.addEventListener('DOMContentLoaded', init);
