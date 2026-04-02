/**
 * Shared Services for Director MCP Server
 * Centralized service instances used by the MCP server
 */

import { TemplateManager } from './templates/template-manager.js';
import { ContextManager } from './context/context-manager.js';
import { logger } from './utils/logger.js';

// Shared service instances - initialized once
let templateManager: TemplateManager | null = null;
let contextManager: ContextManager | null = null;

/**
 * Initialize all shared services
 */
export function initializeSharedServices(): {
  templateManager: TemplateManager;
  contextManager: ContextManager;
} {
  if (templateManager && contextManager) {
    return { templateManager, contextManager };
  }

  logger.info('Initializing shared Director services...');

  try {
    templateManager = new TemplateManager();
    contextManager = new ContextManager();

    logger.info('✅ All shared services initialized successfully');

    return { templateManager, contextManager };
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
} {
  if (!templateManager || !contextManager) {
    throw new Error('Shared services not initialized. Call initializeSharedServices() first.');
  }

  return { templateManager, contextManager };
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
    context_manager: services.contextManager.getStats()
  };
}
