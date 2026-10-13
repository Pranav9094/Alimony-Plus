export type PromptCategory = {
  id: string;
  title: string;
  prompts: string[];
};

export const PROMPT_MATRIX: PromptCategory[] = [
  {
    id: "maintenance",
    title: "Maintenance",
    prompts: [
      "Calculate interim maintenance under Sec 125",
      "What factors do courts consider for maintenance?",
      "How is maintenance enforced if payments stop?",
      "Can maintenance be increased later?",
    ],
  },
  {
    id: "procedure",
    title: "Procedure and hearings",
    prompts: [
      "What happens at a maintenance hearing?",
      "How long does a Sec 125 application take?",
      "What is the difference between interim and final maintenance?",
      "Can I apply under both Sec 125 and personal law?",
    ],
  },
  {
    id: "documents",
    title: "Documents",
    prompts: [
      "Which documents should I keep ready for a hearing?",
      "What is an affidavit of income and assets?",
      "How do I prepare an income statement?",
      "What proof of expenses do courts accept?",
    ],
  },
];