/**
 * Workflow Orchestrator - Replaces n8n functionality with code
 * Shows how to achieve the same LLM control and agent orchestration
 */

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { getSharedServices } from '../src/shared-services.js';

// Same LLM control you have in n8n, but in code
class LLMController {
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async callLLM(config: {
    provider: 'openai' | 'anthropic' | 'ollama';
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const { provider, model, prompt, temperature = 0.7, maxTokens = 2000 } = config;

    switch (provider) {
      case 'openai':
        const openaiResponse = await this.openai.chat.completions.create({
          model: model, // "gpt-4", "gpt-3.5-turbo", etc.
          temperature,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        });
        return openaiResponse.choices[0].message.content;

      case 'anthropic':
        const anthropicResponse = await this.anthropic.messages.create({
          model: model, // "claude-3-5-sonnet-20241022", etc.
          temperature,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        });
        return anthropicResponse.content[0].text;

      case 'ollama':
        // Local LLM via Ollama API
        const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model, // "llama3", "codellama", etc.
            messages: [{ role: 'user', content: prompt }],
            options: { temperature }
          })
        });
        return (await ollamaResponse.json()).message.content;

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}

// Workflow Orchestrator - Replaces n8n workflow engine
class WorkflowOrchestrator {
  private llm: LLMController;

  constructor() {
    this.llm = new LLMController();
  }

  /**
   * Execute Idea Categorization Workflow
   * This replaces your n8n workflow with the exact same functionality
   */
  async executeIdeaCategorization(config: {
    sourceDatabase: string;
    limit: number;
    llmProvider: 'openai' | 'anthropic' | 'ollama';
    llmModel: string;
    temperature?: number;
  }) {
    console.log('🚀 Starting idea categorization workflow...');
    
    try {
      // Step 1: Get ideas from Notion (same as n8n node)
      console.log('📖 Step 1: Getting ideas from Notion...');
      const { templateManager, contextManager, agentCommunicator } = getSharedServices();
      
      const ideas = await this.callNotionAgent('get_ideas', {
        limit: config.limit,
        database_id: config.sourceDatabase
      });

      // Step 2: LLM Categorization (same control as n8n)
      console.log('🧠 Step 2: Categorizing with LLM...');
      const categorizationPrompt = `
        Analyze and categorize these ideas:
        ${JSON.stringify(ideas, null, 2)}
        
        For each idea, determine:
        1. Category (project, knowledge, journal)  
        2. Priority (high, medium, low)
        3. Actionable (yes/no)
        4. Tags (max 3)
        
        Return as JSON array.
      `;

      const categorizedIdeas = await this.llm.callLLM({
        provider: config.llmProvider,
        model: config.llmModel,
        prompt: categorizationPrompt,
        temperature: config.temperature || 0.7
      });

      // Step 3: Use Director MCP Server (same as n8n call)
      console.log('🎯 Step 3: Using Director for orchestration...');
      const directorResult = await this.callDirectorMCP('execute_workflow', {
        workflow_type: 'idea_categorization',
        target_agent: 'notion',
        parameters: {
          categorized_ideas: JSON.parse(categorizedIdeas),
          source_database_id: config.sourceDatabase
        }
      });

      // Step 4: Process results and update databases
      console.log('💾 Step 4: Updating databases...');
      const finalResults = await this.processResults(directorResult);

      console.log('✅ Workflow completed successfully!');
      return {
        success: true,
        processed_ideas: finalResults.processed_ideas,
        operations_completed: finalResults.operations_completed,
        execution_time: finalResults.execution_time
      };

    } catch (error) {
      console.error('❌ Workflow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        partial_results: null
      };
    }
  }

  /**
   * Call Notion Agent (replaces n8n HTTP node to Notion agent)
   */
  private async callNotionAgent(tool: string, params: any) {
    const response = await fetch('http://localhost:3001/api/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params })
    });
    return response.json();
  }

  /**
   * Call Director MCP Server (replaces n8n HTTP node to Director)
   */
  private async callDirectorMCP(tool: string, params: any) {
    const { templateManager, contextManager, agentCommunicator } = getSharedServices();
    
    switch (tool) {
      case 'execute_workflow':
        const context = contextManager.createWorkflowContext(
          params.workflow_type, 
          params.parameters
        );
        
        const instructions = await templateManager.createAgentInstructions({
          workflow_type: params.workflow_type,
          target_agent: params.target_agent,
          parameters: params.parameters
        });
        
        return await agentCommunicator.sendInstructionsToAgent(
          params.target_agent, 
          instructions
        );
      
      default:
        throw new Error(`Unknown Director tool: ${tool}`);
    }
  }

  /**
   * Process workflow results
   */
  private async processResults(directorResult: any) {
    // Same result processing logic you'd have in n8n
    return {
      processed_ideas: directorResult.data?.agent_response?.results?.ideas_processed || [],
      operations_completed: directorResult.data?.agent_response?.results?.operations_completed || [],
      execution_time: directorResult.data?.agent_response?.execution_time_ms || 0
    };
  }

  /**
   * Create Custom Workflow (equivalent to building n8n workflow)
   */
  async createCustomWorkflow(steps: Array<{
    type: 'llm' | 'agent' | 'director' | 'logic';
    config: any;
  }>) {
    const results = [];
    let previousOutput = null;

    for (const step of steps) {
      switch (step.type) {
        case 'llm':
          previousOutput = await this.llm.callLLM({
            ...step.config,
            prompt: this.interpolate(step.config.prompt, previousOutput)
          });
          break;

        case 'agent':
          previousOutput = await this.callNotionAgent(
            step.config.tool, 
            step.config.params
          );
          break;

        case 'director':
          previousOutput = await this.callDirectorMCP(
            step.config.tool,
            step.config.params
          );
          break;

        case 'logic':
          previousOutput = step.config.function(previousOutput);
          break;
      }
      
      results.push(previousOutput);
    }

    return results;
  }

  /**
   * Template interpolation (like n8n's {{}} syntax)
   */
  private interpolate(template: string, data: any): string {
    if (!data) return template;
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }
}

// Example usage - this would replace your n8n workflow
async function main() {
  const orchestrator = new WorkflowOrchestrator();

  // Same workflow as n8n, but in code
  const result = await orchestrator.executeIdeaCategorization({
    sourceDatabase: 'your-notion-database-id',
    limit: 5,
    llmProvider: 'openai',      // or 'anthropic', 'ollama'
    llmModel: 'gpt-4',          // or 'claude-3-5-sonnet', 'llama3'
    temperature: 0.7
  });

  console.log('Workflow result:', result);

  // Or create completely custom workflow
  const customResult = await orchestrator.createCustomWorkflow([
    {
      type: 'agent',
      config: { tool: 'get_ideas', params: { limit: 3 } }
    },
    {
      type: 'llm',
      config: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        prompt: 'Summarize these ideas: {{data}}',
        temperature: 0.5
      }
    },
    {
      type: 'logic',
      config: {
        function: (data) => ({ summary: data, processed_at: new Date() })
      }
    }
  ]);

  console.log('Custom workflow result:', customResult);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { WorkflowOrchestrator, LLMController };
