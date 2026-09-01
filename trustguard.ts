import { AnalyzeContentBody, AnalyzeContentResponse } from "@workspace/api-zod";

type Category = "False Urgency" | "Hidden Cost" | "Confirmshaming";

type Rule = {
  category: Category;
  reason: string;
  score: number;
  expressions: RegExp[];
};

const rules: Rule[] = [
  {
    category: "False Urgency",
    reason: "Creates pressure to act immediately with a countdown or scarcity claim.",
    score: 38,
    expressions: [
      /\b(?:only|just)\s+\d+\s+(?:left|remaining)\b/i,
      /\b(?:ends?|expires?|sale)\s+(?:in|today|soon)\b/i,
      /\b(?:hurry|act\s+now|last\s+chance|don't\s+miss)\b/i,
      /\b\d{1,2}\s*:\s*\d{2}(?::\s*\d{2})?\b/i,
      /\b(?:limited|exclusive)\s+(?:time|offer|stock)\b/i,
    ],
  },
  {
    category: "Hidden Cost",
    reason: "Introduces an unexpected fee or obscures the true price until later.",
    score: 42,
    expressions: [
      /\b(?:processing|service|convenience|handling|booking)\s+fee\b/i,
      /\b(?:additional|extra|plus)\s+(?:fee|charge|cost)s?\b/i,
      /\b(?:taxes?|fees?)\s+(?:may\s+)?(?:apply|added)\b/i,
      /\b(?:from|starting)\s+\$?\d+(?:\.\d{2})?\b/i,
    ],
  },
  {
    category: "Confirmshaming",
    reason: "Uses guilt, shame, or a demeaning refusal choice to push acceptance.",
    score: 45,
    expressions: [
      /\b(?:no|not)\b.{0,25}\b(?:thanks?|thank you)\b/i,
      /\b(?:i\s+don't|i\s+do\s+not)\s+(?:want|like|need)\b/i,
      /\b(?:skip|decline|continue)\b.{0,25}\b(?:miss|lose|regret|stay)\b/i,
      /\b(?:don't|do\s+not)\s+(?:be|become)\s+(?:cheap|selfish|behind)\b/i,
    ],
  },
];

const fallbackSignals = (text: string) => {
  const tokens = new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
  const signals: string[] = [];
  if ([...tokens].filter((token) => ["urgent", "immediately", "hurry", "today", "now", "limited", "remaining"].includes(token)).length >= 2) {
    signals.push("NLP fallback: pressure language");
  }
  if ([...tokens].filter((token) => ["fee", "fees", "charge", "tax", "taxes", "shipping", "subscription"].includes(token)).length >= 2) {
    signals.push("NLP fallback: price ambiguity");
  }
  if ([...tokens].some((token) => ["regret", "miss", "selfish", "cheap", "behind"].includes(token)) && [...tokens].some((token) => ["no", "not", "skip", "decline"].includes(token))) {
    signals.push("NLP fallback: guilt language");
  }
  return signals;
};

export const analyzeItems = (body: unknown) => {
  const input = AnalyzeContentBody.parse(body);
  const flagged = input.items.flatMap((rawText) => {
    const text = rawText.trim();
    const fallback = fallbackSignals(text);
    return rules.flatMap((rule) => {
      const signals = rule.expressions
        .map((expression) => text.match(expression)?.[0])
        .filter((signal): signal is string => Boolean(signal));
      if (signals.length === 0) {
        if (rule.category === "False Urgency" && fallback.includes("NLP fallback: pressure language")) signals.push("NLP fallback: pressure language");
        if (rule.category === "Hidden Cost" && fallback.includes("NLP fallback: price ambiguity")) signals.push("NLP fallback: price ambiguity");
        if (rule.category === "Confirmshaming" && fallback.includes("NLP fallback: guilt language")) signals.push("NLP fallback: guilt language");
      }
      if (signals.length === 0) return [];
      return [{
        text,
        category: rule.category,
        reason: rule.reason,
        threatScore: Math.min(99, rule.score + Math.max(0, signals.length - 1) * 11),
        signals,
      }];
    });
  });
  return AnalyzeContentResponse.parse(flagged);
};