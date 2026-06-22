// Deterministic demo data for Word Garden. Builds a teacher, a class with
// several students across multiple subjects, vocab decks, and a spread of
// practice history so plants appear at every life stage on first run.
import { applyReview, defaultAvatar, DAY_MS } from './model.js';

let _id = 0;
const id = (p) => `${p}_${++_id}`;

function deck(subjectId, name, type, terms) {
  return {
    id: id('deck'),
    subjectId,
    name,
    // Each deck supports three task formats over the same terms.
    tasks: ['flashcards', 'quiz', 'reading'],
    primaryType: type,
    terms: terms.map(([term, definition, example]) => ({
      id: id('term'),
      term,
      definition,
      example,
    })),
  };
}

export function buildSeed(now = Date.now()) {
  _id = 0;
  const teacher = {
    id: 'teacher_ms_rivera',
    role: 'teacher',
    name: 'Ms. Rivera',
    avatar: null,
  };

  const classId = 'class_3b';
  const klass = { id: classId, name: 'Room 3B — 3rd Grade', teacherId: teacher.id, gradeLevel: 3 };

  // Multiple subjects to show cross-subject skill trees (elementary school).
  const subjects = [
    { id: 'subj_ela', classId, name: 'Reading & Vocabulary', icon: '📚', color: '#6c8' },
    { id: 'subj_sci', classId, name: 'Science Words',         icon: '🔬', color: '#69c' },
    { id: 'subj_math', classId, name: 'Math Vocabulary',      icon: '🔢', color: '#c79' },
  ];

  const decks = [
    deck('subj_ela', 'Story Words', 'flashcards', [
      ['brave', 'showing courage; not afraid', 'The brave knight faced the dragon.'],
      ['gloomy', 'dark or sad', 'The sky looked gloomy before the storm.'],
      ['curious', 'wanting to learn or know', 'The curious cat explored the box.'],
      ['enormous', 'very, very big', 'The whale is an enormous animal.'],
      ['whisper', 'to speak very softly', 'She whispered a secret to her friend.'],
      ['journey', 'a trip from one place to another', 'Their journey took three days.'],
    ]),
    deck('subj_ela', 'Feelings & Actions', 'quiz', [
      ['delighted', 'very happy and pleased', 'He was delighted with the gift.'],
      ['frustrated', 'upset because something is hard', 'She felt frustrated by the puzzle.'],
      ['gentle', 'soft and kind', 'Be gentle with the puppy.'],
      ['stubborn', 'not willing to change your mind', 'The stubborn mule would not move.'],
      ['generous', 'happy to give and share', 'A generous friend shared her lunch.'],
    ]),
    deck('subj_sci', 'Life Science', 'reading', [
      ['habitat', 'the home of a plant or animal', 'A pond is the habitat of a frog.'],
      ['predator', 'an animal that hunts others', 'The hawk is a predator of mice.'],
      ['photosynthesis', 'how plants make food from sunlight', 'Leaves use photosynthesis to grow.'],
      ['nocturnal', 'active at night', 'Owls are nocturnal hunters.'],
      ['camouflage', 'colors that help an animal hide', 'The lizard used camouflage to hide.'],
    ]),
    deck('subj_sci', 'Earth & Sky', 'flashcards', [
      ['orbit', 'the path one object takes around another', 'The Moon is in orbit around Earth.'],
      ['erosion', 'when wind or water wears land away', 'Erosion slowly carved the canyon.'],
      ['evaporate', 'to turn from liquid into gas', 'Puddles evaporate in the sun.'],
      ['mineral', 'a solid found in the earth', 'Salt is a mineral we eat.'],
    ]),
    deck('subj_math', 'Number Words', 'quiz', [
      ['equal', 'the same amount', 'Two plus three is equal to five.'],
      ['sum', 'the answer to an addition', 'The sum of 4 and 4 is 8.'],
      ['difference', 'the answer to a subtraction', 'The difference of 9 and 2 is 7.'],
      ['estimate', 'a careful guess of an amount', 'Estimate how many jellybeans there are.'],
      ['symmetry', 'two halves that match', 'A butterfly has symmetry.'],
    ]),
  ];

  // Students with varied diligence so gardens look different.
  const studentDefs = [
    { name: 'Maya',   diligence: 0.92, interests: ['space', 'animals'] },
    { name: 'Liam',   diligence: 0.70, interests: ['dinosaurs', 'soccer'] },
    { name: 'Aisha',  diligence: 0.55, interests: ['art', 'ocean'] },
    { name: 'Noah',   diligence: 0.30, interests: ['cars', 'superheroes'] }, // neglected garden
    { name: 'Sofia',  diligence: 0.80, interests: ['dragons', 'music'] },
  ];

  const allTerms = decks.flatMap((d) => d.terms.map((t) => ({ ...t, deck: d })));
  const students = [];
  const mastery = {}; // key `${studentId}:${termId}` -> record
  const gardens = {}; // studentId -> { plants:[], decorations:[] }
  const colors = ['blue', 'green', 'purple', 'orange', 'pink'];
  const faces = ['happy', 'grin', 'cool', 'star', 'happy'];
  const hats = ['cap', 'none', 'straw', 'grad', 'none'];

  studentDefs.forEach((sd, si) => {
    const sid = `student_${sd.name.toLowerCase()}`;
    let xp = 0;
    let masteredCount = 0;
    const plants = [];

    // Simulate practice history for a subset of terms per student.
    const learnCount = Math.round(allTerms.length * sd.diligence);
    const learned = allTerms.slice(0, learnCount);
    learned.forEach((t, ti) => {
      let rec = null;
      const sessions = 1 + Math.round(sd.diligence * 4);
      for (let s = 0; s < sessions; s++) {
        const correct = Math.random() < 0.45 + sd.diligence * 0.5;
        // last practice spread out: diligent students practiced recently.
        const daysAgo = (1 - sd.diligence) * 12 * Math.random() + ti % 5;
        rec = applyReview(rec, correct, now - daysAgo * DAY_MS);
        if (correct) xp += 10;
      }
      mastery[`${sid}:${t.id}`] = rec;
      if (rec.mastery > 0.7) masteredCount++;
      // Plant the term in the garden.
      const speciesPool = ['daisy', 'tulip', 'sunflower', 'rose', 'hibiscus'];
      plants.push({
        id: id('plant'),
        termId: t.id,
        species: speciesPool[ti % speciesPool.length],
        plot: ti,
      });
    });

    const streak = Math.round(sd.diligence * 9);
    students.push({
      id: sid,
      role: 'student',
      name: sd.name,
      classId,
      xp,
      streak,
      lastActive: now - Math.round((1 - sd.diligence) * 6) * DAY_MS,
      avatar: { ...defaultAvatar(), color: colors[si], face: faces[si], hat: hats[si] },
      interests: sd.interests,
    });
    const decoPool = ['fence', 'pond', 'butterfly', 'gnome'];
    const decorations = decoPool.slice(0, Math.floor(masteredCount / 3));
    gardens[sid] = { plants, decorations };
  });

  return {
    users: [teacher, ...students],
    classes: [klass],
    subjects,
    decks,
    mastery,
    gardens,
    // social: cheers given on gardens
    cheers: [],
    createdAt: now,
  };
}
