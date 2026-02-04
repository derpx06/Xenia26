from fastapi import FastAPI
import uvicorn
from ml.routes import router as ml_router

app = FastAPI()

# Include ML router
app.include_router(ml_router)

@app.get("/")
def read_root():
    return {"message": "Hello from backend!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
