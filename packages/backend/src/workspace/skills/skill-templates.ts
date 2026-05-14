export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: 'hello-world',
    name: 'hello-world',
    description: 'Simple greeting skill for testing and onboarding',
    content: `---
name: hello-world
description: A simple greeting skill for testing and onboarding
inputs:
  - name: user_name
    type: string
    description: The name of the user to greet
outputs:
  - name: greeting
    type: string
    description: A personalized greeting message
---

## Prompt Template

Hello {{user_name}}! Welcome to the AIDLC workspace.

I'm here to help you get started. How can I assist you today?
`,
  },
  {
    id: 'code-reviewer',
    name: 'code-reviewer',
    description: 'Reviews code for quality, security, and best practices',
    content: `---
name: code-reviewer
description: Reviews code for quality, security, and best practices
inputs:
  - name: code_diff
    type: string
    description: The code diff to review
  - name: language
    type: string
    description: Programming language
outputs:
  - name: review_comments
    type: markdown
    description: Structured review comments
---

## Prompt Template

You are a senior code reviewer. Review the following {{language}} code diff:

\`\`\`diff
{{code_diff}}
\`\`\`

Provide feedback on:
1. Code quality and readability
2. Potential bugs or edge cases
3. Security concerns
4. Performance implications

Format your response as structured review comments.
`,
  },
  {
    id: 'test-converter',
    name: 'test-converter',
    description: 'Converts manual test cases to automated test scripts',
    content: `---
name: test-converter
description: Converts manual test cases to automated test scripts
inputs:
  - name: manual_tests
    type: string
    description: Manual test case descriptions
  - name: framework
    type: string
    description: Target test framework (e.g., Jest, Pytest, JUnit)
  - name: language
    type: string
    description: Programming language for the automated tests
outputs:
  - name: automated_tests
    type: string
    description: Generated automated test code
---

## Prompt Template

Convert the following manual test cases into automated {{framework}} tests in {{language}}:

{{manual_tests}}

Requirements:
- Each manual test should become one or more automated test functions
- Include setup and teardown where appropriate
- Add meaningful assertions for each test step
- Follow {{framework}} best practices and conventions
`,
  },
  {
    id: 'doc-writer',
    name: 'doc-writer',
    description: 'Generates documentation from code and specifications',
    content: `---
name: doc-writer
description: Generates documentation from code and specifications
inputs:
  - name: source_code
    type: string
    description: Source code to document
  - name: doc_type
    type: string
    description: Type of documentation (API, README, architecture, user guide)
outputs:
  - name: documentation
    type: markdown
    description: Generated documentation in markdown format
---

## Prompt Template

Generate {{doc_type}} documentation for the following source code:

\`\`\`
{{source_code}}
\`\`\`

Requirements:
- Write clear, concise documentation appropriate for the {{doc_type}} format
- Include code examples where relevant
- Document parameters, return values, and error cases
- Follow standard documentation conventions for the language
`,
  },
  {
    id: 'release-notes',
    name: 'release-notes',
    description: 'Generates release notes from commit history and changelogs',
    content: `---
name: release-notes
description: Generates release notes from commit history and changelogs
inputs:
  - name: commits
    type: string
    description: Git commit messages since last release
  - name: version
    type: string
    description: The new version number
  - name: project_name
    type: string
    description: Name of the project
outputs:
  - name: release_notes
    type: markdown
    description: Formatted release notes
---

## Prompt Template

Generate release notes for {{project_name}} version {{version}} based on the following commits:

{{commits}}

Requirements:
- Group changes by category (Features, Bug Fixes, Breaking Changes, Performance, Documentation)
- Write user-friendly descriptions (not raw commit messages)
- Highlight breaking changes prominently
- Include migration notes for breaking changes if applicable
`,
  },
];
