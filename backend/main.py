from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from repo_analyzer import GitAnalyzer
import pydriller

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "API is running. Use /analyze?url=... to fetch data."}

@app.get("/analyze")
def analyze_repo(url: str):
    """
    Endpoint: /analyze?url=https://github.com/username/repo
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        analyzer = GitAnalyzer(url)
        data = analyzer.analyze()
        return data
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run on localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)