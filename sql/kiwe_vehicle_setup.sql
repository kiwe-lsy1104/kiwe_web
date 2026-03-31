-- Vehicle Records SQL Schema

-- 1. Create the Vehicle Master Table
CREATE TABLE IF NOT EXISTS public.kiwe_vehicles (
    id TEXT PRIMARY KEY, -- 차량번호 (e.g., '12가3456')
    name TEXT NOT NULL, -- 차량명 (e.g., '아이오닉5')
    type TEXT NOT NULL, -- 차종 (e.g., 'EV', 'Gasoline')
    contract_period_end DATE, -- 계약만료일
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Add RLS (Row Level Security) policies if needed, or disable for simple public access during testing
ALTER TABLE public.kiwe_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.kiwe_vehicles FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.kiwe_vehicles FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.kiwe_vehicles FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.kiwe_vehicles FOR DELETE USING (true);


-- 2. Create the Vehicle Logs Table
CREATE TABLE IF NOT EXISTS public.kiwe_vehicle_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id TEXT REFERENCES public.kiwe_vehicles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    driver TEXT,
    before_dist NUMERIC,
    after_dist NUMERIC,
    charge_cost NUMERIC,
    charge_kwh NUMERIC,
    toll_fee NUMERIC,
    purpose TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for logs
ALTER TABLE public.kiwe_vehicle_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.kiwe_vehicle_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.kiwe_vehicle_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.kiwe_vehicle_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.kiwe_vehicle_logs FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_vehicle_id ON public.kiwe_vehicle_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_date ON public.kiwe_vehicle_logs(date);
