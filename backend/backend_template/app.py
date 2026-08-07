# pyrefly: ignore [missing-import]
from fastapi import FastAPI
from routes.predict import router
app=FastAPI()
app.include_router(router)
