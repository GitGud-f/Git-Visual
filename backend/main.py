from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from repo_analyzer import GitAnalyzer
import uvicorn

app = FastAPI(
    title="Git Visual Evolution API",
    description="Backend for analyzing GitHub repositories for D3 visualization.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Access /analyze?url=<github_url> to start."}

@app.get("/analyze")
def analyze_repo(url: str):
    """
    Main endpoint to trigger analysis.
    
    - **url**: Full HTTPS URL of the git repository.
    """
    if not url or "github.com" not in url:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL provided.")

    try:
        analyzer = GitAnalyzer(url, history_limit=2000)
        data = analyzer.analyze()
        return data
    except Exception as e:
        print(f"INTERNAL SERVER ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)