/**
 * Type definitions for Director MCP Server
 * Defines all interfaces for workflow templates, agent communication, and context management
 */

// ============================================================================
// WORKFLOW TEMPLATE TYPES
// ============================================================================

export interface WorkflowTemplate {
  workflow_id: string;
  workflow_name: string;
  workflow_type: string;
  version: string;
  created_date: string;
  description: string;
  phases: WorkflowPhase[];
  workflow_context: WorkflowContext;
  debugging_properties: DebuggingProperties;
  mcp_tool_compatibility: MCPToolCompatibility;
  validation_schema: ValidationSchema;
}

export interface WorkflowPhase {
  phase_id: string;
  phase_name: string;
  sequence: number;
  agent: string;
  timeout_seconds: number;
  retry_attempts: number;
  agent_instructions: AgentInstructions;
  expected_output_schema: any;
  error_handling: ErrorHandling;
  success_criteria: SuccessCriteria;
}

export interface AgentInstructions {
  task_type: string;
  behavior: string;
  prompt_reference: string;
  full_prompt: string;
  required_tools: string[];
  parameters: any;
  expected_output_format: string;
  context_logging: ContextLogging;
}

// ============================================================================
// AGENT COMMUNICATION TYPES
// ============================================================================

export interface DirectorToAgentInstruction {
  agent_id: string;
  task_id: string;
  workflow_id?: string;
  phase?: string;
  timestamp: string;
  instruction: TaskInstruction;
  categorization_methodology?: CategorizationMethodology;
  database_execution?: DatabaseExecution;
  content_processing?: ContentProcessing;
  execution_requirements?: ExecutionRequirements;
  context_reference?: ContextReference;
}

export interface TaskInstruction {
  task_type: string;
  objective: string;
  source_database_id?: string;
  limit?: number;
  status_filter?: string;
  [key: string]: any;
}

export interface CategorizationMethodology {
  multi_idea_parsing_rules: string[];
  database_routing_criteria: Record<string, DatabaseRoutingCriteria>;
  tagging_rules: TaggingRules;
  analysis_requirements: Record<string, string>;
}

export interface DatabaseRoutingCriteria {
  database_id: string;
  description: string;
  keywords: string[];
  criteria: string;
  examples: string[];
}

export interface TaggingRules {
  max_tags: number;
  predefined_only: boolean;
  available_tags: string[];
  selection_criteria: string;
}

export interface DatabaseExecution {
  operations: DatabaseOperation[];
  validation_rules?: Record<string, string>;
}

export interface DatabaseOperation {
  action: 'create_page' | 'update_page' | 'delete_page';
  target_database_id: string;
  page_id: string;
  properties: Record<string, any>;
}

export interface ContentProcessing {
  parsing_rules: string[];
  transformation_rules: string[];
}

export interface ExecutionRequirements {
  required_tools: string[];
  timeout_seconds: number;
  response_format: string;
  processing_approach?: string;
}

export interface ContextReference {
  previous_results?: string;
  workflow_iteration?: number;
  shared_context_id?: string;
}

// ============================================================================
// AGENT RESPONSE TYPES
// ============================================================================

export interface AgentToDirectorResponse {
  agent_id: string;
  task_id: string;
  phase: string;
  timestamp: string;
  execution_time_ms: number;
  results: AgentResults;
  status: AgentStatus;
  context_updates: ContextUpdates;
}

export interface AgentResults {
  ideas_processed?: ProcessedIdea[];
  operations_completed?: CompletedOperation[];
  processed_content?: any;
  summary: ResultSummary;
  [key: string]: any;
}

export interface ProcessedIdea {
  idea_id: string;
  title: string;
  content?: string;
  target_database: string;
  target_database_id: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  actionable?: boolean;
  reference_value?: 'high' | 'medium' | 'low';
  personal_insight?: boolean;
  metadata?: any;
}

export interface CompletedOperation {
  operation_id: string;
  action: string;
  target_database_id: string;
  created_page_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
}

export interface ResultSummary {
  total_processed?: number;
  total_operations?: number;
  successful?: number;
  failed?: number;
  projects?: number;
  knowledge?: number;
  journal?: number;
  [key: string]: any;
}

export interface AgentStatus {
  success: boolean;
  errors: string[];
  next_phase: string;
}

export interface ContextUpdates {
  api_calls: number;
  tools_used: string[];
  performance_notes: string;
  debug_info?: any;
}

// ============================================================================
// WORKFLOW CONTEXT TYPES
// ============================================================================

export interface SharedWorkflowContext {
  context_id: string;
  workflow_id: string;
  current_phase: string;
  iteration: number;
  started_at: string;
  updated_at: string;
  phase_results: Record<string, PhaseResult>;
  workflow_state: WorkflowState;
  performance_metrics: PerformanceMetrics;
  error_log: ErrorEntry[];
}

export interface PhaseResult {
  agent: string;
  completed_at: string;
  status: 'success' | 'failed' | 'timeout';
  execution_time_ms: number;
  results_summary: any;
  next_action: string;
  error_details?: string;
}

export interface WorkflowState {
  databases_involved: string[];
  total_operations: number;
  error_count: number;
  current_agents: string[];
  pending_tasks: string[];
}

export interface PerformanceMetrics {
  total_execution_time_ms: number;
  api_calls_total: number;
  token_usage_estimate: number;
  agent_response_times: Record<string, number>;
  bottlenecks: string[];
}

export interface ErrorEntry {
  timestamp: string;
  error_type: string;
  error_message: string;
  context: any;
  suggested_action: string;
  agent_id?: string;
  phase?: string;
}

// ============================================================================
// TEMPLATE PROCESSING TYPES
// ============================================================================

export interface TemplateProcessingOptions {
  workflow_type: string;
  parameters: Record<string, any>;
  target_agent: string;
  phase_override?: string;
}

export interface ExtractedInstructions {
  core_instruction: TaskInstruction;
  methodology_sections: any;
  execution_requirements: ExecutionRequirements;
  dynamic_parameters: Record<string, any>;
}

// ============================================================================
// MCP TOOL TYPES
// ============================================================================

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: any;
}

export interface WorkflowTemplateRequest {
  workflow_type: string;
  parameters?: Record<string, any>;
  cache_duration?: number;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface WorkflowContext {
  required_database_ids: Record<string, string>;
  shared_data_structure: Record<string, string>;
  context_preservation: {
    maintain_across_phases: boolean;
    log_all_operations: boolean;
    include_debug_info: boolean;
  };
}

export interface DebuggingProperties {
  log_level: string;
  capture_api_responses: boolean;
  track_token_usage: boolean;
  performance_monitoring: boolean;
  error_stack_traces: boolean;
  validation_checkpoints: string[];
}

export interface MCPToolCompatibility {
  tool_endpoint: string;
  required_parameters: string[];
  optional_parameters: string[];
  return_format: string;
  cache_duration: number;
}

export interface ValidationSchema {
  input_validation: any;
  output_validation: any;
}

export interface ErrorHandling {
  timeout_action: string;
  api_error_action: string;
  validation_error_action: string;
  required_error_fields: string[];
}

export interface SuccessCriteria {
  minimum_ideas_processed?: number;
  required_fields_present: string[];
  valid_json_structure: boolean;
  all_ideas_categorized?: boolean;
}

export interface ContextLogging {
  log_level: string;
  include_api_responses: boolean;
  track_performance: boolean;
}
