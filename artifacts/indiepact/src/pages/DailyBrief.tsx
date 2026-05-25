import { useState, useEffect, useCallback } from "react";
import { PageTransition } from "@/components/PageTransition";
import {
  Flame, Calendar, CheckCircle2, ChevronRight, RotateCcw,
  Zap, Shield, TrendingUp, AlertTriangle, Star, Clock,
} from "lucide-react";
import {
  getDailyQuestions, computeInsight, saveBriefCompletion, loadTodayResult,
  loadStreak, getTodayKey, getDayIndex,
  type BriefQuestion, type AnswerWeight, type BriefInsight, type StreakData,
} from "@/lib/dailyBrief";

// ─── Calendar grid (last 35 days) ─────────────────────────────────────────────

function CheckInCalendar({ history }: { history: string[] }) {
  const historySet = new Set(history);
  const today = getTodayKey();
  const days: Array<{ key: string; isToday: boolean; done: boolean; dayOfWeek: number }> = [];

  for (let i = 34; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, isToday: key === today, done: historySet.has(key), dayOfWeek: d.getDay() });
  }

  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[9px] font-mono text-slate-600 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {/* Empty leading cells to align first day */}
        {Array.from({ length: days[0].dayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7 w-full" />
        ))}
        {days.map((day) => (
          <div
            key={day.key}
            title={day.key}
            className={`h-7 w-full rounded transition-all flex items-center justify-center ${
              day.isToday
                ? day.done
                  ? "bg-emerald-600 border border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                  : "border-2 border-emerald-700/60 bg-emerald-950/30"
                : day.done
                ? "bg-emerald-900/60 border border-emerald-800/40"
                : "bg-slate-800/30 border border-slate-800/40"
            }`}
          >
            {day.isToday && !day.done && (
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {day.done && (
              <CheckCircle2 className={`h-3 w-3 ${day.isToday ? "text-white" : "text-emerald-600"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Streak header card ────────────────────────────────────────────────────────

function StreakCard({ streak, todayDone, history }: { streak: number; todayDone: boolean; history: string[] }) {
  const consistencyScore = Math.min(100, Math.round((history.filter((d) => {
    const then = new Date(d).getTime();
    const now = Date.now();
    return now - then < 30 * 86_400_000;
  }).length / 30) * 100));

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">30-Day Check-In</p>
          <CheckInCalendar history={history} />
        </div>
        <div className="flex flex-col items-end gap-4 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Flame className={`h-6 w-6 ${streak > 0 ? "text-orange-400" : "text-slate-600"}`} />
              <span className={`text-4xl font-bold font-mono tabular-nums ${streak > 0 ? "text-white" : "text-slate-700"}`}>
                {streak}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">day streak</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Star className="h-4 w-4 text-amber-500/60" />
              <span className="text-xl font-bold font-mono text-amber-400/70 tabular-nums">{consistencyScore}</span>
              <span className="text-xs text-slate-600">/100</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">consistency</p>
          </div>
          {todayDone && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Today complete
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single question card ──────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C"] as const;
type OptionLabel = typeof OPTION_LABELS[number];

function QuestionCard({
  question,
  index,
  total,
  onAnswer,
}: {
  question: BriefQuestion;
  index: number;
  total: number;
  onAnswer: (w: AnswerWeight) => void;
}) {
  const [selected, setSelected] = useState<OptionLabel | null>(null);

  const handleSelect = (opt: OptionLabel) => {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt as AnswerWeight), 340);
  };

  const optionColors: Record<OptionLabel, { base: string; selected: string }> = {
    A: {
      base:     "border-slate-800 bg-[#0c0c0c] hover:border-slate-600 hover:bg-slate-800/30",
      selected: "border-red-800/60 bg-red-950/20 text-red-200",
    },
    B: {
      base:     "border-slate-800 bg-[#0c0c0c] hover:border-slate-600 hover:bg-slate-800/30",
      selected: "border-amber-800/50 bg-amber-950/20 text-amber-200",
    },
    C: {
      base:     "border-slate-800 bg-[#0c0c0c] hover:border-slate-600 hover:bg-slate-800/30",
      selected: "border-emerald-800/50 bg-emerald-950/20 text-emerald-200",
    },
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="uppercase tracking-widest">Question {index + 1} of {total}</span>
          <span>{Math.round(((index) / total) * 100)}% complete</span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-700 rounded-full transition-[width] duration-500"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-7 text-center">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Daily Brief · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h2 className="text-lg font-semibold text-white leading-snug">{question.text}</h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {OPTION_LABELS.map((opt) => {
          const isSelected = selected === opt;
          const isOther = selected !== null && !isSelected;
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={selected !== null}
              className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all duration-200 ${
                isSelected
                  ? optionColors[opt].selected
                  : isOther
                  ? "border-slate-800 bg-[#080808] opacity-40 cursor-not-allowed"
                  : `${optionColors[opt].base} text-slate-300 cursor-pointer`
              }`}
            >
              <span className={`h-8 w-8 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                isSelected
                  ? opt === "A" ? "border-red-700 bg-red-900/50 text-red-200"
                    : opt === "B" ? "border-amber-700 bg-amber-900/50 text-amber-200"
                    : "border-emerald-700 bg-emerald-900/50 text-emerald-200"
                  : "border-slate-700 text-slate-400"
              }`}>
                {isSelected ? <CheckCircle2 className="h-4 w-4" /> : opt}
              </span>
              <span className="text-sm leading-relaxed">{question.options[opt]}</span>
              {isSelected && <ChevronRight className="h-4 w-4 ml-auto shrink-0 animate-pulse opacity-60" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Results card ──────────────────────────────────────────────────────────────

function ResultsCard({ insight, streak, history, onReset }: {
  insight: BriefInsight;
  streak: number;
  history: string[];
  onReset: () => void;
}) {
  const focusConfig = {
    protection: {
      icon: <Shield className="h-6 w-6 text-red-400" />,
      border: "border-red-900/40 bg-red-950/10",
      badge: "bg-red-950/40 border-red-800/50 text-red-300",
      bar: "bg-red-500",
    },
    balanced: {
      icon: <Zap className="h-6 w-6 text-amber-400" />,
      border: "border-amber-900/40 bg-amber-950/10",
      badge: "bg-amber-950/40 border-amber-800/50 text-amber-300",
      bar: "bg-amber-500",
    },
    growth: {
      icon: <TrendingUp className="h-6 w-6 text-emerald-400" />,
      border: "border-emerald-900/40 bg-emerald-950/10",
      badge: "bg-emerald-950/40 border-emerald-800/50 text-emerald-300",
      bar: "bg-emerald-500",
    },
  }[insight.focus];

  const total = insight.aCount + insight.bCount + insight.cCount;
  const bars = [
    { label: "A — Defensive", count: insight.aCount, color: "bg-red-700/70", pct: (insight.aCount / total) * 100 },
    { label: "B — Balanced",  count: insight.bCount, color: "bg-amber-600/70", pct: (insight.bCount / total) * 100 },
    { label: "C — Growth",    count: insight.cCount, color: "bg-emerald-700/70", pct: (insight.cCount / total) * 100 },
  ];

  return (
    <div className="space-y-4">
      {/* Focus mode */}
      <div className={`rounded-2xl border p-7 space-y-4 text-center ${focusConfig.border}`}>
        <div className="flex justify-center">{focusConfig.icon}</div>
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Today's Focus Mode</p>
          <span className={`inline-flex px-4 py-2 rounded-full border text-sm font-bold tracking-wide ${focusConfig.badge}`}>
            {insight.focusLabel}
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">{insight.focusSubtitle}</p>
      </div>

      {/* Answer breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5 space-y-3">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Response Breakdown</p>
        {bars.map((b) => (
          <div key={b.label} className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span className="font-mono">{b.label}</span>
              <span className="font-mono text-slate-500">{b.count}/{total}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-[width] duration-700 ${b.color}`} style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Warning */}
      {insight.warning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-900/30 bg-amber-950/10 px-5 py-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-amber-500/60 uppercase tracking-widest mb-0.5">Today's Warning</p>
            <p className="text-sm text-amber-200/80 leading-relaxed">{insight.warning}</p>
          </div>
        </div>
      )}

      {/* Opportunity */}
      {insight.opportunity && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-4">
          <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest mb-0.5">Today's Opportunity</p>
            <p className="text-sm text-emerald-200/80 leading-relaxed">{insight.opportunity}</p>
          </div>
        </div>
      )}

      {/* Streak updated */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-[#0a0a0a] px-5 py-3.5">
        <Flame className="h-5 w-5 text-orange-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">{streak}-day streak</p>
          <p className="text-xs text-slate-500">Brief completed for {getTodayKey()}</p>
        </div>
        <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto shrink-0" />
      </div>

      {/* 30-day calendar */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">30-Day Check-In History</p>
        </div>
        <CheckInCalendar history={history} />
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors mx-auto"
      >
        <RotateCcw className="h-3 w-3" />
        View today's brief again tomorrow
      </button>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Phase = "intro" | "questions" | "results";

export default function DailyBrief() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions] = useState<BriefQuestion[]>(() => getDailyQuestions());
  const [answers, setAnswers] = useState<AnswerWeight[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [insight, setInsight] = useState<BriefInsight | null>(null);
  const [streakData, setStreakData] = useState<StreakData>(() => loadStreak());
  const [todayResult, setTodayResult] = useState(() => loadTodayResult());

  // On mount, restore today's result if already completed
  useEffect(() => {
    const result = loadTodayResult();
    if (result) {
      setTodayResult(result);
      setInsight(computeInsight(result.answers));
      setPhase("results");
    }
  }, []);

  const handleAnswer = useCallback((weight: AnswerWeight) => {
    const newAnswers = [...answers, weight];
    setAnswers(newAnswers);
    if (currentQ + 1 >= questions.length) {
      const ins = computeInsight(newAnswers);
      setInsight(ins);
      const result = {
        date: getTodayKey(),
        answers: newAnswers,
        focus: ins.focus,
        aCount: ins.aCount,
        bCount: ins.bCount,
        cCount: ins.cCount,
      };
      const newStreak = saveBriefCompletion(result);
      setStreakData(newStreak);
      setTodayResult(result);
      setPhase("results");
    } else {
      setCurrentQ((q) => q + 1);
    }
  }, [answers, currentQ, questions.length]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <PageTransition className="space-y-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-orange-950/40 border border-orange-900/40 flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">Daily Brief</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 uppercase tracking-wider">
                Free
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              2-minute morning check-in · {today}
            </p>
          </div>
          {streakData.streak > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-bold text-white tabular-nums">{streakData.streak}</span>
            </div>
          )}
        </div>
      </div>

      {/* Intro phase */}
      {phase === "intro" && (
        <div className="space-y-5">
          <StreakCard streak={streakData.streak} todayDone={false} history={streakData.history} />

          <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-7 space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-white">Morning Business Briefing</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                8 structured questions. No AI. No fluff. Just clarity on your business mindset, priorities, and focus for today.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <Clock className="h-4 w-4 text-slate-400" />, label: "Under 2 minutes" },
                { icon: <Shield className="h-4 w-4 text-slate-400" />, label: "No data sent to AI" },
                { icon: <Flame className="h-4 w-4 text-orange-400" />, label: "Build your streak" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-slate-800 px-4 py-3 bg-[#080808]">
                  {item.icon}
                  <span className="text-xs text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPhase("questions")}
              className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Flame className="h-4 w-4 text-orange-400" />
              Start Today's Brief
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Questions phase */}
      {phase === "questions" && (
        <QuestionCard
          question={questions[currentQ]}
          index={currentQ}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {/* Results phase */}
      {phase === "results" && insight && (
        <div className="space-y-5">
          <StreakCard streak={streakData.streak} todayDone history={streakData.history} />
          <ResultsCard
            insight={insight}
            streak={streakData.streak}
            history={streakData.history}
            onReset={() => {}}
          />
        </div>
      )}
    </PageTransition>
  );
}
