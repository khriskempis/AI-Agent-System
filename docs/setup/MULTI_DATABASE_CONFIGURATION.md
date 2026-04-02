# Multi-Database Notion Configuration

## Overview

The idea categorization pipeline classifies each unprocessed idea and routes it to one of three target databases in Notion. The classification is written back to the idea's source page (`status`, `tags`). Cross-database page creation (actually moving the idea into Projects/Knowledge/Journal) is a planned future enhancement.

## Required Databases

| Database | Purpose |
|---|---|
| **Ideas** | Source — where unprocessed ideas live (status: "Not Started") |
| **Projects** | Target for actionable, implementation-ready ideas |
| **Knowledge Archive** | Target for reference material and learning resources |
| **Journal** | Target for personal thoughts, reflections, and insights |

## Getting Database IDs

From any Notion database URL:
```
https://notion.so/your-workspace/DATABASE_ID?v=view_id
```

Copy the 32-character `DATABASE_ID` for each database.

## Notion Integration Access

Your Notion integration must have access to **all four databases**. In Notion:
1. Open each database → `...` menu → Connections
2. Add your integration to each database

## Database Schema Requirements

Each database needs these properties for the pipeline to write correctly:

### Ideas Database (source)
| Property | Type | Notes |
|---|---|---|
| `Name` | Title | Idea title |
| `Status` | Status | `Not Started` → `Done` or `Needs Review` |
| `Tags` | Multi-select | Written by the classifier |

### Projects Database
| Property | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `Status` | Status | `Not Started`, `In Progress`, `Done` |
| `Priority` | Select | `High`, `Medium`, `Low` |
| `Tags` | Multi-select | |

### Knowledge Archive Database
| Property | Type | Notes |
|---|---|---|
| `Title` | Title | |
| `Category` | Select | `Educational`, `Reference`, etc. |
| `Status` | Status | `To Review`, `Reviewed`, `Archived` |
| `Tags` | Multi-select | |

### Journal Database
| Property | Type | Notes |
|---|---|---|
| `Title` | Title | |
| `Date` | Date | |
| `Type` | Select | `Thought`, `Reflection`, `Insight` |
| `Tags` | Multi-select | |

## How Routing Works Today

The `categorize-idea` pipeline uses Claude to classify each idea into one of three categories (Projects / Knowledge Archive / Journal), then writes the classification back to the **Ideas database**:

```
FETCH idea → CLASSIFY (Claude) → VALIDATE → EVALUATE → WRITE
                                                         ↓
                              NotionAgent.updateIdea({ tags, status: "Done" })
```

The classification result is stored in the idea's tags. Cross-database page creation (creating a corresponding page in Projects/Knowledge/Journal) is a planned Layer 2 pipeline extension.

## Verifying Database Access

```bash
# Check that the notion-idea-server can reach your databases
curl http://localhost:3001/api/ideas?status=Not%20Started

# Inspect schema of a target database
curl http://localhost:3001/api/databases/YOUR_DB_ID/auto-config

# Test database connection
curl http://localhost:3001/api/databases/YOUR_DB_ID/test-connection
```

## Troubleshooting

**`Database access errors`**
- Verify the 32-character database ID (no extra characters from the URL)
- Ensure your Notion integration is added to that specific database
- Check that the integration has read + write permissions

**`Property mapping errors`**
- Property names are case-sensitive — `"Name"` ≠ `"name"`
- Use `auto-config` to see what properties Notion actually exposes:
  ```bash
  curl http://localhost:3001/api/databases/YOUR_DB_ID/auto-config
  ```
- See [Notion Property Fix](../troubleshooting/NOTION_PROPERTY_FIX.md) for validation errors

**`Ideas not being picked up`**
- Ideas must have status exactly `"Not Started"` to be fetched by `getAllUnprocessed()`
- Verify with: `curl "http://localhost:3001/api/ideas?status=Not%20Started"`
