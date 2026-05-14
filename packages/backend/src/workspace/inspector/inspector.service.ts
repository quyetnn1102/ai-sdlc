import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkspaceConfigService } from '../config/workspace-config.service';
import { parse as yamlParse } from 'yaml';

export interface InspectError {
  line: number;
  message: string;
}

export interface InspectWarning {
  variable: string;
  message: string;
}

export interface InspectSummary {
  agents: number;
  skills: number;
  pipelines: number;
  slashCommands: number;
}

export interface InspectResult {
  valid: boolean;
  resolvedYaml: string;
  errors: InspectError[];
  warnings: InspectWarning[];
  summary: InspectSummary;
}

@Injectable()
export class InspectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceConfigService: WorkspaceConfigService,
  ) {}

  /**
   * Inspect the workspace configuration:
   * 1. Retrieve or generate workspace.yaml from DB
   * 2. Parse and validate against schema
   * 3. Resolve environment variables (${VAR_NAME} substitution)
   * 4. Return structured result with errors, warnings, and summary
   */
  async inspect(projectId: string): Promise<InspectResult> {
    const errors: InspectError[] = [];
    const warnings: InspectWarning[] = [];

    // Get the workspace config (which may have cached YAML)
    const config = await this.prisma.workspaceConfig.findUnique({
      where: { projectId },
    });

    let yamlContent = config?.yamlContent ?? null;

    // If no cached YAML, generate it
    if (!yamlContent) {
      yamlContent = await this.workspaceConfigService.generateYaml(projectId);
    }

    // Parse the YAML
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = yamlParse(yamlContent);
    } catch (e: any) {
      const lineMatch = e.message?.match(/at line (\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
      errors.push({
        line,
        message: e.message ?? 'Failed to parse YAML',
      });

      return {
        valid: false,
        resolvedYaml: yamlContent,
        errors,
        warnings,
        summary: { agents: 0, skills: 0, pipelines: 0, slashCommands: 0 },
      };
    }

    // Validate basic schema structure
    if (!parsed || typeof parsed !== 'object') {
      errors.push({ line: 1, message: 'YAML root must be an object' });
      return {
        valid: false,
        resolvedYaml: yamlContent,
        errors,
        warnings,
        summary: { agents: 0, skills: 0, pipelines: 0, slashCommands: 0 },
      };
    }

    // Validate required top-level fields
    if (!parsed.version) {
      errors.push({ line: 1, message: 'Missing required field: version' });
    }

    // Resolve environment variables
    const { resolved, unresolvedVars } = this.resolveEnvVars(yamlContent);

    // Collect warnings for unresolved variables
    for (const varName of unresolvedVars) {
      warnings.push({
        variable: varName,
        message: `Environment variable "${varName}" is not defined`,
      });
    }

    // Build summary from parsed content
    const agents = Array.isArray(parsed.agents) ? parsed.agents : [];
    const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    const pipelines = Array.isArray(parsed.pipelines) ? parsed.pipelines : [];
    const slashCommands = Array.isArray(parsed.slashCommands)
      ? parsed.slashCommands
      : [];

    const summary: InspectSummary = {
      agents: agents.length,
      skills: skills.length,
      pipelines: pipelines.length,
      slashCommands: slashCommands.length,
    };

    return {
      valid: errors.length === 0,
      resolvedYaml: resolved,
      errors,
      warnings,
      summary,
    };
  }

  /**
   * Resolve all ${VAR_NAME} patterns in the YAML string.
   * Substitutes with process.env values where available.
   * Returns the resolved string and a list of unresolved variable names.
   */
  private resolveEnvVars(yamlContent: string): {
    resolved: string;
    unresolvedVars: string[];
  } {
    const unresolvedVars: string[] = [];
    const envVarPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

    const resolved = yamlContent.replace(envVarPattern, (match, varName: string) => {
      const value = process.env[varName];
      if (value !== undefined) {
        return value;
      }
      unresolvedVars.push(varName);
      return match; // Leave unresolved variables as-is
    });

    return { resolved, unresolvedVars };
  }
}
