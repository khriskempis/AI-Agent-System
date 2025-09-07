/**
 * Shared Services for Director MCP Server
 * Centralized service instances used by both MCP and HTTP servers
 */

import { TemplateManager } from './templates/template-manager.js';
import { ContextManager } from './context/context-manager.js';
import { AgentCommunicator } from './communication/agent-communicator.js';
import { logger } from './utils/logger.js';

// Shared service instances - initialized once and used by both servers
let templateManager: TemplateManager | null = null;
let contextManager: ContextManager | null = null;
let agentCommunicator: AgentCommunicator | null = null;

/**
 * Initialize all shared services
 */
export function initializeSharedServices(): {
  templateManager: TemplateManager;
  contextManager: ContextManager;
  agentCommunicator: AgentCommunicator;
} {
  if (templateManager && contextManager && agentCommunicator) {
    return { templateManager, contextManager, agentCommunicator };
  }

  logger.info('Initializing shared Director services...');

  try {
    templateManager = new TemplateManager();
    contextManager = new ContextManager();
    agentCommunicator = new AgentCommunicator();

    logger.info('✅ All shared services initialized successfully');

    return { templateManager, contextManager, agentCommunicator };
  } catch (error) {
    logger.error('❌ Failed to initialize shared services', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Get existing shared services (assumes they've been initialized)
 */
export function getSharedServices(): {
  templateManager: TemplateManager;
  contextManager: ContextManager;
  agentCommunicator: AgentCommunicator;
} {
  if (!templateManager || !contextManager || !agentCommunicator) {
    throw new Error('Shared services not initialized. Call initializeSharedServices() first.');
  }

  return { templateManager, contextManager, agentCommunicator };
}

/**
 * Cleanup shared services
 */
export function cleanupSharedServices(): void {
  if (contextManager) {
    contextManager.shutdown();
  }
  
  templateManager = null;
  contextManager = null;
  agentCommunicator = null;
  
  logger.info('Shared services cleaned up');
}

/**
 * Get system stats from all shared services
 */
export function getSystemStats() {
  const services = getSharedServices();
  
  return {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      version: '1.0.0'
    },
    template_manager: services.templateManager.getCacheStats(),
    context_manager: services.contextManager.getStats(),
    agent_communicator: services.agentCommunicator.getAgentStats()
  };
}
