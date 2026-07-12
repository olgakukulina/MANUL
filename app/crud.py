from sqlalchemy.orm import Session
from app import models, schemas

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user_data: schemas.UserCreate):
    from app.auth import hash_password  # импорт внутри функции
    
    hashed = hash_password(user_data.password)
    db_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user