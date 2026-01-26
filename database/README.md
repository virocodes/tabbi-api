# Database Schema

This folder contains the database schema and migrations for Tabbi API.

## Structure

```
database/
├── schema.sql           # Current complete schema (for reference)
├── README.md            # This file
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_example_migration.sql
    └── ...
```

## Files

### `schema.sql`
The **current complete state** of the database. Use this for:
- New installations (run the entire file)
- Context/reference when developing
- AI assistants understanding the schema

**Important:** This file is regenerated after each migration to reflect the current state.

### `migrations/`
Sequential, numbered migration files. Each file contains incremental changes.

**Rules:**
1. Never edit existing migration files
2. Always add new migrations with the next number
3. Each migration should be idempotent where possible (use `IF NOT EXISTS`)
4. Include rollback comments when applicable

## How to Apply

### New Installation
Run `schema.sql` in the Supabase SQL Editor.

### Existing Database
Run only the **new** migration files you haven't applied yet:
```sql
-- Check which migrations have been applied
-- Then run only the new ones in order
```

## Creating a New Migration

1. Create a new file: `migrations/NNN_description.sql`
2. Write your migration SQL
3. Update `schema.sql` to reflect the new state
4. Test on a development database first
5. Commit both files together

### Migration Template

```sql
-- Migration: NNN_description
-- Date: YYYY-MM-DD
-- Description: What this migration does

-- Forward migration
ALTER TABLE example ADD COLUMN new_col TEXT;

-- Rollback (comment for reference)
-- ALTER TABLE example DROP COLUMN new_col;
```

## Example: Adding a Column

**1. Create `migrations/002_add_user_avatar.sql`:**
```sql
-- Migration: 002_add_user_avatar
-- Date: 2025-01-26
-- Description: Add avatar URL to api_keys for dashboard display

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

**2. Update `schema.sql`** to include the new column in the table definition.

**3. Commit both files.**
