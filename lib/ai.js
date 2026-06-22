// Interest-personalized scenario generator.
//
// Given a student's vocabulary word + their interests, this produces a short
// story scenario themed to what they love, with a multiple-choice question that
// drills the word's meaning. When ANTHROPIC_API_KEY is set, scenarios are
// generated fresh by Claude (so they're never repetitive and truly personal);
// otherwise a deterministic template keeps the feature working offline.
//
// We call the Messages API over plain fetch rather than the npm SDK on purpose:
// Word Garden ships with zero install step so it runs anywhere (Codespaces,
// iSH, a bare `node server.js`). Adding @anthropic-ai/sdk would require
// `npm install`. If you later adopt a build step, swap this for the SDK.
import { interestName } from './model.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
// Default per Anthropic guidance; override for cost/latency on a big class via
// WORD_GARDEN_MODEL (e.g. claude-haiku-4-5 or claude-sonnet-4-6).
const MODEL = process.env.WORD_GARDEN_MODEL || 'claude-opus-4-8';

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    setup: { type: 'string' },
    question: { type: 'string' },
    choices: { type: 'array', items: { type: 'string' } },
    answerIndex: { type: 'integer' },
    explanation: { type: 'string' },
  },
  required: ['setup', 'question', 'choices', 'answerIndex', 'explanation'],
};

// Generate a personalized scenario. `siblings` are other definitions from the
// same deck, used as wrong answers in the offline fallback.
export async function generateScenario({ word, definition, example, interest, grade, siblings = [] }) {
  if (aiEnabled()) {
    try {
      return await generateWithClaude({ word, definition, example, interest, grade });
    } catch (err) {
      console.error('Scenario generation via Claude failed, using template:', err.message);
    }
  }
  return templateScenario({ word, definition, interest, siblings });
}

async function generateWithClaude({ word, definition, example, interest, grade }) {
  const theme = interestName(interest);
  const system =
    `You write short, playful vocabulary practice scenarios for ${grade}-grade ` +
    `students in a kids' learning game. Keep every scenario warm, encouraging, ` +
    `age-appropriate, and free of violence or anything scary. Use simple words ` +
    `a ${grade}-grader can read. Make the scene genuinely about the student's ` +
    `interest so practice feels like play.`;
  const user =
    `Create a vocabulary mini-scenario for the word "${word}" (meaning: ${definition}` +
    `${example ? `; example: ${example}` : ''}).\n` +
    `The student loves ${theme}, so set the scene in a ${theme} adventure.\n\n` +
    `Return JSON with:\n` +
    `- "setup": 2 short sentences placing the student in a ${theme} scene where ` +
    `the word's meaning matters (use the word naturally).\n` +
    `- "question": ask which option best shows what "${word}" means in this scene.\n` +
    `- "choices": exactly 4 short options, one correct and three plausible but wrong.\n` +
    `- "answerIndex": the 0-based index of the correct choice.\n` +
    `- "explanation": one encouraging sentence explaining the right answer.`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: SCENARIO_SCHEMA } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const scenario = JSON.parse(text);
  return sanitize(scenario);
}

// Deterministic, offline scenario — still themed by interest, drills the word.
function templateScenario({ word, definition, interest, siblings }) {
  const theme = interestName(interest);
  const setups = {
    space: `Blasting off on your ${theme} mission, your crew points to something ahead. "Look — it's ${word}!" they say.`,
    dinosaurs: `Deep in the ${theme} valley, your guide spots a creature and whispers, "That one is ${word}."`,
    soccer: `It's the big ${theme} match. The announcer shouts that the star player is totally ${word} today!`,
    animals: `On your ${theme} safari, the ranger points and says, "See how that one is ${word}?"`,
    dragons: `High on Dragon Peak, the oldest ${theme.toLowerCase()} tells you a tale about something ${word}.`,
    ocean: `Diving into the ${theme}, you discover a creature your captain calls ${word}.`,
    cars: `In the ${theme} pit lane, your engineer grins: "This machine is ${word}!"`,
    music: `On stage at the ${theme} show, the crowd cheers because the song is so ${word}.`,
    art: `In your ${theme} studio, your teacher looks at the painting and says it is ${word}.`,
    cooking: `In the ${theme} kitchen, the chef tastes the dish and calls it ${word}.`,
    superheroes: `On a ${theme} mission, your sidekick shouts that the rescue was ${word}!`,
    building: `On your big ${theme} project, your partner says the tower you made is ${word}.`,
  };
  const setup = setups[interest] || `On your ${theme} adventure, you meet the word "${word}".`;
  const distractors = shuffle(siblings.filter((d) => d && d !== definition)).slice(0, 3);
  while (distractors.length < 3) distractors.push('something else entirely');
  const choices = shuffle([definition, ...distractors]);
  return sanitize({
    setup,
    question: `What does "${word}" mean here?`,
    choices,
    answerIndex: choices.indexOf(definition),
    explanation: `"${word}" means ${definition}.`,
  });
}

// Clamp/repair anything odd so the client never breaks.
function sanitize(s) {
  let choices = Array.isArray(s.choices) ? s.choices.map(String).filter(Boolean) : [];
  if (choices.length < 2) choices = ['(answer unavailable)', '...'];
  let idx = Number.isInteger(s.answerIndex) ? s.answerIndex : 0;
  if (idx < 0 || idx >= choices.length) idx = 0;
  return {
    setup: String(s.setup || ''),
    question: String(s.question || 'Which answer is correct?'),
    choices,
    answerIndex: idx,
    explanation: String(s.explanation || ''),
  };
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
