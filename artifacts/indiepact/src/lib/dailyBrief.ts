export type AnswerWeight = "A" | "B" | "C";

export interface BriefQuestion {
  id: number;
  text: string;
  options: { A: string; B: string; C: string };
}

export interface DailyResult {
  date: string;
  answers: AnswerWeight[];
  focus: "protection" | "balanced" | "growth";
  aCount: number;
  bCount: number;
  cCount: number;
}

// ─── Question Bank (32 questions) ─────────────────────────────────────────────

export const QUESTION_BANK: BriefQuestion[] = [
  { id: 1,  text: "What is your primary priority today?",          options: { A: "Protect revenue & reduce risk",  B: "Maintain steady progress",    C: "Close deals & grow fast"        } },
  { id: 2,  text: "What situation are you navigating right now?",  options: { A: "Contract negotiation",           B: "Payment or invoicing issue",  C: "New client or deal onboarding"  } },
  { id: 3,  text: "What is your business mindset entering today?", options: { A: "Defensive — avoid costly mistakes", B: "Balanced — steady as she goes", C: "Aggressive — capture opportunity" } },
  { id: 4,  text: "What is your primary goal for this week?",      options: { A: "Secure stability & protect terms", B: "Increase revenue base",       C: "Expand into new territory"      } },
  { id: 5,  text: "How do you assess your risk tolerance today?",  options: { A: "Low — protect what I have",      B: "Medium — measured bets only", C: "High — big moves needed"        } },
  { id: 6,  text: "Where is your time focus today?",               options: { A: "Fixing current problems",        B: "Medium-term deal pipeline",   C: "Long-term strategy building"    } },
  { id: 7,  text: "How much pressure are you under right now?",    options: { A: "High — need damage control",     B: "Moderate — manageable load",  C: "Low — operating from strength"  } },
  { id: 8,  text: "What matters most to you right now?",           options: { A: "Legal safety & protections",    B: "Revenue and cash flow",       C: "Speed of execution"             } },
  { id: 9,  text: "How would you describe your current deal flow?",options: { A: "Stalled — fixing issues",       B: "Steady — progressing well",   C: "Hot — multiple live deals"      } },
  { id: 10, text: "What type of decision are you facing today?",   options: { A: "Defensive — protect assets",    B: "Operational — keep moving",   C: "Offensive — capture market"     } },
  { id: 11, text: "How confident are you in your current contracts?", options: { A: "Low — need review",           B: "Moderate — some concerns",    C: "High — fully protected"         } },
  { id: 12, text: "What describes your cash flow situation?",      options: { A: "Tight — need to collect",       B: "Stable — covering expenses",  C: "Strong — ready to invest"       } },
  { id: 13, text: "How do you feel about upcoming negotiations?",  options: { A: "Anxious — need more protection", B: "Prepared — know what I want", C: "Confident — strong position"   } },
  { id: 14, text: "What is your biggest business challenge today?",options: { A: "Legal exposure or clause risk",  B: "Balancing client expectations", C: "Scaling operations quickly"   } },
  { id: 15, text: "How are your client relationships right now?",  options: { A: "Strained — needs care",         B: "Neutral — professional",      C: "Strong — actively growing"      } },
  { id: 16, text: "What kind of contracts are you focused on?",    options: { A: "Reviewing existing agreements",  B: "Renewing or adjusting terms", C: "Signing new deals"              } },
  { id: 17, text: "How do you rate your leverage in current deals?", options: { A: "Low — I'm being pushed",      B: "Even — balanced negotiation", C: "Strong — I hold the cards"      } },
  { id: 18, text: "How do you feel about your financial protections?", options: { A: "Exposed — need better terms", B: "Adequate — room to improve",  C: "Solid — well protected"        } },
  { id: 19, text: "What is your next 7-day operational focus?",    options: { A: "Protect and defend",             B: "Optimize and refine",         C: "Acquire and expand"             } },
  { id: 20, text: "How is your workload this week?",               options: { A: "Overloaded — need to cut scope", B: "Full but manageable",         C: "Capacity to take on more"       } },
  { id: 21, text: "What is the energy level of your business?",    options: { A: "Recovering — rebuilding",       B: "Cruising — consistent",       C: "Accelerating — growing fast"    } },
  { id: 22, text: "How well are your agreements protecting you?",  options: { A: "Poorly — need urgent review",   B: "Decently — minor gaps",       C: "Fully — airtight terms"         } },
  { id: 23, text: "What is your stance on new client agreements?", options: { A: "Cautious — must vet thoroughly", B: "Standard — usual review",     C: "Fast — close and onboard quick" } },
  { id: 24, text: "What is your decision-making speed today?",     options: { A: "Slow — need more information",  B: "Moderate — weighing options", C: "Fast — ready to commit"         } },
  { id: 25, text: "What kind of outcome do you need today?",       options: { A: "Avoid a loss",                  B: "Make steady progress",        C: "Win something significant"      } },
  { id: 26, text: "How do you feel about your team or partners?",  options: { A: "Misaligned — need clarity",     B: "Aligned — working well",      C: "Highly aligned — synced up"     } },
  { id: 27, text: "What is your capacity for new commitments?",    options: { A: "None — already stretched",      B: "Limited — selective only",    C: "High — actively seeking deals"  } },
  { id: 28, text: "How are your payment terms performing?",        options: { A: "Poorly — outstanding invoices", B: "Acceptable — some delays",    C: "Excellent — on time payments"   } },
  { id: 29, text: "What is your strategic horizon today?",         options: { A: "Survival and protection",       B: "Sustainability and growth",   C: "Dominance and scaling"          } },
  { id: 30, text: "How would you describe your competitive position?", options: { A: "Vulnerable — must fortify", B: "Competitive — holding ground", C: "Dominant — pushing forward"   } },
  { id: 31, text: "How do you rate your contract literacy today?", options: { A: "Uncertain — need guidance",     B: "Competent — understand basics", C: "Sharp — know every clause"    } },
  { id: 32, text: "What best describes your business intent today?", options: { A: "Preserve and protect",        B: "Operate and improve",         C: "Grow and conquer"               } },
];

// ─── Seeded daily shuffle ──────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = (seed ^ 0x45678abc) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = (s ^ (s >>> 16)) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyQuestions(): BriefQuestion[] {
  const day = getDayIndex();
  return seededShuffle(QUESTION_BANK, day).slice(0, 8);
}

// ─── Insight engine ────────────────────────────────────────────────────────────

export interface BriefInsight {
  focus: "protection" | "balanced" | "growth";
  focusLabel: string;
  focusSubtitle: string;
  warning: string | null;
  opportunity: string | null;
  aCount: number;
  bCount: number;
  cCount: number;
}

const WARNINGS: Record<"protection" | "balanced" | "growth", string> = {
  protection: "Avoid rushed agreements today — any unsigned clause could become a liability.",
  balanced:   "Watch for scope creep in ongoing projects. Stay precise on deliverables.",
  growth:     "Don't sacrifice legal protections for speed. Vet new clients before committing.",
};

const OPPORTUNITIES: Record<"protection" | "balanced" | "growth", string> = {
  protection: "Use today to audit your weakest contract terms and close any legal gaps.",
  balanced:   "A focused review of one pending deal today could unlock steady progress.",
  growth:     "Today is the right day to follow up on stalled deals and close pending agreements.",
};

export function computeInsight(answers: AnswerWeight[]): BriefInsight {
  const aCount = answers.filter((a) => a === "A").length;
  const bCount = answers.filter((a) => a === "B").length;
  const cCount = answers.filter((a) => a === "C").length;

  let focus: "protection" | "balanced" | "growth";
  if (aCount >= bCount && aCount >= cCount) {
    focus = "protection";
  } else if (cCount >= aCount && cCount >= bCount) {
    focus = "growth";
  } else {
    focus = "balanced";
  }

  const LABELS: Record<typeof focus, { label: string; subtitle: string }> = {
    protection: { label: "Risk Protection Day",     subtitle: "Prioritize legal safety, clause review, and defensive positioning." },
    balanced:   { label: "Balanced Execution Day",  subtitle: "Operate with steady discipline — optimize deals and manage relationships." },
    growth:     { label: "Growth & Expansion Day",  subtitle: "Move with confidence — close deals, acquire clients, build momentum." },
  };

  return {
    focus,
    focusLabel: LABELS[focus].label,
    focusSubtitle: LABELS[focus].subtitle,
    warning: aCount >= 4 ? WARNINGS.protection : cCount >= 5 ? WARNINGS.growth : null,
    opportunity: OPPORTUNITIES[focus],
    aCount,
    bCount,
    cCount,
  };
}

// ─── localStorage persistence ──────────────────────────────────────────────────

const KEYS = {
  streak:  "ip_brief_streak",
  lastDay: "ip_brief_last_day",
  history: "ip_brief_history",
  result:  "ip_brief_today_result",
};

export interface StreakData {
  streak: number;
  lastDay: number;
  history: string[];
}

export function loadStreak(): StreakData {
  try {
    return {
      streak:  parseInt(localStorage.getItem(KEYS.streak)  ?? "0", 10) || 0,
      lastDay: parseInt(localStorage.getItem(KEYS.lastDay) ?? "0", 10) || 0,
      history: JSON.parse(localStorage.getItem(KEYS.history) ?? "[]") as string[],
    };
  } catch {
    return { streak: 0, lastDay: 0, history: [] };
  }
}

export function saveBriefCompletion(result: DailyResult): StreakData {
  const today = getTodayKey();
  const todayDayIndex = getDayIndex();
  const prev = loadStreak();

  let newStreak: number;
  if (prev.lastDay === 0) {
    newStreak = 1;
  } else if (prev.lastDay === todayDayIndex - 1) {
    newStreak = prev.streak + 1;
  } else if (prev.lastDay === todayDayIndex) {
    newStreak = prev.streak;
  } else {
    newStreak = 1;
  }

  const history = [...new Set([...prev.history, today])].slice(-60);

  localStorage.setItem(KEYS.streak,  String(newStreak));
  localStorage.setItem(KEYS.lastDay, String(todayDayIndex));
  localStorage.setItem(KEYS.history, JSON.stringify(history));
  localStorage.setItem(KEYS.result,  JSON.stringify({ ...result, savedDay: todayDayIndex }));

  return { streak: newStreak, lastDay: todayDayIndex, history };
}

export function loadTodayResult(): DailyResult | null {
  try {
    const raw = localStorage.getItem(KEYS.result);
    if (!raw) return null;
    const saved = JSON.parse(raw) as DailyResult & { savedDay?: number };
    if (saved.savedDay !== getDayIndex()) return null;
    return saved;
  } catch {
    return null;
  }
}
