#!/usr/bin/env tsx
/**
 * Database Creation Endpoints Testing
 * Tests the core functionality that the Notion Agent will use in Phase 2
 * 
 * Usage: tsx test-database-endpoints.ts
 */

import axios, { AxiosResponse } from 'axios';

// Configuration - Update with your actual database IDs
const CONFIG = {
  notionServer: 'http://localhost:3001', // or http://host.docker.internal:3001
  sourceIdeasDb: '16cd7be3dbcd80e1aac9c3a95ffaa61a',
  targetDatabases: {
    projects: '3cd8ea052d6d4b69956e89b1184cae75',     // Update with your projects DB ID
    knowledge: '263d7be3dbcd80c0b6e4fd309a8af453',      // Update with your knowledge DB ID  
    journal: 'a1d35f6081a044589425512cb9d136b7'        // Update with your journal DB ID
  }
};

interface DatabaseSchema {
  success: boolean;
  data: {
    properties: Record<string, any>;
  };
}

interface CreateItemResponse {
  success: boolean;
  data: {
    id: string;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

class DatabaseEndpointTester {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async testHealth(): Promise<TestResult> {
    console.log('🏥 Testing Notion Server Health...');
    try {
      // Use ideas endpoint as health check since /api/health doesn't exist
      const response = await axios.get(`${this.baseUrl}/api/ideas?limit=1`, { timeout: 5000 });
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: Server is healthy - Ideas API responding`);
      return {
        success: response.status === 200,
        message: response.status === 200 ? 'Health check passed (via ideas API)' : 'Health check failed',
        details: { status: 'healthy', endpoint: 'ideas' }
      };
    } catch (error: any) {
      console.log(`   ❌ Health check failed: ${error.message}`);
      return {
        success: false,
        message: `Health check failed: ${error.message}`
      };
    }
  }

  async getDatabaseSchema(databaseId: string): Promise<TestResult & { schema?: DatabaseSchema }> {
    console.log(`\n🗂️ Getting schema for database: ${databaseId}`);
    try {
      const response = await axios.get<DatabaseSchema>(`${this.baseUrl}/api/databases/${databaseId}/schema`);
      
      if (response.status === 200 && response.data.success) {
        const properties = Object.keys(response.data.data.properties);
        console.log(`   ✅ Schema retrieved successfully`);
        console.log(`   Properties found: ${properties.join(', ')}`);
        return {
          success: true,
          message: 'Schema retrieved successfully',
          schema: response.data,
          details: { properties }
        };
      } else {
        console.log(`   ❌ Failed to get schema: ${response.status}`);
        return {
          success: false,
          message: `Failed to get schema: ${response.status}`
        };
      }
    } catch (error: any) {
      console.log(`   ❌ Schema request failed: ${error.message}`);
      return {
        success: false,
        message: `Schema request failed: ${error.message}`
      };
    }
  }

  async getAutoConfig(databaseId: string): Promise<TestResult> {
    console.log(`\n⚙️ Getting auto-config for database: ${databaseId}`);
    try {
      const response = await axios.get(`${this.baseUrl}/api/databases/${databaseId}/auto-config`);
      
      if (response.status === 200 && response.data.success) {
        console.log(`   ✅ Auto-config retrieved successfully`);
        const config = response.data.data;
        console.log(`   Title property: ${config.title_property}`);
        console.log(`   Content property: ${config.content_property}`);
        console.log(`   Status property: ${config.status_property}`);
        return {
          success: true,
          message: 'Auto-config retrieved successfully',
          details: config
        };
      } else {
        console.log(`   ❌ Failed to get auto-config: ${response.status}`);
        return {
          success: false,
          message: `Failed to get auto-config: ${response.status}`
        };
      }
    } catch (error: any) {
      console.log(`   ❌ Auto-config request failed: ${error.message}`);
      return {
        success: false,
        message: `Auto-config request failed: ${error.message}`
      };
    }
  }

  async createDatabaseItem(databaseId: string, itemData: any, itemType: string): Promise<TestResult> {
    console.log(`\n➕ Creating ${itemType} item in database: ${databaseId}`);
    try {
      const response = await axios.post<CreateItemResponse>(
        `${this.baseUrl}/api/databases/${databaseId}/pages`,
        itemData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if ([200, 201].includes(response.status) && response.data.success) {
        console.log(`   ✅ ${itemType} item created successfully!`);
        console.log(`   New item ID: ${response.data.data.id}`);
        return {
          success: true,
          message: `${itemType} item created successfully`,
          details: { itemId: response.data.data.id }
        };
      } else {
        console.log(`   ❌ Failed to create ${itemType} item: ${response.status}`);
        return {
          success: false,
          message: `Failed to create ${itemType} item: ${response.status}`,
          details: response.data
        };
      }
    } catch (error: any) {
      console.log(`   ❌ Creation request failed: ${error.message}`);
      return {
        success: false,
        message: `Creation request failed: ${error.message}`,
        details: error.response?.data
      };
    }
  }

  async getSampleIdeas(): Promise<TestResult> {
    console.log('\n💡 Getting sample ideas from source database...');
    try {
      const response = await axios.get(`${this.baseUrl}/api/ideas?limit=2&status=Not Started`);
      
      if (response.status === 200) {
        const ideas = response.data.data || [];
        console.log(`   ✅ Retrieved ${ideas.length} sample ideas`);
        return {
          success: true,
          message: `Retrieved ${ideas.length} sample ideas`,
          details: ideas
        };
      } else {
        console.log(`   ❌ Failed to get ideas: ${response.status}`);
        return {
          success: false,
          message: `Failed to get ideas: ${response.status}`
        };
      }
    } catch (error: any) {
      console.log(`   ❌ Ideas request failed: ${error.message}`);
      return {
        success: false,
        message: `Ideas request failed: ${error.message}`
      };
    }
  }
}

// Test data for database item creation (matched to actual schemas)
const getTestItems = () => ({
  projects: {
    properties: {
      Name: { title: [{ text: { content: '🧪 Test AI Video Generator Project (API Test)' } }] },
      Tags: { multi_select: [{ name: 'test' }, { name: 'API' }, { name: 'AI' }] }
    },
    content: `# AI Video Generator Project

## Overview
This is a test project created via the TypeScript API to demonstrate **rich content creation** in Notion databases.

## Key Features
- Automated video generation using AI
- Support for multiple content formats
- Integration with social media platforms

## Technical Requirements
1. **AI Model Integration**
   - OpenAI GPT-4 for script generation
   - Stable Diffusion for image creation
   - ElevenLabs for voice synthesis

2. **Output Formats**
   - MP4 video files
   - Subtitle files (SRT)
   - Thumbnail images

## Next Steps
- [ ] Set up development environment
- [ ] Create MVP prototype
- [ ] Test with sample content
- [ ] Deploy to production

> **Note**: This content was generated automatically via API and demonstrates markdown-like formatting in Notion.`
  },
  knowledge: {
    properties: {
      Title: { title: [{ text: { content: '🧪 Test ML Algorithms Reference (API Test)' } }] },
      Tags: { multi_select: [{ name: 'test' }, { name: 'api' }] }
    },
    content: `# Machine Learning Algorithms Reference

## Supervised Learning

### Classification Algorithms
- **Decision Trees**: Easy to interpret, handles both numerical and categorical data
- **Random Forest**: Ensemble method that reduces overfitting
- **Support Vector Machines (SVM)**: Effective for high-dimensional spaces
- **Neural Networks**: Powerful for complex pattern recognition

### Regression Algorithms
- **Linear Regression**: Simple and interpretable baseline
- **Polynomial Regression**: Captures non-linear relationships
- **Ridge/Lasso Regression**: Regularization techniques to prevent overfitting

## Unsupervised Learning

### Clustering
1. **K-Means**: Partitions data into k clusters
2. **Hierarchical Clustering**: Creates tree-like cluster structures
3. **DBSCAN**: Density-based clustering, good for irregular shapes

### Dimensionality Reduction
- **PCA (Principal Component Analysis)**: Linear dimensionality reduction
- **t-SNE**: Non-linear, great for visualization
- **UMAP**: Preserves both local and global structure

## Performance Metrics

### Classification
- **Accuracy**: Overall correctness
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1-Score**: Harmonic mean of precision and recall

### Regression
- **MSE (Mean Squared Error)**: Average squared differences
- **RMSE (Root Mean Squared Error)**: Square root of MSE
- **MAE (Mean Absolute Error)**: Average absolute differences
- **R² (R-squared)**: Proportion of variance explained

> This reference was created via API to demonstrate rich content formatting in Notion knowledge bases.`
  },
  journal: {
    properties: {
      Name: { title: [{ text: { content: `🧪 Test Journal Entry - ${new Date().toISOString().split('T')[0]} (API Test)` } }] },
      Tags: { multi_select: [{ name: 'test' }, { name: 'api' }] }
    },
    content: `# Daily Reflection - ${new Date().toLocaleDateString()}

## Morning Thoughts
Started the day by testing the **Notion API integration** for our MCP server project. It's fascinating how we can programmatically create rich content that formats beautifully in Notion.

## Key Accomplishments Today
- ✅ Successfully implemented database creation endpoints
- ✅ Added support for rich text content blocks
- ✅ Tested markdown-to-Notion conversion
- ✅ Validated all three target databases

## Technical Insights
The Notion API uses a **block-based architecture** where content is structured as:
- Paragraphs
- Headings (H1, H2, H3)
- Lists (bulleted and numbered)
- Code blocks
- And many more...

## Challenges Faced
1. **Property Schema Matching**: Each database has different property names
2. **Rich Text Formatting**: Converting markdown to Notion blocks requires careful mapping
3. **API Rate Limits**: Need to be mindful of request frequency

## Tomorrow's Goals
- [ ] Test the n8n Phase 2 workflow
- [ ] Optimize the content conversion logic
- [ ] Add support for more markdown features
- [ ] Document the complete API workflow

## Personal Note
This automated journal entry demonstrates how we can create **meaningful, formatted content** programmatically. The ability to copy-paste from Cursor and have it format correctly in Notion is exactly what we're replicating here.

---
*This entry was created via TypeScript API to test rich content creation in Notion databases.*`
  }
});

async function main() {
  console.log('🧪 DATABASE CREATION ENDPOINT TESTING (TypeScript)');
  console.log('=' .repeat(60));
  console.log();
  console.log('📋 Configuration:');
  console.log(`Source Ideas DB: ${CONFIG.sourceIdeasDb}`);
  console.log(`Projects DB: ${CONFIG.targetDatabases.projects}`);
  console.log(`Knowledge DB: ${CONFIG.targetDatabases.knowledge}`);
  console.log(`Journal DB: ${CONFIG.targetDatabases.journal}`);
  console.log(`Server: ${CONFIG.notionServer}`);
  console.log();

  const tester = new DatabaseEndpointTester(CONFIG.notionServer);
  const results: { [key: string]: TestResult } = {};

  // Test 1: Health Check
  results.health = await tester.testHealth();
  if (!results.health.success) {
    console.log('❌ Health check failed. Make sure the Notion server is running.');
    return;
  }

  // Test 2: Get sample ideas to understand source structure
  results.sampleIdeas = await tester.getSampleIdeas();

  // Test 3: Get schemas for all target databases
  const schemas: { [key: string]: any } = {};
  for (const [dbType, dbId] of Object.entries(CONFIG.targetDatabases)) {
    const schemaResult = await tester.getDatabaseSchema(dbId);
    results[`${dbType}Schema`] = schemaResult;
    if (schemaResult.schema) {
      schemas[dbType] = schemaResult.schema;
    }

    // Also get auto-config suggestions
    const autoConfigResult = await tester.getAutoConfig(dbId);
    results[`${dbType}AutoConfig`] = autoConfigResult;
  }

  // Test 4: Create test items in each database
  const testItems = getTestItems();
  const creationResults: { [key: string]: TestResult } = {};

  for (const [dbType, dbId] of Object.entries(CONFIG.targetDatabases)) {
    if (testItems[dbType as keyof typeof testItems]) {
      const creationResult = await tester.createDatabaseItem(
        dbId, 
        testItems[dbType as keyof typeof testItems], 
        dbType
      );
      creationResults[dbType] = creationResult;
      results[`${dbType}Creation`] = creationResult;
    }
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(30));
  
  const successfulCreations = Object.values(creationResults).filter(r => r.success).length;
  const totalAttempts = Object.values(creationResults).length;
  
  console.log(`Database items created: ${successfulCreations}/${totalAttempts}`);
  console.log();

  if (successfulCreations === totalAttempts) {
    console.log('✅ All database creation tests passed!');
    console.log('   Ready to test the full n8n workflow.');
  } else {
    console.log('⚠️  Some database creations failed.');
    console.log('   Check database IDs and schema compatibility before running n8n workflow.');
  }

  // Next steps
  console.log('\n🔄 NEXT STEPS:');
  console.log('1. Check your Notion databases for the test items created');
  console.log('2. Verify the property mappings look correct');
  console.log('3. Update database IDs in n8n workflows if needed');
  console.log('4. Run the Phase 2 n8n workflow with confidence!');
  console.log();

  // Return results for programmatic use
  return results;
}

// Run if called directly (ES module compatible)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (process.argv[1] === __filename) {
  main().catch(console.error);
}

export { DatabaseEndpointTester, CONFIG };
