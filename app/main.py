from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app import models, schemas, crud, auth

# Создаём таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI()

# ---- Эндпоинты ----
@app.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_username(db, user.username):
        raise HTTPException(400, "Username already taken")
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(400, "Email already registered")
    return crud.create_user(db, user)

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Incorrect credentials")
    token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/profile", response_model=schemas.UserOut)
def profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/")
def root():
    return {"message": "Railway Transport system API"}

# Можно добавить ещё эндпоинты прямо здесь