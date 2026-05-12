/**
 * Prompt Builder — constructs role-specific prompts for each SDLC agent.
 *
 * Each agent role gets a tailored system prompt and a user prompt that
 * includes the phase context, input artifacts from upstream tasks, and
 * the agent's configured skill set.
 */
import type { LlmMessage } from './llm-provider.interface';

export interface PromptContext {
  phaseName: string;
  agentRole: string;
  agentName: string;
  skillSet: string[];
  customSystemPrompt?: string;
  inputArtifacts: Array<{
    name: string;
    artifactType: string;
    contentRef: string;
    metadata?: Record<string, unknown>;
  }>;
  projectContext?: string;
}

// ── Role-specific system prompts ─────────────────────────────────────────

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  BA_AGENT: `You are an expert Business Analyst (BA) working on a software development project.
Your responsibilities include:
- Gathering and documenting requirements
- Writing clear user stories with acceptance criteria
- Creating functional specifications and process flows
- Identifying stakeholder needs and translating them into actionable requirements
- Ensuring requirements are testable, unambiguous, and complete

Always produce structured, professional documents in Markdown format.`,

  DEV_AGENT: `You are an expert Software Developer working on a software development project.
Your responsibilities include:
- Writing clean, maintainable, and well-documented code
- Creating technical design documents and architecture notes
- Implementing features based on requirements and specifications
- Writing unit tests alongside implementation
- Following best practices for the relevant tech stack

Always produce well-structured output. For code, include comments and follow the project's conventions.`,

  QA_AGENT: `You are an expert QA Engineer working on a software development project.
Your responsibilities include:
- Creating comprehensive test plans and test cases
- Identifying edge cases and potential failure scenarios
- Writing test scripts for manual and automated testing
- Documenting defects with clear reproduction steps
- Ensuring quality standards are met before release

Always produce structured test documentation in Markdown format with clear pass/fail criteria.`,

  DEVOPS_AGENT: `You are an expert DevOps / Release Engineer working on a software development project.
Your responsibilities include:
- Designing and documenting CI/CD pipeline configurations
- Creating deployment scripts and runbooks
- Defining infrastructure requirements and quality gates
- Writing release checklists and rollback procedures
- Monitoring and observability setup documentation

Always produce clear, actionable operational documentation.`,

  DESIGNER_AGENT: `You are an expert UX/UI Designer working on a software development project.
Your responsibilities include:
- Creating wireframes and design specifications
- Documenting user flows and interaction patterns
- Defining design system components and guidelines
- Writing accessibility requirements
- Producing design review notes and feedback

Always produce structured design documentation with clear visual descriptions.`,

  SRE_AGENT: `You are an expert Site Reliability Engineer (SRE) working on a software development project.
Your responsibilities include:
- Defining SLOs, SLIs, and error budgets
- Creating incident response runbooks
- Documenting capacity planning and scaling strategies
- Writing post-mortem templates and reliability reviews
- Defining alerting and monitoring requirements

Always produce clear, actionable reliability documentation.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are an expert software development agent.
Produce high-quality, structured documentation relevant to your assigned SDLC phase.
Always use Markdown format for your output.`;

// ── Artifact type → readable label ───────────────────────────────────────

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  DOCUMENT:          'Document',
  CODE:              'Code',
  TEST_PLAN:         'Test Plan',
  DEPLOYMENT_SCRIPT: 'Deployment Script',
  REVIEW_REPORT:     'Review Report',
  CUSTOM:            'Artifact',
};

// ── Public API ────────────────────────────────────────────────────────────

export function buildPrompt(ctx: PromptContext): LlmMessage[] {
  const systemContent =
    ctx.customSystemPrompt ||
    ROLE_SYSTEM_PROMPTS[ctx.agentRole.toUpperCase()] ||
    DEFAULT_SYSTEM_PROMPT;

  const messages: LlmMessage[] = [
    { role: 'system', content: systemContent },
  ];

  // Build the user message
  const parts: string[] = [];

  parts.push(`## Task Assignment`);
  parts.push(`**Agent**: ${ctx.agentName} (${ctx.agentRole.replace('_AGENT', '')})`);
  parts.push(`**SDLC Phase**: ${ctx.phaseName}`);

  if (ctx.skillSet.length > 0) {
    parts.push(`**Skills**: ${ctx.skillSet.join(', ')}`);
  }

  if (ctx.projectContext) {
    parts.push(`\n## Project Context\n${ctx.projectContext}`);
  }

  // Include upstream artifacts as context
  if (ctx.inputArtifacts.length > 0) {
    parts.push(`\n## Input from Upstream Phases`);
    parts.push(
      `The following artifacts were produced by agents in earlier SDLC phases. ` +
      `Use them as context for your work:`,
    );
    for (const artifact of ctx.inputArtifacts) {
      const label = ARTIFACT_TYPE_LABELS[artifact.artifactType] ?? artifact.artifactType;
      parts.push(`\n### ${label}: ${artifact.name}`);
      parts.push(`*Reference: ${artifact.contentRef}*`);
      if (artifact.metadata && Object.keys(artifact.metadata).length > 0) {
        parts.push(`*Metadata: ${JSON.stringify(artifact.metadata, null, 2)}*`);
      }
    }
  }

  parts.push(`\n## Your Task`);
  parts.push(buildTaskInstruction(ctx));

  messages.push({ role: 'user', content: parts.join('\n') });

  return messages;
}

function buildTaskInstruction(ctx: PromptContext): string {
  const role = ctx.agentRole.toUpperCase();
  const phase = ctx.phaseName;

  switch (role) {
    case 'BA_AGENT':
      return (
        `For the **${phase}** phase, produce a comprehensive requirements document that includes:\n` +
        `1. Overview and objectives\n` +
        `2. User stories with acceptance criteria\n` +
        `3. Functional requirements\n` +
        `4. Non-functional requirements\n` +
        `5. Assumptions and constraints\n\n` +
        `Format your output as a well-structured Markdown document.`
      );

    case 'DEV_AGENT':
      return (
        `For the **${phase}** phase, produce a technical implementation document that includes:\n` +
        `1. Technical approach and architecture decisions\n` +
        `2. Key components and their responsibilities\n` +
        `3. Data models or API contracts (if applicable)\n` +
        `4. Implementation notes and code examples\n` +
        `5. Known risks and mitigations\n\n` +
        `Format your output as a well-structured Markdown document with code blocks where appropriate.`
      );

    case 'QA_AGENT':
      return (
        `For the **${phase}** phase, produce a comprehensive test plan that includes:\n` +
        `1. Test scope and objectives\n` +
        `2. Test cases with steps, expected results, and pass/fail criteria\n` +
        `3. Edge cases and negative test scenarios\n` +
        `4. Test environment requirements\n` +
        `5. Entry and exit criteria\n\n` +
        `Format your output as a well-structured Markdown document with a test case table.`
      );

    case 'DEVOPS_AGENT':
      return (
        `For the **${phase}** phase, produce a deployment and operations document that includes:\n` +
        `1. Deployment checklist and steps\n` +
        `2. Quality gate criteria\n` +
        `3. Rollback procedure\n` +
        `4. Monitoring and alerting requirements\n` +
        `5. Post-deployment verification steps\n\n` +
        `Format your output as a well-structured Markdown runbook.`
      );

    case 'DESIGNER_AGENT':
      return (
        `For the **${phase}** phase, produce a design specification document that includes:\n` +
        `1. User flow description\n` +
        `2. Key screens and components\n` +
        `3. Interaction patterns and states\n` +
        `4. Accessibility requirements\n` +
        `5. Design decisions and rationale\n\n` +
        `Format your output as a well-structured Markdown design document.`
      );

    case 'SRE_AGENT':
      return (
        `For the **${phase}** phase, produce a reliability and operations document that includes:\n` +
        `1. SLOs and SLIs for this phase\n` +
        `2. Incident response procedures\n` +
        `3. Capacity and scaling considerations\n` +
        `4. Alerting thresholds and runbooks\n` +
        `5. Post-incident review template\n\n` +
        `Format your output as a well-structured Markdown reliability document.`
      );

    default:
      return (
        `For the **${phase}** phase, produce a comprehensive document covering:\n` +
        `1. Overview and objectives for this phase\n` +
        `2. Key deliverables and outputs\n` +
        `3. Dependencies and prerequisites\n` +
        `4. Risks and mitigations\n` +
        `5. Success criteria\n\n` +
        `Format your output as a well-structured Markdown document.`
      );
  }
}
