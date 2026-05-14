import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkspaceConfigService } from '../config/workspace-config.service';

export interface DemoStatus {
  loaded: boolean;
  entityCounts: {
    agents: number;
    skills: number;
    pipelines: number;
    workItems: number;
  };
}

export interface DemoEntities {
  agents: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  pipeline: { id: string; name: string };
  workItems: Array<{ id: string; title: string }>;
}

@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceConfigService: WorkspaceConfigService,
  ) {}

  /**
   * Creates a full SDLC pipeline with 4 agents, associated skills,
   * a pipeline chaining them, 6 sample epic work items, and generates workspace.yaml.
   */
  async loadDemo(projectId: string): Promise<DemoEntities> {
    // Check if demo is already loaded
    const status = await this.getStatus(projectId);
    if (status.loaded) {
      throw new ConflictException({
        error: 'WORKSPACE_EXISTS',
        message: 'Demo project is already loaded. Use merge/replace options to modify.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create 4 skills
      const skillDefinitions = [
        {
          name: 'requirements-analysis',
          description: 'Analyzes requirements and produces structured user stories',
          content: '---\nname: requirements-analysis\ndescription: Analyzes requirements and produces structured user stories\ninputs:\n  - name: epic_description\n    type: string\n    description: The epic or feature description to analyze\noutputs:\n  - name: user_stories\n    type: markdown\n    description: Structured user stories derived from requirements\n---\n\n## Prompt Template\n\nYou are a senior Business Analyst. Analyze the following epic description and produce structured user stories:\n\n{{epic_description}}\n\nFor each user story, provide:\n1. Title\n2. As a [role], I want [feature], so that [benefit]\n3. Acceptance criteria\n4. Estimated complexity (S/M/L/XL)',
        },
        {
          name: 'code-generation',
          description: 'Generates implementation code from specifications',
          content: '---\nname: code-generation\ndescription: Generates implementation code from specifications\ninputs:\n  - name: specification\n    type: string\n    description: The technical specification to implement\n  - name: language\n    type: string\n    description: Target programming language\noutputs:\n  - name: implementation\n    type: code\n    description: Generated implementation code\n---\n\n## Prompt Template\n\nYou are a senior Software Developer. Implement the following specification in {{language}}:\n\n{{specification}}\n\nEnsure the code:\n1. Follows best practices and design patterns\n2. Includes proper error handling\n3. Is well-documented with comments\n4. Is testable and modular',
        },
        {
          name: 'test-execution',
          description: 'Executes tests and reports results with coverage metrics',
          content: '---\nname: test-execution\ndescription: Executes tests and reports results with coverage metrics\ninputs:\n  - name: code_under_test\n    type: string\n    description: The code to test\n  - name: test_type\n    type: string\n    description: Type of testing (unit, integration, e2e)\noutputs:\n  - name: test_results\n    type: markdown\n    description: Test execution results with pass/fail status\n---\n\n## Prompt Template\n\nYou are a senior QA Engineer. Create and execute {{test_type}} tests for the following code:\n\n{{code_under_test}}\n\nProvide:\n1. Test cases with descriptions\n2. Expected vs actual results\n3. Coverage analysis\n4. Identified defects or edge cases',
        },
        {
          name: 'deployment-automation',
          description: 'Automates deployment processes and infrastructure management',
          content: '---\nname: deployment-automation\ndescription: Automates deployment processes and infrastructure management\ninputs:\n  - name: artifacts\n    type: string\n    description: Build artifacts to deploy\n  - name: environment\n    type: string\n    description: Target deployment environment\noutputs:\n  - name: deployment_report\n    type: markdown\n    description: Deployment status and verification report\n---\n\n## Prompt Template\n\nYou are a senior DevOps Engineer. Deploy the following artifacts to {{environment}}:\n\n{{artifacts}}\n\nProvide:\n1. Deployment steps executed\n2. Health check results\n3. Rollback plan if needed\n4. Post-deployment verification',
        },
      ];

      const createdSkills = [];
      for (let i = 0; i < skillDefinitions.length; i++) {
        const skillDef = skillDefinitions[i];
        const skill = await tx.skill.create({
          data: {
            projectId,
            name: skillDef.name,
            description: skillDef.description,
            content: skillDef.content,
            displayOrder: i,
          },
        });
        createdSkills.push(skill);
      }

      // 2. Create 4 agent profiles
      const agentDefinitions = [
        {
          name: 'BA Agent',
          role: 'BA' as const,
          description: 'Analyzes requirements and produces user stories',
          skillSet: ['requirements-analysis'],
          supportedPhases: ['requirements', 'analysis'],
          skillIndex: 0,
        },
        {
          name: 'Dev Agent',
          role: 'Dev' as const,
          description: 'Implements features based on specifications',
          skillSet: ['code-generation'],
          supportedPhases: ['development', 'implementation'],
          skillIndex: 1,
        },
        {
          name: 'QA Agent',
          role: 'QA' as const,
          description: 'Tests implementations and reports defects',
          skillSet: ['test-execution'],
          supportedPhases: ['testing', 'verification'],
          skillIndex: 2,
        },
        {
          name: 'DevOps Agent',
          role: 'DevOps' as const,
          description: 'Handles deployment and infrastructure automation',
          skillSet: ['deployment-automation'],
          supportedPhases: ['deployment', 'operations'],
          skillIndex: 3,
        },
      ];

      const createdAgents = [];
      for (const agentDef of agentDefinitions) {
        const agent = await tx.agentProfile.create({
          data: {
            projectId,
            name: agentDef.name,
            role: agentDef.role,
            description: agentDef.description,
            skillSet: agentDef.skillSet,
            supportedPhases: agentDef.supportedPhases,
          },
        });

        // Create agent-skill association
        await tx.agentSkill.create({
          data: {
            agentProfileId: agent.id,
            skillId: createdSkills[agentDef.skillIndex].id,
          },
        });

        createdAgents.push(agent);
      }

      // 3. Create 1 pipeline: "SDLC Pipeline" with 4 steps
      const pipeline = await tx.pipeline.create({
        data: {
          projectId,
          name: 'SDLC Pipeline',
          description: 'Full software development lifecycle pipeline',
          displayOrder: 0,
          steps: {
            create: createdAgents.map((agent, index) => ({
              agentProfileId: agent.id,
              stepOrder: index,
              onFailure: 'stop',
            })),
          },
        },
      });

      // 4. Create 6 sample work items
      const workItemDefinitions = [
        {
          externalId: 'DEMO-1',
          title: 'User Authentication',
          type: 'EPIC',
          status: 'To Do',
          priority: 'HIGH',
          labels: ['security', 'core'],
        },
        {
          externalId: 'DEMO-2',
          title: 'Payment Integration',
          type: 'EPIC',
          status: 'To Do',
          priority: 'HIGH',
          labels: ['payments', 'integration'],
        },
        {
          externalId: 'DEMO-3',
          title: 'Dashboard Redesign',
          type: 'EPIC',
          status: 'To Do',
          priority: 'MEDIUM',
          labels: ['ui', 'design'],
        },
        {
          externalId: 'DEMO-4',
          title: 'API Rate Limiting',
          type: 'EPIC',
          status: 'To Do',
          priority: 'MEDIUM',
          labels: ['api', 'performance'],
        },
        {
          externalId: 'DEMO-5',
          title: 'Mobile Push Notifications',
          type: 'EPIC',
          status: 'To Do',
          priority: 'LOW',
          labels: ['mobile', 'notifications'],
        },
        {
          externalId: 'DEMO-6',
          title: 'Data Export Feature',
          type: 'EPIC',
          status: 'To Do',
          priority: 'LOW',
          labels: ['data', 'export'],
        },
      ];

      const createdWorkItems = [];
      for (const wiDef of workItemDefinitions) {
        const workItem = await tx.workItem.create({
          data: {
            projectId,
            externalId: wiDef.externalId,
            title: wiDef.title,
            type: wiDef.type,
            status: wiDef.status,
            priority: wiDef.priority,
            labels: wiDef.labels,
          },
        });
        createdWorkItems.push(workItem);
      }

      // 5. Set up workspace config with slash commands
      const slashCommands = [
        {
          name: '/run-pipeline',
          description: 'Execute the SDLC pipeline on an epic',
          action: 'epic-run:create',
        },
        {
          name: '/inspect',
          description: 'Run workspace inspector',
          action: 'workspace:inspect',
        },
        {
          name: '/status',
          description: 'Show workspace status',
          action: 'workspace:status',
        },
      ];

      const existingConfig = await tx.workspaceConfig.findUnique({
        where: { projectId },
      });

      if (existingConfig) {
        await tx.workspaceConfig.update({
          where: { projectId },
          data: { slashCommands: slashCommands as any },
        });
      } else {
        await tx.workspaceConfig.create({
          data: {
            projectId,
            slashCommands: slashCommands as any,
            metadata: {},
          },
        });
      }

      return {
        agents: createdAgents.map((a) => ({ id: a.id, name: a.name })),
        skills: createdSkills.map((s) => ({ id: s.id, name: s.name })),
        pipeline: { id: pipeline.id, name: pipeline.name },
        workItems: createdWorkItems.map((w) => ({ id: w.id, title: w.title })),
      };
    });

    // Generate workspace.yaml after transaction completes
    await this.workspaceConfigService.generateYaml(projectId);

    return result;
  }

  /**
   * Checks if demo is already loaded (returns { loaded: boolean, entityCounts }).
   */
  async getStatus(projectId: string): Promise<DemoStatus> {
    const [agentCount, skillCount, pipelineCount, workItemCount] =
      await Promise.all([
        this.prisma.agentProfile.count({ where: { projectId } }),
        this.prisma.skill.count({ where: { projectId } }),
        this.prisma.pipeline.count({ where: { projectId } }),
        this.prisma.workItem.count({ where: { projectId } }),
      ]);

    const loaded =
      agentCount > 0 || skillCount > 0 || pipelineCount > 0 || workItemCount > 0;

    return {
      loaded,
      entityCounts: {
        agents: agentCount,
        skills: skillCount,
        pipelines: pipelineCount,
        workItems: workItemCount,
      },
    };
  }
}
