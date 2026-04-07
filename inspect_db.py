import sqlite3

def inspect_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Users ---")
    cursor.execute("SELECT id, username FROM auth_user;")
    users = cursor.fetchall()
    for u in users:
        print(f"User ID: {u[0]}, Username: {u[1]}")
        
    print("\n--- Profiles ---")
    cursor.execute("SELECT id, user_id, is_profile_public FROM users_profile;")
    profiles = cursor.fetchall()
    for p in profiles:
        print(f"Profile ID: {p[0]}, User ID: {p[1]}, Public: {bool(p[2])}")
        
    conn.close()

if __name__ == "__main__":
    inspect_db("db.sqlite3")

