#!/usr/bin/env python3
"""
Test Database Creation Endpoints
Tests the core functionality that the Notion Agent will use in Phase 2
"""

import requests
import json
import time
from datetime import datetime

# Configuration - Update with your actual database IDs
CONFIG = {
    "notion_server": "http://localhost:3001",  # or http://host.docker.internal:3001
    "source_ideas_db": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
    "target_databases": {
        "projects": "3cd8ea052d6d4b69956e89b1184cae75",     # Update with your projects DB ID
        "knowledge": "87654321432143214321210987654321",      # Update with your knowledge DB ID  
        "journal": "11111111222222223333333344444444"        # Update with your journal DB ID
    }
}

def test_health():
    """Test if Notion server is running"""
    print("🏥 Testing Notion Server Health...")
    try:
        response = requests.get(f"{CONFIG['notion_server']}/api/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False

def get_database_schema(database_id):
    """Get database schema - critical for understanding property structure"""
    print(f"\n🗂️ Getting schema for database: {database_id}")
    try:
        response = requests.get(f"{CONFIG['notion_server']}/api/databases/{database_id}/schema")
        if response.status_code == 200:
            schema = response.json()
            print(f"   ✅ Schema retrieved successfully")
            print(f"   Properties found: {list(schema.get('data', {}).get('properties', {}).keys())}")
            return schema
        else:
            print(f"   ❌ Failed to get schema: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Schema request failed: {e}")
        return None

def get_auto_config(database_id):
    """Get auto-config suggestions for property mappings"""
    print(f"\n⚙️ Getting auto-config for database: {database_id}")
    try:
        response = requests.get(f"{CONFIG['notion_server']}/api/databases/{database_id}/auto-config")
        if response.status_code == 200:
            config = response.json()
            print(f"   ✅ Auto-config retrieved successfully")
            if 'data' in config:
                suggested_props = config['data']
                print(f"   Title property: {suggested_props.get('title_property')}")
                print(f"   Content property: {suggested_props.get('content_property')}")
                print(f"   Status property: {suggested_props.get('status_property')}")
            return config
        else:
            print(f"   ❌ Failed to get auto-config: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Auto-config request failed: {e}")
        return None

def create_database_item(database_id, item_data, item_type):
    """Create a new item in the specified database"""
    print(f"\n➕ Creating {item_type} item in database: {database_id}")
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            f"{CONFIG['notion_server']}/api/databases/{database_id}/pages",
            headers=headers,
            json=item_data
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"   ✅ {item_type} item created successfully!")
            if 'data' in result and 'id' in result['data']:
                print(f"   New item ID: {result['data']['id']}")
            return result
        else:
            print(f"   ❌ Failed to create {item_type} item: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Creation request failed: {e}")
        return None

def get_sample_ideas():
    """Get sample ideas from source database to understand data structure"""
    print("\n💡 Getting sample ideas from source database...")
    try:
        response = requests.get(f"{CONFIG['notion_server']}/api/ideas?limit=2&status=Not Started")
        if response.status_code == 200:
            ideas = response.json()
            print(f"   ✅ Retrieved {len(ideas.get('data', []))} sample ideas")
            return ideas
        else:
            print(f"   ❌ Failed to get ideas: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ Ideas request failed: {e}")
        return None

def main():
    """Main test sequence"""
    print("🧪 DATABASE CREATION ENDPOINT TESTING")
    print("=" * 50)
    
    # Test 1: Health Check
    if not test_health():
        print("❌ Health check failed. Make sure the Notion server is running.")
        return
    
    # Test 2: Get sample ideas to understand source structure
    sample_ideas = get_sample_ideas()
    
    # Test 3: Get schemas for all target databases
    schemas = {}
    for db_type, db_id in CONFIG["target_databases"].items():
        schema = get_database_schema(db_id)
        schemas[db_type] = schema
        
        # Also get auto-config suggestions
        auto_config = get_auto_config(db_id)
    
    # Test 4: Create test items in each database
    test_items = {
        "projects": {
            "properties": {
                "Name": {"title": [{"text": {"content": "Test AI Video Generator Project"}}]},
                "Description": {"rich_text": [{"text": {"content": "Test project created via API to verify database creation functionality"}}]},
                "Status": {"select": {"name": "Not Started"}},
                "Priority": {"select": {"name": "High"}},
                "Tags": {"multi_select": [{"name": "test"}, {"name": "api"}, {"name": "ai"}]}
            }
        },
        "knowledge": {
            "properties": {
                "Title": {"title": [{"text": {"content": "Test ML Algorithms Reference"}}]},
                "Content": {"rich_text": [{"text": {"content": "Test knowledge entry created via API to verify database creation functionality"}}]},
                "Type": {"select": {"name": "Technical Reference"}},
                "Tags": {"multi_select": [{"name": "test"}, {"name": "api"}, {"name": "machine-learning"}]}
            }
        },
        "journal": {
            "properties": {
                "Title": {"title": [{"text": {"content": f"Test Journal Entry - {datetime.now().strftime('%Y-%m-%d')}"}}]},
                "Entry": {"rich_text": [{"text": {"content": "Test journal entry created via API to verify database creation functionality"}}]},
                "Date": {"date": {"start": datetime.now().strftime('%Y-%m-%d')}},
                "Type": {"select": {"name": "Personal Reflection"}},
                "Tags": {"multi_select": [{"name": "test"}, {"name": "api"}]}
            }
        }
    }
    
    # Create test items
    creation_results = {}
    for db_type, db_id in CONFIG["target_databases"].items():
        if db_type in test_items:
            result = create_database_item(db_id, test_items[db_type], db_type)
            creation_results[db_type] = result
    
    # Summary
    print("\n📊 TEST SUMMARY")
    print("=" * 30)
    successful_creations = sum(1 for r in creation_results.values() if r is not None)
    total_attempts = len(creation_results)
    
    print(f"Database items created: {successful_creations}/{total_attempts}")
    
    if successful_creations == total_attempts:
        print("✅ All database creation tests passed!")
        print("   Ready to test the full n8n workflow.")
    else:
        print("⚠️  Some database creations failed.")
        print("   Check database IDs and schema compatibility before running n8n workflow.")
    
    # Next steps
    print("\n🔄 NEXT STEPS:")
    print("1. Check your Notion databases for the test items created")
    print("2. Verify the property mappings look correct")  
    print("3. Update database IDs in n8n workflows if needed")
    print("4. Run the Phase 2 n8n workflow with confidence!")

if __name__ == "__main__":
    main()
