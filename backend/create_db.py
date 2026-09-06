import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.init_db import init_db
from app.database.connection import engine, Base

print("Initializing database schema...")
init_db()
print("Models registered:", Base.metadata.tables.keys())
print("Done!")
