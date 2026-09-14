import { describe, expect, it } from "vitest";
import { buildAnalysisMessages, buildQuizReviewMessages, buildSummaryMessages } from "@/lib/prompts";
import { draftAnalysis } from "./fixtures";

const courseSummary = {
  overview: "Course material overview.",
  topics: [{ topic: "Topic 1", details: "Important material.", importance: "high" as const }, { topic: "Topic 2", details: "Supporting material.", importance: "medium" as const }, { topic: "Topic 3", details: "Background material.", importance: "low" as const }],
  terminology: ["term"],
};

describe("analysis and review prompts", () => {
  it("keeps course material and student notes in separate summary calls", () => {
    const material = buildSummaryMessages("General", "course_material", "PDF CONTENT ONLY");
    const notes = buildSummaryMessages("General", "student_notes", "NOTE CONTENT ONLY");
    expect(material.user).toContain("PDF CONTENT ONLY");
    expect(material.user).not.toContain("NOTE CONTENT ONLY");
    expect(notes.user).toContain("NOTE CONTENT ONLY");
    expect(notes.user).not.toContain("PDF CONTENT ONLY");
    expect(notes.system).toMatch(/untrusted/i);
  });

  it("compares completed summaries rather than mixing raw source text", () => {
    const messages = buildAnalysisMessages("General", courseSummary, { ...courseSummary, overview: "Student note overview." });
    expect(messages.user).toContain("<course_summary>");
    expect(messages.user).toContain("<student_notes_summary>");
    expect(messages.user).not.toContain("PDF CONTENT ONLY");
  });

  it("requires the second model to audit and revise the exact six drafted questions", () => {
    const messages = buildQuizReviewMessages("General", courseSummary, draftAnalysis);
    expect(messages.system).toMatch(/independent quiz quality reviewer/i);
    expect(messages.system).toContain("Keep exactly the same question IDs and coverageTopicIds");
    expect(messages.system).toContain("exactly 2 single_choice");
  });
});
