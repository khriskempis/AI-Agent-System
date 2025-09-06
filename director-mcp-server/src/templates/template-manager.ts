/**
 * Template Manager - Handles loading, processing, and caching of workflow templates
 * Core component for extracting essential logic from templates and creating agent instructions
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  WorkflowTemplate,
  DirectorToAgentInstruction,
  TemplateProcessingOptions,
  ExtractedInstructions,
  MCPToolResult,
  CategorizationMethodology,
  DatabaseExecution,
  ContentProcessing
} from '../types/workflow';

export class TemplateManager {
  private templateCache: Map<string, WorkflowTemplate> = new Map();
  private templateDirectory: string;
  private registryPath: string;

  constructor() {
    // Point to the workflow templates directory (Docker volume mount)
    this.templateDirectory = path.join(process.cwd(), 'director-mcp/workflow-templates');
    this.registryPath = path.join(this.templateDirectory, 'template-registry.json');
    this.loadTemplateRegistry();
  }

  /**
   * MCP Tool: Get Workflow Template
   * Main entry point for Director Agent to get workflow templates
   */
  async getWorkflowTemplate(workflowType: string, parameters?: Record<string, any>): Promise<MCPToolResult> {
    try {
      logger.info(`Loading workflow template: ${workflowType}`, { parameters });

      const template = await this.loadTemplate(workflowType);
      if (!template) {
        return {
          success: false,
          error: `Workflow template not found: ${workflowType}`,
          metadata: { available_templates: this.getAvailableTemplateTypes() }
        };
      }

      // Template loaded successfully
      return {
        success: true,
        data: template,
        metadata: {
          template_id: template.workflow_id,
          version: template.version,
          phases: template.phases.length,
          cache_hit: this.templateCache.has(workflowType)
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error loading workflow template', { workflowType, error: errorMessage });
      return {
        success: false,
        error: `Failed to load template: ${errorMessage}`
      };
    }
  }

  /**
   * Create Agent Instructions
   * Extracts essential logic from template and creates focused JSON instructions
   */
  async createAgentInstructions(options: TemplateProcessingOptions): Promise<DirectorToAgentInstruction> {
    const { workflow_type, parameters, target_agent, phase_override } = options;

    logger.info('Creating agent instructions', { workflow_type, target_agent, phase_override });

    // Load the template
    const template = await this.loadTemplate(workflow_type);
    if (!template) {
      throw new Error(`Template not found: ${workflow_type}`);
    }

    // Find the appropriate phase for the target agent
    const targetPhase = phase_override 
      ? template.phases.find(p => p.phase_id === phase_override)
      : template.phases.find(p => p.agent === target_agent);

    if (!targetPhase) {
      throw new Error(`No phase found for agent: ${target_agent} in workflow: ${workflow_type}`);
    }

    // Extract essential instructions
    const extractedInstructions = this.extractInstructions(template, targetPhase, parameters);

    // Build the instruction object
    const instruction: DirectorToAgentInstruction = {
      agent_id: target_agent,
      task_id: this.generateTaskId(workflow_type, target_agent),
      workflow_id: template.workflow_id,
      phase: targetPhase.phase_id,
      timestamp: new Date().toISOString(),
      instruction: extractedInstructions.core_instruction,
      execution_requirements: extractedInstructions.execution_requirements,
      context_reference: {
        workflow_iteration: parameters?.iteration || 1,
        shared_context_id: parameters?.context_id || this.generateContextId()
      }
    };

    // Add methodology sections based on task type
    if (extractedInstructions.methodology_sections.categorization) {
      instruction.categorization_methodology = extractedInstructions.methodology_sections.categorization;
    }

    if (extractedInstructions.methodology_sections.database_execution) {
      instruction.database_execution = extractedInstructions.methodology_sections.database_execution;
    }

    if (extractedInstructions.methodology_sections.content_processing) {
      instruction.content_processing = extractedInstructions.methodology_sections.content_processing;
    }

    logger.info('Agent instructions created successfully', {
      task_id: instruction.task_id,
      instruction_size: JSON.stringify(instruction).length,
      methodology_sections: Object.keys(extractedInstructions.methodology_sections)
    });

    return instruction;
  }

  /**
   * Extract Instructions from Template
   * Core logic for extracting essential sections from large templates
   */
  private extractInstructions(
    template: WorkflowTemplate, 
    phase: any, 
    parameters: Record<string, any>
  ): ExtractedInstructions {

    // Extract core instruction
    const core_instruction = {
      task_type: phase.agent_instructions.task_type,
      objective: phase.agent_instructions.behavior,
      ...this.populateParameters(phase.agent_instructions.parameters, parameters)
    };

    // Extract methodology sections based on task type
    const methodology_sections: any = {};

    if (phase.agent_instructions.task_type.includes('categorization')) {
      methodology_sections.categorization = this.extractCategorizationMethodology(phase, parameters);
    }

    if (phase.agent_instructions.task_type.includes('database') || 
        phase.agent_instructions.task_type.includes('update')) {
      methodology_sections.database_execution = this.extractDatabaseExecution(phase, parameters);
    }

    if (phase.agent_instructions.task_type.includes('content')) {
      methodology_sections.content_processing = this.extractContentProcessing(phase, parameters);
    }

    // Extract execution requirements
    const execution_requirements = {
      required_tools: phase.agent_instructions.required_tools,
      timeout_seconds: phase.timeout_seconds,
      response_format: phase.agent_instructions.expected_output_format,
      processing_approach: phase.agent_instructions.parameters?.processing_approach || 
                          'Execute task according to provided methodology'
    };

    return {
      core_instruction,
      methodology_sections,
      execution_requirements,
      dynamic_parameters: parameters
    };
  }

  /**
   * Extract Categorization Methodology
   */
  private extractCategorizationMethodology(phase: any, parameters: Record<string, any>): CategorizationMethodology {
    const params = phase.agent_instructions.parameters;
    
    return {
      multi_idea_parsing_rules: [
        "Paragraph Separation: Each paragraph may contain a distinct idea",
        "Empty Block Delimiter: Extra empty blocks separate ideas", 
        "Link + Description Grouping: Text above links describes that link",
        "Topic Shift Detection: Identify complete topic changes",
        "Context Preservation: Maintain original meaning and intent"
      ],
      database_routing_criteria: this.populateParameters(params.categorization_rules || {}, parameters),
      tagging_rules: {
        max_tags: params.tagging_config?.max_tags || 3,
        predefined_only: params.tagging_config?.predefined_only || true,
        available_tags: params.tagging_config?.tag_list || [],
        selection_criteria: "Choose tags that best describe content type, domain, or purpose - most relevant first"
      },
      analysis_requirements: {
        assess_actionability: "Determine if idea requires action (Yes/No)",
        evaluate_reference_value: "Rate reference value (High/Medium/Low)",
        identify_personal_insight: "Check if contains personal thoughts (Yes/No)",
        assign_priority: "Set priority level (High/Medium/Low)",
        provide_reasoning: "Explain categorization decision in 1-2 sentences"
      }
    };
  }

  /**
   * Extract Database Execution Instructions
   */
  private extractDatabaseExecution(phase: any, parameters: Record<string, any>): DatabaseExecution {
    return {
      operations: parameters.operations || [],
      validation_rules: {
        verify_creation: "Confirm page was created successfully",
        check_properties: "Validate all required properties are set",
        handle_duplicates: "Check for existing pages with same title"
      }
    };
  }

  /**
   * Extract Content Processing Rules
   */
  private extractContentProcessing(phase: any, parameters: Record<string, any>): ContentProcessing {
    return {
      parsing_rules: [
        "Extract key information from content",
        "Identify actionable items vs reference material",
        "Preserve context and relationships"
      ],
      transformation_rules: [
        "Convert unstructured content to structured format",
        "Apply consistent formatting and tags",
        "Enhance with metadata and classifications"
      ]
    };
  }

  /**
   * Populate Template Parameters
   * Replace template variables with actual values
   */
  private populateParameters(templateParams: any, runtimeParams: Record<string, any>): any {
    if (!templateParams) return {};

    const populated = JSON.parse(JSON.stringify(templateParams));
    
    // Replace template variables like {{workflow.context.database_ids.ideas}}
    const replacements = {
      'workflow.context.database_ids.ideas': runtimeParams.source_database_id,
      'workflow.context.database_ids.projects': runtimeParams.projects_database_id,
      'workflow.context.database_ids.knowledge': runtimeParams.knowledge_database_id,
      'workflow.context.database_ids.journal': runtimeParams.journal_database_id,
      'workflow.parameters.idea_limit': runtimeParams.limit || 5,
      ...runtimeParams
    };

    return this.replaceTemplateVariables(populated, replacements);
  }

  /**
   * Replace Template Variables
   */
  private replaceTemplateVariables(obj: any, replacements: Record<string, any>): any {
    if (typeof obj === 'string') {
      // Replace {{variable}} patterns
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const value = replacements[variable.trim()];
        return value !== undefined ? value : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceTemplateVariables(item, replacements));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceTemplateVariables(value, replacements);
      }
      return result;
    }

    return obj;
  }

  /**
   * Load Template from File System
   */
  private async loadTemplate(workflowType: string): Promise<WorkflowTemplate | null> {
    // Check cache first
    if (this.templateCache.has(workflowType)) {
      logger.debug(`Template cache hit: ${workflowType}`);
      return this.templateCache.get(workflowType)!;
    }

    try {
      // Load template registry to find template file
      const registry = await this.loadTemplateRegistry();
      const templateInfo = registry.templates[workflowType];
      
      if (!templateInfo) {
        logger.warn(`Template not found in registry: ${workflowType}`);
        return null;
      }

      // Load template file
      const templatePath = path.join(this.templateDirectory, templateInfo.file_path);
      const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
      const template: WorkflowTemplate = JSON.parse(templateContent);

      // Cache the template
      this.templateCache.set(workflowType, template);
      
      logger.info(`Template loaded successfully: ${workflowType}`, {
        template_id: template.workflow_id,
        version: template.version,
        phases: template.phases.length
      });

      return template;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error loading template: ${workflowType}`, { error: errorMessage });
      return null;
    }
  }

  /**
   * Load Template Registry
   */
  private async loadTemplateRegistry(): Promise<any> {
    try {
      const registryContent = await fs.promises.readFile(this.registryPath, 'utf-8');
      return JSON.parse(registryContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error loading template registry', { error: errorMessage });
      throw new Error('Failed to load template registry');
    }
  }

  /**
   * Get Available Template Types
   */
  private getAvailableTemplateTypes(): string[] {
    try {
      const registry = require(this.registryPath);
      return Object.keys(registry.templates || {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting available template types', { error: errorMessage });
      return [];
    }
  }

  /**
   * Generate Task ID
   */
  private generateTaskId(workflowType: string, agentId: string): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = uuidv4().slice(0, 8);
    return `${workflowType}_${agentId}_${timestamp}_${shortId}`;
  }

  /**
   * Generate Context ID
   */
  private generateContextId(): string {
    return `ctx_${uuidv4()}`;
  }

  /**
   * Clear Template Cache
   */
  clearCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  /**
   * Get Cache Stats
   */
  getCacheStats(): { size: number; templates: string[] } {
    return {
      size: this.templateCache.size,
      templates: Array.from(this.templateCache.keys())
    };
  }
}
