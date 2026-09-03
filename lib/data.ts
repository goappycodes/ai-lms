import { Track, TrackId } from "./types";

// The three-course curriculum: Explorer 6, Builder 8, Achiever 10.
//
// Achiever is Builder's eight sessions plus two advanced ones, so the shared
// eight are declared once here and reused. Keeping one source stops the two
// courses drifting apart when a title or description is edited. In the
// database the same lesson row is referenced by both courses.
//
// Row = [title, what it covers].
type Row = [title: string, covers: string];

const SESSION_MINUTES = 30;

function build(
  id: TrackId,
  meta: Omit<Track, "id" | "sessions">,
  rows: Row[],
  advancedFrom = Infinity
): Track {
  return {
    id,
    ...meta,
    sessions: rows.map(([title, covers], i) => ({
      id: `${id}-${i + 1}`,
      n: i + 1,
      title,
      covers,
      durationMin: SESSION_MINUTES,
      ...(i + 1 >= advancedFrom ? { advanced: true } : {}),
    })),
  };
}

// ---------------------------------------------------------------- Explorer --
const explorerRows: Row[] = [
  ["Hello AI!", "AI magic show; how AI learns from examples; why it's sometimes wrong."],
  ["Talking to AI", "Good question vs bad question — watch answers get better as questions get clearer."],
  [
    "My Homework Helper",
    "A hard topic explained 3 fun ways (story, picture, quiz) + 'ask anything' curiosity, checking what's true.",
  ],
  ["Create with AI", "Words become pictures, songs and a talking story, live on the panel."],
  ["Be Smart, Be Safe", "Real vs fake photo game; protect your secrets; be kind with AI."],
  ["My AI Adventure", "Little inventors + jobs of tomorrow + recap & certificate."],
];

// ----------------------------------------------- Builder (shared with Achiever) --
// These eight are the whole Builder course and the first eight of Achiever.
const sharedRows: Row[] = [
  [
    "Welcome to the AI Era",
    "How AI predicts (not thinks), hallucination, AI in daily life, real-vs-fake challenge.",
  ],
  [
    "Prompting + Picking the Right AI",
    "Structured prompts (role, context, task, format) + which tool for which job (decision tree).",
  ],
  [
    "Your 24x7 Study Partner",
    "NotebookLM: chapter PDF → summary, MCQs, flashcards, mock viva. Class 10 board focus.",
  ],
  ["Research + Verify", "Deep research with sources; catch a hallucination live; verify before you trust."],
  ["Create with AI", "Posters (image gen) + video, voice and music from one line — in one session."],
  [
    "Safe, Honest & Private",
    "Deepfakes, the Kerala voice-scam pattern, data hygiene, academic honesty & disclosure.",
  ],
  [
    "AI for Careers & Ideas",
    "How AI reshapes careers + stream/college choice + turning an idea into a mini venture.",
  ],
  ["Build Your Own AI Assistant", "Custom tutor from a textbook, no code + 90-day plan & certificate."],
];

// ------------------------------------------------- Achiever-only (advanced) --
const advancedRows: Row[] = [
  ["Build an App, No Code", "A working study tool / portfolio site from plain English, deployed live."],
  ["AI Agents", "An agent researches colleges (fees, placements) on its own — the frontier skill."],
];

const explorer = build(
  "explorer",
  {
    name: "Explorer",
    audience: "Classes 5–7",
    tagline: "Wonder and play — a first, safe introduction to AI.",
    accent: "linear-gradient(135deg,#4C1D95 0%,#6D28D9 55%,#9333EA 100%)",
  },
  explorerRows
);

const builder = build(
  "builder",
  {
    name: "Builder",
    audience: "Classes 8–10",
    tagline: "Do more, make more — study smarter and build your first AI tools.",
    accent: "linear-gradient(135deg,#0C4A6E 0%,#0E7490 55%,#0891B2 100%)",
  },
  sharedRows
);

const achiever = build(
  "achiever",
  {
    name: "Achiever",
    audience: "Classes 11–12",
    tagline: "Everything in Builder, plus building real apps and agents.",
    accent: "linear-gradient(135deg,#7A1230 0%,#B01E44 55%,#E83858 100%)",
  },
  [...sharedRows, ...advancedRows],
  sharedRows.length + 1
);

export const tracks: Track[] = [explorer, builder, achiever];

export function getTrack(id: string): Track | undefined {
  return tracks.find((t) => t.id === id);
}

// The count of lessons that actually need producing: Achiever's first eight are
// Builder's, so they are authored, filmed and encoded once.
export const uniqueLessonCount = explorerRows.length + sharedRows.length + advancedRows.length;
