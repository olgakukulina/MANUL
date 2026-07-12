import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DB_URL = os.getenv("DB_URL")  # или строка подключения
    JWT_SECRET = os.getenv("JWT_SECRET", "secret")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

settings = Settings()