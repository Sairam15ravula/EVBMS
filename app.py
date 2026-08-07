# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from routes.predict import router
app=FastAPI()
app.include_router(router)
