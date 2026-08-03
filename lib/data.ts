import { Phase, Track, TrackId } from "./types";

// Curriculum data mirrors ai-unlocked-three-tracks-16.xlsx: the same 6-phase
// spine across three tracks, 16 sessions each. Row = [phase, title, takeaway, tools].
type Row = [phase: string, title: string, takeaway: string, tools: string];

function build(
  id: TrackId,
  meta: Omit<Track, "id" | "sessions">,
  rows: Row[]
): Track {
  return {
    id,
    ...meta,
    sessions: rows.map((r, i) => ({
      id: `${id}-${i + 1}`,
      n: i + 1,
      phase: r[0],
      title: r[1],
      takeaway: r[2],
      tools: r[3],
      durationMin: 30,
    })),
  };
}

const explorer = build(
  "explorer",
  {
    name: "Explorer",
    audience: "Classes 5–7",
    tagline: "Wonder and play — teacher-led, no accounts needed to watch.",
    accent: "linear-gradient(135deg,#4C1D95 0%,#6D28D9 55%,#9333EA 100%)",
  },
  [
    ["Get Started", "Hello AI!", "AI is a smart helper that learns from examples, and you can be its boss.", "Gemini"],
    ["Get Started", "Talking to AI", "Good questions get good answers.", "Any chatbot"],
    ["Get Started", "AI Has Many Helpers", "Different helpers are good at different jobs.", "Gemini, NotebookLM, image gen"],
    ["AI for Learning", "My Homework Helper", "No topic is too hard when you ask the right helper.", "Gemini"],
    ["AI for Learning", "Ask Anything!", "Stay curious, and check before you believe.", "Chatbot"],
    ["AI for Learning", "Show and Tell with AI", "AI makes your show-and-tell shine.", "Free deck maker"],
    ["AI for Learning", "Speak English with AI", "Practice English every day without fear.", "Voice mode"],
    ["Create with AI", "Draw with AI", "Describe it in words, watch it appear.", "Free image gen"],
    ["Create with AI", "Sing, Story, Action!", "Your imagination + AI = songs and stories.", "Free music gen"],
    ["Safe + Responsible AI", "Be Smart, Be Safe", "Check what you see, protect your secrets, be kind.", "Image examples"],
    ["Imagine Tomorrow", "Little Inventors", "Every inventor starts with one idea.", "Chatbot + image gen"],
    ["Imagine Tomorrow", "Jobs of Tomorrow", "The jobs of your future are being invented now.", "Image gen"],
    ["Build with AI", "My AI Friend", "You can teach AI to be YOUR helper.", "Gemini Gems"],
    ["Build with AI", "Make a Game with AI", "Games are made by people like you.", "Free no-code builder"],
    ["Build with AI", "Robot Helpers Everywhere", "AI helpers will work FOR you, if you learn to guide them.", "Deep research"],
    ["Build with AI", "My AI Adventure", "This is just the beginning of your AI adventure.", "Recap + certificates"],
  ]
);

const builder = build(
  "builder",
  {
    name: "Builder",
    audience: "Classes 8–10",
    tagline: "Do more, make more — board prep and stream choice built in.",
    accent: "linear-gradient(135deg,#0C4A6E 0%,#0E7490 55%,#0891B2 100%)",
  },
  [
    ["Get Started", "Welcome to the AI Era", "AI predicts, it doesn't think. Use it daily, verify what you see.", "Gemini, ChatGPT"],
    ["Get Started", "Prompting", "Better instructions = 10x better output.", "Any chatbot"],
    ["Get Started", "Which AI for Which Job", "Right tool for the right job beats one tool for everything.", "ChatGPT, Perplexity, NotebookLM"],
    ["AI for Studies", "Your 24x7 Study Partner", "A free personal tutor for board prep.", "NotebookLM"],
    ["AI for Studies", "AI for Research", "Research fast, but always verify sources.", "Perplexity, Gemini"],
    ["AI for Studies", "AI for Presentations", "School projects that look professional, in minutes.", "Free deck maker"],
    ["AI for Studies", "Speak Up with AI", "Practice English daily, free, judgment-free.", "Voice mode"],
    ["Create with AI", "Design with AI", "Clear words replace design skills.", "Free image gen"],
    ["Create with AI", "Video with AI", "Studio-grade creation is now free.", "Free video / music gen"],
    ["Safe + Responsible AI", "Safe, Honest, Private", "Verify before you trust, protect your data, disclose your AI use.", "Detection + privacy settings"],
    ["Career and Future", "Turn Ideas into Income", "Your idea + AI = a real venture.", "Chatbot + image gen"],
    ["Career and Future", "AI, Careers + Your Stream", "Choose your stream with data, not pressure.", "Perplexity"],
    ["Build with AI", "Build Your AI Assistant", "Your own tutor, your syllabus, no code.", "Gemini Gems, NotebookLM"],
    ["Build with AI", "Build an App, No Code", "If you can describe it, you can build it.", "Free no-code builder"],
    ["Build with AI", "AI Agents", "Next skill: directing AI, not just chatting.", "Deep research"],
    ["Build with AI", "Your AI Journey Ahead", "Your next 90 days decide your lead.", "Recap + certificates"],
  ]
);

const achiever = build(
  "achiever",
  {
    name: "Achiever",
    audience: "Classes 11–12",
    tagline: "Results and readiness — boards, entrances, college, employability.",
    accent: "linear-gradient(135deg,#7A1230 0%,#B01E44 55%,#E83858 100%)",
  },
  [
    ["Get Started", "Welcome to the AI Era", "AI fluency is your edge. Verify before you trust.", "Gemini, ChatGPT"],
    ["Get Started", "Prompting Like a Pro", "Prompting is a skill: frameworks beat luck.", "Any chatbot"],
    ["Get Started", "Which AI for Which Job", "Right tool for the right job beats one tool for everything.", "ChatGPT, Perplexity, NotebookLM"],
    ["AI for Studies", "Study Partner + Entrance Prep", "A free tutor for boards AND entrance prep.", "NotebookLM"],
    ["AI for Studies", "AI for Deep Research", "Research like a college student: fast, sourced, verified.", "Perplexity, Gemini"],
    ["AI for Studies", "Presentations + Reports", "Board-project quality that stands out.", "Free deck maker"],
    ["AI for Studies", "Speak Up: Interviews + GD", "Walk into any interview already rehearsed.", "Voice mode"],
    ["Create with AI", "Design with AI", "Clear words replace design skills.", "Free image gen"],
    ["Create with AI", "Video with AI", "Studio-grade creation is now free.", "Free video / music gen"],
    ["Safe + Responsible AI", "Safety, Ethics + Data Hygiene", "Verify, protect, disclose: use AI like a professional.", "Detection + privacy settings"],
    ["Career and Future", "Turn Ideas into Income", "Your idea + AI = income before college.", "Chatbot + image gen"],
    ["Career and Future", "AI and Your Career", "AI users will beat non-users in every field.", "Perplexity"],
    ["Build with AI", "Build Your AI Assistant", "Your own board coach, your syllabus, no code.", "Gemini Gems, NotebookLM"],
    ["Build with AI", "Build an App, No Code", "If you can describe it, you can build it.", "Free no-code builder"],
    ["Build with AI", "AI Agents", "Direct AI to do real work: the skill of the next decade.", "Deep research"],
    ["Build with AI", "Your AI Journey Ahead", "Your next 90 days decide your lead.", "Recap + certificates"],
  ]
);

export const tracks: Track[] = [explorer, builder, achiever];

export function getTrack(id: string): Track | undefined {
  return tracks.find((t) => t.id === id);
}

export function getPhases(track: Track): Phase[] {
  const out: Phase[] = [];
  for (const s of track.sessions) {
    let p = out.find((x) => x.name === s.phase);
    if (!p) {
      p = { name: s.phase, sessions: [] };
      out.push(p);
    }
    p.sessions.push(s);
  }
  return out;
}
