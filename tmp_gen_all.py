import pandas as pd
import sys
import os

# Script to generate SQL using INSERT ... ON CONFLICT for Analysis and Engineering prices
# Fixed: Added DELETE for synchronization and updated sort_order in DO UPDATE clause

def escape(s):
    if pd.isna(s): return "NULL"
    return "'" + str(s).strip().replace("'", "''") + "'"

def get_sql_insert(file_path, price_type, mode='analysis'):
    try:
        df = pd.read_excel(file_path)
        sql_lines = []
        years = [2026, 2025, 2024, 2023, 2022]
        
        # Add DELETE statement at the beginning for the section
        if mode == 'analysis':
            sql_lines.append(f"DELETE FROM kiwe_price_settings WHERE price_type = '{price_type}' AND category = '분석수수료';")
        else:
            sql_lines.append(f"DELETE FROM kiwe_price_settings WHERE price_type = '엔지니어링' AND category IN ('엔지니어링노임', '인당단가', '장비대여');")

        for idx, row in df.iterrows():
            if mode == 'analysis':
                # Analysis Fee: No(0), sub_category(1), method_name(2), item_name(3), 2026(4), 2025(5)...
                sub_cat = row.iloc[1]
                method = row.iloc[2]
                item = row.iloc[3]
                category = '분석수수료'
                start_col = 4
            else:
                # Engineering: No(0), major(1), middle(2), minor(3), 2026(4), 2025(5)...
                sub_cat = row.iloc[1]
                method = row.iloc[2]
                item = row.iloc[3]
                major_str = str(sub_cat)
                category = ''
                if '엔지니어링' in major_str: category = '엔지니어링노임'
                elif '인당' in major_str: category = '인당단가'
                elif '장비' in major_str or '대여' in major_str: category = '장비대여'
                if not category: continue
                start_col = 4

            if pd.isna(item) or not str(item).strip(): continue
            
            for i, year in enumerate(years):
                col_idx = start_col + i
                if col_idx >= len(row): continue
                
                price_val = row.iloc[col_idx]
                if pd.isna(price_val) or str(price_val).strip() in ['-', 'nan', '']:
                    price_val = 0
                else:
                    try:
                        price_val = int(float(str(price_val).replace(',', '')))
                    except:
                        price_val = 0
                
                # Using INSERT since we DELETE first, but ON CONFLICT is still good for safety
                sql = (f"INSERT INTO kiwe_price_settings (year, price_type, category, item_name, sub_category, method_name, unit_price, sort_order, is_fixed) "
                       f"VALUES ({year}, {escape(price_type)}, {escape(category)}, {escape(item)}, {escape(sub_cat)}, {escape(method)}, {price_val}, {idx + 1}, false) "
                       f"ON CONFLICT (year, price_type, category, item_name) "
                       f"DO UPDATE SET sub_category = EXCLUDED.sub_category, method_name = EXCLUDED.method_name, unit_price = EXCLUDED.unit_price, sort_order = EXCLUDED.sort_order;")
                sql_lines.append(sql)
                
        return sql_lines
    except Exception as e:
        return [f"-- Error reading {file_path}: {str(e)}"]

# Generate Analysis Updates
with open('analysis_updates.sql', 'w', encoding='utf-8') as f:
    f.write("-- [일반] 분석수수료 데이터 (완전 동기화)\n")
    for line in get_sql_insert('분석수수료(일반) 단가설정.xlsx', '일반', 'analysis'):
        f.write(line + "\n")
    f.write("\n-- [비용지원] 분석수수료 데이터 (완전 동기화)\n")
    for line in get_sql_insert('분석수수료(비용지원) 단가설정.xlsx', '비용지원', 'analysis'):
        f.write(line + "\n")

# Generate Engineering Updates
with open('engineering_updates.sql', 'w', encoding='utf-8') as f:
    f.write("-- 엔지니어링 노임/인당단가/장비대여 데이터 (완전 동기화)\n")
    for line in get_sql_insert('엔지니어링 노임 단가설정.xlsx', '엔지니어링', 'engineering'):
        f.write(line + "\n")

print("Generated SQL scripts with DELETE and INSERT ON CONFLICT successfully.")
