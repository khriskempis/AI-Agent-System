#!/usr/bin/env node

/**
 * Configuration Verification Script
 * 
 * Verifies that workflow configurations are correctly applied
 */

const fs = require('fs');
const path = require('path');

function verifyWorkflowConfig(workflowPath, expectedEnv) {
  console.log(`🔍 Verifying ${path.basename(workflowPath)} for ${expectedEnv} environment...`);

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

  const nodes = workflow.nodes || [];
  let issues = [];
  let urlCount = 0;

  // Check URLs in nodes
  nodes.forEach(node => {
    if (node.parameters && node.parameters.url) {
      urlCount++;
      const url = node.parameters.url;
      
      if (expectedEnv === 'testing') {
        if (!url.includes('localhost')) {
          issues.push(`❌ Node "${node.name}": Expected localhost URL, found ${url}`);
        }
      } else if (expectedEnv === 'production') {
        if (url.includes('localhost')) {
          issues.push(`❌ Node "${node.name}": Found localhost URL in production config: ${url}`);
        }
      }
    }
  });

  // Check environment tag
  const envTag = workflow.tags && workflow.tags.find(tag => tag.startsWith('env:'));
  if (!envTag) {
    issues.push(`⚠️  Missing environment tag`);
  } else {
    console.log(`✅ Environment tag: ${envTag}`);
  }

  // Report results
  console.log(`📊 Found ${urlCount} URLs to check`);
  
  if (issues.length === 0) {
    console.log(`✅ All checks passed for ${expectedEnv} environment`);
    return true;
  } else {
    console.log(`❌ Found ${issues.length} issues:`);
    issues.forEach(issue => console.log(`  ${issue}`));
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log('Configuration Verification Script');
    console.log('');
    console.log('Usage:');
    console.log('  node verify-config.js <workflow-name> <expected-environment>');
    console.log('');
    console.log('Examples:');
    console.log('  node verify-config.js director-notion-unified-agent testing');
    console.log('  node verify-config.js director-notion-unified-agent production');
    return;
  }

  const workflowName = args[0];
  const expectedEnv = args[1];

  if (!expectedEnv || !['testing', 'production'].includes(expectedEnv)) {
    console.error('❌ Expected environment must be "testing" or "production"');
    process.exit(1);
  }

  const workflowPath = path.join(__dirname, '..', `${workflowName}.json`);
  const success = verifyWorkflowConfig(workflowPath, expectedEnv);
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { verifyWorkflowConfig };
