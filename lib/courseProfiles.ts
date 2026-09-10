export const courseIds = ["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"] as const;
export type CourseId = (typeof courseIds)[number];

export const courseProfiles: Record<CourseId, { label: string; focus: string[]; questionGuidance: string }> = {
  COMP2012: {
    label: "COMP2012 — Object-Oriented Programming & Data Structures",
    focus: ["C++ code behavior", "object model", "pointer/reference semantics", "memory/resource ownership", "class mechanics", "language rules", "common bugs", "code tracing"],
    questionGuidance: "Prefer code tracing and rule discrimination, with precise C++ behavior.",
  },
  COMP2611: {
    label: "COMP2611 — Computer Organization",
    focus: ["digital logic", "hardware components", "architecture", "control signals", "data flow", "instruction execution", "calculation/reasoning", "conceptual relationships"],
    questionGuidance: "Prefer component, data-flow, control-signal, and instruction-execution reasoning.",
  },
  COMP3711: {
    label: "COMP3711 — Design & Analysis of Algorithms",
    focus: ["algorithm idea", "asymptotic analysis", "recurrence", "correctness proof", "algorithm selection", "complexity", "proof patterns", "transfer to unfamiliar problems"],
    questionGuidance: "Prefer correctness and complexity reasoning, proof structure, and algorithm selection.",
  },
  MATH2023: {
    label: "MATH2023 — Multivariable Calculus",
    focus: ["definitions/formulas", "geometric meaning", "derivation", "problem-type recognition", "method selection", "assumptions/conditions", "common calculation traps"],
    questionGuidance: "Prefer method selection, geometric meaning, conditions, and short derivations.",
  },
  General: {
    label: "General",
    focus: ["concept structure", "core knowledge", "reasoning", "common misconceptions"],
    questionGuidance: "Balance recall, discrimination, and transfer questions around the source material.",
  },
};

export function isCourseId(value: string): value is CourseId {
  return courseIds.includes(value as CourseId);
}
