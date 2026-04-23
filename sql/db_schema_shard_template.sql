-- KIWE Sampling Table Shard Creation Template
-- This SQL script provides a function to create new period-based shards with schema inheritance.

-- 1. Function to create a new shard based on a reference table
-- This ensures all columns (including status, completed_at), constraints, and indices are copied.
CREATE OR REPLACE FUNCTION create_sampling_shard(year_val INT, half_val INT)
RETURNS TEXT AS $$
DECLARE
    new_table_name TEXT;
    ref_table_name TEXT := 'kiwe_sampling_2026_1'; -- Reference schema table
BEGIN
    new_table_name := 'kiwe_sampling_' || year_val || '_' || half_val;
    
    -- Check if table already exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = new_table_name) THEN
        RETURN 'Table ' || new_table_name || ' already exists.';
    END IF;

    -- Create new table using LIKE ... INCLUDING ALL
    -- This copies: Columns, Defaults, Constraints, Indices, Comments
    EXECUTE 'CREATE TABLE ' || quote_ident(new_table_name) || ' (LIKE ' || quote_ident(ref_table_name) || ' INCLUDING ALL)';
    
    -- Enable RLS (Row Level Security) if the reference table has it
    EXECUTE 'ALTER TABLE ' || quote_ident(new_table_name) || ' ENABLE ROW LEVEL SECURITY';
    
    -- Copy Policies (Supabase specific policies might need manual reassignment or dynamic application)
    -- Note: Simple LIKE doesn't copy policies. You must manually apply them:
    EXECUTE 'CREATE POLICY "Allow all for authenticated" ON ' || quote_ident(new_table_name) || ' FOR ALL TO authenticated USING (true) WITH CHECK (true)';

    RETURN 'Successfully created shard: ' || new_table_name;
END;
$$ LANGUAGE plpgsql;

-- 2. How to use:
-- SELECT create_sampling_shard(2026, 2);
-- SELECT create_sampling_shard(2027, 1);

-- 3. Maintenance: Adding columns to ALL existing shards
-- If you add a column to one, you must add it to all.
-- Example for adding a column retrospectively:
/*
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE tablename LIKE 'kiwe_sampling_%') 
    LOOP
        EXECUTE 'ALTER TABLE ' || t || ' ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''진행중''';
        EXECUTE 'ALTER TABLE ' || t || ' ADD COLUMN IF NOT EXISTS completed_at DATE';
        EXECUTE 'ALTER TABLE ' || t || ' ADD COLUMN IF NOT EXISTS input_seq INTEGER';
    END LOOP;
END $$;
*/
