import type { MaterialRecord, StudyAnalysis } from "@/types/study";

/** Demonstration data — not real student data. */
export const SAMPLE_MATERIALS: MaterialRecord[] = [
  {
    id: "mat-networks",
    name: "Computer Networks — Chapter 3",
    subject: "Computer Networks",
    chapter: "Chapter 3 — Transport Layer",
    concepts: 27,
    lastStudied: "Today",
    progress: 82,
    source: "sample",
  },
  {
    id: "mat-calculus",
    name: "Calculus — Numerical Methods",
    subject: "Calculus",
    chapter: "Numerical Methods",
    concepts: 18,
    lastStudied: "Yesterday",
    progress: 68,
    source: "sample",
  },
  {
    id: "mat-ml",
    name: "Machine Learning — Classification",
    subject: "Machine Learning",
    chapter: "Classification",
    concepts: 32,
    lastStudied: "4 days ago",
    progress: 91,
    source: "sample",
  },
];

export const KNOWLEDGE_MEMORY = [
  { subject: "Computer Networks", value: 82 },
  { subject: "Calculus", value: 68 },
  { subject: "Machine Learning", value: 91 },
  { subject: "Algorithms", value: 74 },
  { subject: "Operating Systems", value: 59 },
];

export const WEEKLY_MASTERY = [
  { day: "Mon", value: 62 },
  { day: "Tue", value: 66 },
  { day: "Wed", value: 71 },
  { day: "Thu", value: 77 },
  { day: "Fri", value: 82 },
];

export const OVERVIEW_STATS = [
  { label: "Overall mastery", value: 82 },
  { label: "Retention", value: 76 },
  { label: "Consistency", value: 91 },
];

export const SAMPLE_ANALYSIS: StudyAnalysis = {
  id: "analysis-sample",
  title: "TCP Congestion Control",
  subject: "Computer Networks",
  chapter: "Chapter 3 — Transport Layer",
  summary:
    "The material covers reliable transport over an unreliable network: how TCP detects loss, how it reacts to congestion signals, and how the congestion window evolves across slow start, congestion avoidance, fast retransmit and fast recovery.",
  createdAt: 0,
  concepts: [
    { id: "tcp", title: "TCP", difficulty: "medium", mastery: 82 },
    { id: "reliability", title: "Reliability", difficulty: "easy", mastery: 88, parent: "tcp" },
    { id: "flow", title: "Flow Control", difficulty: "medium", mastery: 74, parent: "tcp" },
    { id: "congestion", title: "Congestion Control", difficulty: "hard", mastery: 61, parent: "tcp" },
    { id: "tahoe", title: "Tahoe", difficulty: "medium", mastery: 70, parent: "congestion" },
    { id: "reno", title: "Reno", difficulty: "hard", mastery: 54, parent: "congestion" },
  ],
  weakAreas: [
    {
      title: "Fast Recovery",
      confidence: 54,
      reason: "Answers conflate recovery with a full return to slow start.",
    },
    {
      title: "Congestion Avoidance",
      confidence: 61,
      reason: "Additive increase behaviour is described inconsistently.",
    },
    {
      title: "TCP Reno vs Tahoe",
      confidence: 64,
      reason: "The distinction after three duplicate ACKs is unclear.",
    },
  ],
  questions: [
    {
      id: "q1",
      kind: "open",
      question:
        "Why does TCP Reno reduce its congestion window after three duplicate ACKs?",
      answer:
        "Three duplicate ACKs signal an isolated packet loss while the network still delivers data, so Reno halves the window and enters fast recovery instead of restarting from slow start.",
      explanation:
        "Fast Recovery lets TCP Reno keep transmitting at roughly half the previous rate rather than collapsing the window to one MSS.",
      difficulty: "hard",
      concept: "Fast Recovery",
    },
    {
      id: "q2",
      kind: "multiple-choice",
      question: "What does TCP interpret packet loss as?",
      options: [
        "A routing table error",
        "A signal of network congestion",
        "A receiver buffer overflow only",
        "An application-level failure",
      ],
      answer: "A signal of network congestion",
      explanation:
        "TCP has no direct view of the network, so loss is its primary congestion signal.",
      difficulty: "easy",
      concept: "Congestion Control",
    },
    {
      id: "q3",
      kind: "true-false",
      question: "During congestion avoidance the window grows exponentially.",
      answer: "False",
      explanation:
        "Growth is additive — roughly one MSS per round-trip time. Exponential growth belongs to slow start.",
      difficulty: "medium",
      concept: "Congestion Avoidance",
    },
    {
      id: "q4",
      kind: "flashcard",
      question: "What triggers fast retransmit?",
      answer: "Three duplicate ACKs for the same sequence number.",
      explanation:
        "The sender retransmits immediately instead of waiting for the retransmission timeout.",
      difficulty: "easy",
      concept: "Fast Retransmit",
    },
    {
      id: "q5",
      kind: "open",
      question: "How does flow control differ from congestion control?",
      answer:
        "Flow control protects the receiver from being overwhelmed using the advertised window; congestion control protects the network using the congestion window.",
      explanation: "Two separate windows; the sender uses the minimum of both.",
      difficulty: "medium",
      concept: "Flow Control",
    },
    {
      id: "q6",
      kind: "multiple-choice",
      question: "After a retransmission timeout, TCP Tahoe sets the congestion window to:",
      options: ["Half its previous value", "One MSS", "The receiver window", "Zero"],
      answer: "One MSS",
      explanation: "Tahoe always restarts from slow start after loss.",
      difficulty: "medium",
      concept: "Tahoe",
    },
  ],
  flashcards: [
    { id: "f1", front: "What triggers fast retransmit?", back: "Three duplicate ACKs." },
    { id: "f2", front: "Slow start growth?", back: "Exponential — window doubles each RTT." },
    { id: "f3", front: "Reno after 3 dup ACKs?", back: "Halve cwnd, enter fast recovery." },
  ],
  recommendedSession: {
    minutes: 18,
    blocks: [
      { index: "01", title: "Warm up", detail: "3 questions", minutes: 3 },
      { index: "02", title: "Core concepts", detail: "5 questions", minutes: 7 },
      { index: "03", title: "Weak areas", detail: "4 questions", minutes: 6 },
      { index: "04", title: "Quick review", detail: "3 flashcards", minutes: 2 },
    ],
  },
};
