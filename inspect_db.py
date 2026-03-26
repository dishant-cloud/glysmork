import sqlite3
import json

def inspect_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables in {db_path}: {', '.join(tables)}\n")
    
    for table in tables:
        print(f"--- Schema for {table} ---")
        cursor.execute(f"PRAGMA table_info({table});")
        for col in cursor.fetchall():
            print(f"  {col[1]} ({col[2]})")
            
        print(f"\n--- Sample Data for {table} (Limit 1) ---")
        cursor.execute(f"SELECT * FROM {table} LIMIT 1;")
        row = cursor.fetchone()
        if row:
            print(f"  {row}")
        else:
            print("  (Empty)")
        print("\n" + "="*40 + "\n")
        
    conn.close()

if __name__ == "__main__":
    inspect_db("db.sqlite3")
