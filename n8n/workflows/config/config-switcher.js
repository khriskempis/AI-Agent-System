#!/usr/bin/env node

/**
 * n8n Workflow Configuration Switcher
 * 
 * Switches between testing and production configurations for n8n workflows
 * without requiring manual URL and parameter editing.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ENVIRONMENTS_FILE = path.join(__dirname, 'environments.json');
const WORKFLOWS_DIR = path.join(__dirname, '..');
const CONFIG_DIR = __dirname;

class ConfigSwitcher {
  constructor() {
    this.environments = this.loadEnvironments();
  }

  loadEnvironments() {
    try {
      const content = fs.readFileSync(ENVIRONMENTS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Error loading environments.json:', error.message);
      process.exit(1);
    }
  }

  /**
   * Switch workflow configuration to specified environment
   */
  switchWorkflow(workflowName, environment) {
    console.log(`🔄 Switching ${workflowName} to ${environment} configuration...`);

    const envConfig = this.environments.environments[environment];
    if (!envConfig) {
      console.error(`❌ Environment '${environment}' not found`);
      return false;
    }

    const workflowConfig = this.environments.workflows[workflowName];
    if (!workflowConfig) {
      console.error(`❌ Workflow '${workflowName}' not found in configuration`);
      return false;
    }

    // Load current workflow
    const workflowPath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);
    if (!fs.existsSync(workflowPath)) {
      console.error(`❌ Workflow file not found: ${workflowPath}`);
      return false;
    }

    let workflow;
    try {
      const content = fs.readFileSync(workflowPath, 'utf8');
      workflow = JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error reading workflow: ${error.message}`);
      return false;
    }

    // Backup current configuration
    this.backupWorkflow(workflowPath, environment);

    // Apply environment configuration
    this.applyEnvironmentConfig(workflow, envConfig);

    // Save updated workflow
    try {
      const updatedContent = JSON.stringify(workflow, null, 2);
      fs.writeFileSync(workflowPath, updatedContent, 'utf8');
      console.log(`✅ Successfully switched ${workflowName} to ${environment}`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving workflow: ${error.message}`);
      return false;
    }
  }

  /**
   * Backup workflow before modification
   */
  backupWorkflow(workflowPath, targetEnv) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(CONFIG_DIR, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const workflowName = path.basename(workflowPath, '.json');
    const backupPath = path.join(backupDir, `${workflowName}-${timestamp}-pre-${targetEnv}.json`);
    
    try {
      fs.copyFileSync(workflowPath, backupPath);
      console.log(`📦 Backup created: ${backupPath}`);
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create backup: ${error.message}`);
    }
  }

  /**
   * Apply environment configuration to workflow
   */
  applyEnvironmentConfig(workflow, envConfig) {
    const nodes = workflow.nodes || [];

    nodes.forEach(node => {
      // Update service URLs
      if (node.parameters && node.parameters.url) {
        node.parameters.url = this.updateServiceUrl(node.parameters.url, envConfig);
      }

      // Update timeouts
      if (node.parameters && node.parameters.options) {
        if (node.parameters.options.timeout !== undefined) {
          node.parameters.options.timeout = this.getServiceTimeout(node.parameters.url, envConfig);
        }
        
        // Update agent parameters
        if (node.type && node.type.includes('langchain.agent')) {
          if (node.parameters.options.maxIterations !== undefined) {
            node.parameters.options.maxIterations = envConfig.processing.maxIterations;
          }
        }

        // Update LLM parameters
        if (node.type && node.type.includes('langchain.lm')) {
          if (node.parameters.options.temperature !== undefined) {
            node.parameters.options.temperature = envConfig.agent.temperature;
          }
          if (node.parameters.options.maxTokens !== undefined) {
            node.parameters.options.maxTokens = envConfig.agent.maxTokens;
          }
        }
      }

      // Update database IDs in workflow context
      if (node.name === 'Initialize Workflow Context' && node.parameters && node.parameters.assignments) {
        const assignments = node.parameters.assignments.assignments;
        assignments.forEach(assignment => {
          if (assignment.name === 'workflowContext' && assignment.value) {
            // Update source database
            if (assignment.value.sourceDatabase) {
              assignment.value.sourceDatabase = envConfig.databases.source;
            }
            // Update target databases
            if (assignment.value.targetDatabases) {
              assignment.value.targetDatabases = { ...envConfig.databases.targets };
            }
            // Update processing limit
            if (assignment.value.limit !== undefined) {
              assignment.value.limit = envConfig.processing.limit;
            }
          }
        });
      }
    });

    // Update workflow metadata
    workflow.updatedAt = new Date().toISOString();
    if (!workflow.tags) workflow.tags = [];
    
    // Remove old environment tags
    workflow.tags = workflow.tags.filter(tag => !tag.startsWith('env:'));
    // Add current environment tag
    workflow.tags.push(`env:${envConfig.name.toLowerCase().replace(' ', '_')}`);
  }

  /**
   * Update service URL based on environment
   */
  updateServiceUrl(currentUrl, envConfig) {
    // Director service URLs
    if (currentUrl.includes(':3002')) {
      const endpoint = currentUrl.split(':3002')[1];
      return envConfig.services.director.url + endpoint;
    }
    
    // Notion service URLs
    if (currentUrl.includes(':3001')) {
      const endpoint = currentUrl.split(':3001')[1];
      return envConfig.services.notion.url + endpoint;
    }

    return currentUrl;
  }

  /**
   * Get appropriate timeout for service
   */
  getServiceTimeout(url, envConfig) {
    if (url && url.includes(':3002')) {
      return envConfig.services.director.timeout;
    }
    if (url && url.includes(':3001')) {
      return envConfig.services.notion.timeout;
    }
    return 30000; // Default timeout
  }

  /**
   * List available workflows and environments
   */
  listConfigurations() {
    console.log('🔧 Available Configurations:');
    console.log('');
    
    console.log('📋 Environments:');
    Object.entries(this.environments.environments).forEach(([key, env]) => {
      console.log(`  • ${key}: ${env.description}`);
    });
    
    console.log('');
    console.log('🔄 Workflows:');
    Object.entries(this.environments.workflows).forEach(([key, workflow]) => {
      console.log(`  • ${key}: ${workflow.description}`);
    });
  }

  /**
   * Switch all workflows to specified environment
   */
  switchAll(environment) {
    console.log(`🔄 Switching ALL workflows to ${environment}...`);
    
    const workflows = Object.keys(this.environments.workflows);
    let successCount = 0;
    
    workflows.forEach(workflow => {
      if (this.switchWorkflow(workflow, environment)) {
        successCount++;
      }
    });
    
    console.log(`✅ Successfully switched ${successCount}/${workflows.length} workflows`);
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const switcher = new ConfigSwitcher();

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('n8n Workflow Configuration Switcher');
    console.log('');
    console.log('Usage:');
    console.log('  node config-switcher.js --env <environment> --workflow <workflow_name>');
    console.log('  node config-switcher.js --env <environment> --all');
    console.log('  node config-switcher.js --list');
    console.log('');
    console.log('Options:');
    console.log('  --env <environment>      Target environment (testing|production)');
    console.log('  --workflow <name>        Specific workflow to switch');
    console.log('  --all                    Switch all workflows'); 
    console.log('  --list                   List available configurations');
    console.log('  --help, -h              Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node config-switcher.js --env testing --workflow director-notion-unified-agent');
    console.log('  node config-switcher.js --env production --all');
    console.log('  node config-switcher.js --list');
    return;
  }

  if (args.includes('--list')) {
    switcher.listConfigurations();
    return;
  }

  const envIndex = args.indexOf('--env');
  const workflowIndex = args.indexOf('--workflow');
  const allFlag = args.includes('--all');

  if (envIndex === -1) {
    console.error('❌ --env parameter is required');
    process.exit(1);
  }

  const environment = args[envIndex + 1];
  if (!environment) {
    console.error('❌ Environment name is required after --env');
    process.exit(1);
  }

  if (allFlag) {
    switcher.switchAll(environment);
  } else if (workflowIndex !== -1) {
    const workflow = args[workflowIndex + 1];
    if (!workflow) {
      console.error('❌ Workflow name is required after --workflow');
      process.exit(1);
    }
    switcher.switchWorkflow(workflow, environment);
  } else {
    console.error('❌ Either --workflow <name> or --all is required');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ConfigSwitcher;
