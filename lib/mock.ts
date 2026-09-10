import type { CourseId } from "./courseProfiles";
import type { Analysis, Diagnosis } from "./schemas";

const banks: Record<CourseId, { topics: string[]; questions: Omit<Analysis["questions"][number], "id">[] }> = {
  COMP2012: {
    topics: ["Object lifetime", "Pointer and reference semantics", "Copying and ownership", "Virtual dispatch", "Const correctness", "Exception safety"],
    questions: [
      { topic: "Object lifetime", type: "recall", question: "When is a local object's destructor called, and what changes if the object was allocated with new?", code: null, evaluationCriteria: ["Distinguishes automatic and dynamic lifetime"], referenceAnswer: "Automatic object is destroyed at scope exit; dynamically allocated object requires delete/owner cleanup." },
      { topic: "Const correctness", type: "discrimination", question: "Explain the behavioral difference between const T* p and T* const p.", code: null, evaluationCriteria: ["Correctly identifies const pointee versus const pointer"], referenceAnswer: "const T* prevents mutation through p but allows reseating; T* const allows pointee mutation but not reseating." },
      { topic: "Virtual dispatch", type: "transfer", question: "What does this print, and why?", code: "struct B { virtual void f(){ cout << \"B\"; } };\nstruct D : B { void f() override { cout << \"D\"; } };\nB* p = new D; p->f();", evaluationCriteria: ["Predicts D", "Explains virtual dispatch through base pointer"], referenceAnswer: "D, because virtual dispatch uses the dynamic type." },
      { topic: "Copying and ownership", type: "discrimination", question: "Why is the compiler-generated copy constructor dangerous for a class that owns a raw pointer?", code: null, evaluationCriteria: ["Identifies shallow copy", "Mentions double deletion or aliasing"], referenceAnswer: "It copies the pointer value, producing shared accidental ownership and likely double deletion." },
      { topic: "References", type: "recall", question: "State two important rules that distinguish a reference from a pointer in C++.", code: null, evaluationCriteria: ["Mentions binding/initialization", "Mentions null/reseating or syntax"], referenceAnswer: "A reference must bind on initialization and cannot be reseated; ordinary references are not null." },
      { topic: "Resource safety", type: "transfer", question: "A function allocates memory and then an exception is thrown before delete. What design prevents the leak?", code: null, evaluationCriteria: ["Uses RAII", "Names a suitable owning type"], referenceAnswer: "RAII via an automatic owner such as std::unique_ptr or a container." },
    ],
  },
  COMP2611: {
    topics: ["Datapath", "Control signals", "Instruction execution", "Combinational logic", "Sequential logic", "Performance"],
    questions: [],
  },
  COMP3711: {
    topics: ["Asymptotic analysis", "Recurrences", "Correctness invariants", "Greedy choice", "Dynamic programming", "Algorithm selection"],
    questions: [],
  },
  MATH2023: {
    topics: ["Partial derivatives", "Gradient", "Chain rule", "Multiple integration", "Coordinate changes", "Critical points"],
    questions: [],
  },
  General: {
    topics: ["Core definitions", "Concept relationships", "Conditions and assumptions", "Common misconceptions", "Reasoning", "Application"],
    questions: [],
  },
};

function genericQuestions(course: CourseId, topics: string[]): Analysis["questions"] {
  const prompts = [
    ["recall", "State the core definition or rule for this topic in your own words."],
    ["discrimination", "What is this topic commonly confused with, and what is the decisive difference?"],
    ["transfer", "Give a new situation where this idea applies and explain how you would use it."],
    ["recall", "What assumptions or conditions must hold before using this idea?"],
    ["discrimination", "Describe a plausible but incorrect claim about this topic, then correct it."],
    ["transfer", "How would you recognize that this is the right concept or method for an unfamiliar problem?"],
  ] as const;
  return prompts.map(([type, question], index) => ({
    id: `q${index + 1}`,
    topic: topics[index % topics.length],
    type,
    question: `${question} Focus on ${topics[index % topics.length]}.`,
    code: null,
    evaluationCriteria: ["Accurate central idea", "Relevant reasoning rather than keyword-only recall"],
    referenceAnswer: `A concise, accurate explanation consistent with the supplied ${course} material, including its key conditions and implications.`,
  }));
}

export function mockAnalysis(course: CourseId, material: string, notes: string): Analysis {
  const bank = banks[course];
  const sourceHeadings = material.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 3 && line.length < 80).slice(0, 3);
  const topics = [...new Set([...sourceHeadings, ...bank.topics])].slice(0, 6);
  const lowerNotes = notes.toLowerCase();
  const questions = bank.questions.length ? bank.questions.map((q, index) => ({ ...q, id: `q${index + 1}` })) : genericQuestions(course, topics);
  return {
    lectureTitle: sourceHeadings[0] || `${course} study diagnostic`,
    outline: topics.map((topic, index) => ({ topic, importance: index < 3 ? "high" : index < 5 ? "medium" : "low" })),
    coverage: topics.map((topic, index) => {
      const keyword = topic.toLowerCase().split(/\s+/)[0];
      const present = lowerNotes.includes(keyword);
      return { topic, status: present ? (index % 3 === 0 ? "covered" : "partial") : index === 4 ? "questionable" : "missing", comment: present ? "The notes mention this area; the quiz will check whether the review detail is stable." : "This area is not clearly represented in the current note and should be tested before any patch is suggested." };
    }),
    possibleErrors: [{ topic: topics[1] ?? "Core concept", comment: "One statement may blur two related ideas; the diagnostic quiz will test the distinction." }],
    redundancy: notes.length > 2_000 ? [{ topic: topics[0], comment: "Several passages appear to repeat the same review point and could be condensed." }] : [],
    questions,
  };
}

export function mockDiagnosis(analysis: Pick<Analysis, "coverage" | "questions">, answers: { questionId: string; answer: string; confidence: number }[]): Diagnosis {
  const questionResults = analysis.questions.map((question) => {
    const response = answers.find((answer) => answer.questionId === question.id) ?? { answer: "", confidence: 0 };
    const length = response.answer.trim().length;
    const correctness = length > 90 ? "correct" : length > 25 ? "partial" : "incorrect";
    const diagnosis = correctness === "correct" ? "SOLID" : correctness === "partial" ? "DETAIL_GAP" : response.confidence === 3 ? "CONCEPTUAL_CONFUSION" : "KNOWLEDGE_GAP";
    return { questionId: question.id, correctness, diagnosis, explanation: correctness === "correct" ? "The answer gives a coherent explanation and is treated as stable in demo grading." : correctness === "partial" ? "The answer shows the main direction but lacks a key condition or consequence." : "The answer does not yet demonstrate the central idea." } as Diagnosis["questionResults"][number];
  });
  const conceptStates = analysis.questions.map((question, index) => ({ topic: question.topic, state: questionResults[index].diagnosis, reason: questionResults[index].explanation }));
  const unique = [...new Map(conceptStates.map((item) => [item.topic, item])).values()];
  const reviewAgain = unique.filter((item) => item.state !== "SOLID").map((item) => item.topic);
  const unstable = answers.filter((answer, index) => questionResults[index]?.correctness === "correct" && answer.confidence <= 1).map((answer) => analysis.questions.find((q) => q.id === answer.questionId)?.topic).filter((topic): topic is string => Boolean(topic));
  const solid = unique.filter((item) => item.state === "SOLID" && !unstable.includes(item.topic)).map((item) => item.topic);
  const patchTopics = unique.filter((item) => ["KNOWLEDGE_GAP", "CONCEPTUAL_CONFUSION", "DETAIL_GAP", "REASONING_GAP"].includes(item.state)).slice(0, 3);
  const notePatchMarkdown = patchTopics.length ? patchTopics.map((item) => `### ${item.topic}\n\n- Add the key rule, its conditions, and one short discriminating example.\n- ⚠ Recheck the distinction exposed by the diagnostic answer.`).join("\n\n") : "";
  return { questionResults, conceptStates: unique, notePatchMarkdown, reviewAgain, unstable: [...new Set(unstable)], solid };
}
