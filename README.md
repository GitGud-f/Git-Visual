# Git-Visual: Software Evolution Analytics

[![D3.js](https://img.shields.io/badge/Visualization-D3.js%20v7-orange)](https://d3js.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Analysis-Python%203.9+-blue)](https://www.python.org/)

**GitVisual** is an interactive, full-stack data visualization platform designed to analyze and visualize the evolutionary history of GitHub repositories. By transforming raw git metadata into hierarchical and temporal visual structures, it allows developers and researchers to identify code churn, contributor impact, and structural decay.

This project was developed as a Mini-Project for the **Data Visualization** course at the **Higher Institute for Applied Science and Technology (HIAST)**.

## Key Features

*   **Real-time Repository Analysis:** Input any public (or private if you have access) GitHub HTTPS URL to clone, mine, and visualize its history.
*   **Hierarchical Sunburst Chart:** Navigate the project's file system where arc size represents Lines of Code (LoC) and color indicates file extension.
*   **Temporal Streamgraph:** Observe contribution volume over time, with layers representing different authors.
*   **Impact Scatter Plot:** Analyze individual commits to find "crunch periods" based on code impact (insertions + deletions).
*   **Metro-Style Commit Graph:** A custom-built topological visualization of the git branching and merging history.
*   **Live Polling:** The system periodically checks the remote repository for new commits and updates the visualization using D3's transition engine without a page reload.

## Tech Stack

### Backend
*   **FastAPI:** High-performance Python API framework.
*   **PyDriller & GitPython:** Advanced git mining libraries used to traverse commit objects and calculate file-level metrics.
*   **Uvicorn:** ASGI server for handling asynchronous requests.

### Frontend
*   **D3.js (v7):** Used for all SVG rendering, scales, and transitions.
*   **Vanilla JavaScript (ES6 Modules):** Modular architecture for clean component separation.
*   **CSS3 Variables & Grid:** A "Tokyo Night" inspired dark theme with a responsive dashboard layout.

## D3.js Patterns Implemented

This project explicitly implements two core D3 design patterns:

### 1. Data Joining Pattern (Enter, Update, Exit)
Every chart in GitVisual is reactive. When the backend detects a new commit through polling:
*   **Enter:** New files/commits are animated into the view.
*   **Update:** Existing file sizes in the Sunburst transition smoothly using custom `arcTween` interpolation.
*   **Exit:** Deleted files or filtered data points are gracefully removed from the DOM.
*   *Implementation detail:* See `update(data)` methods in `sunburst.js` and `scatterplot.js`.

### 2. Linkage Pattern (Dispatch/Event Bus)
The dashboard employs a decoupled "Event Bus" architecture via `d3.dispatch`. 
*   **Cross-view Filtering:** Hovering over an author in the **Streamgraph** triggers a global `selectAuthor` event. 
*   **Reaction:** The **Sunburst** immediately dims all files not touched by that author, and the **Scatter Plot** highlights only their specific commits.
*   **Brushing:** Brushing the timeline in the Streamgraph broadcasts a `filterTime` event, zooming the Scatter Plot and Commit Graph into that specific window.
*   *Implementation detail:* See `eventBus.js` and the listener logic in `main.js`.

## Project Structure

```text
├── backend/
│   ├── cache/              # Local clones of analyzed repos
│   ├── main.py             # FastAPI entry point & API routes
│   ├── repo_analyzer.py    # Git mining logic & data structuring
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── css/
│   │   ├── charts/         # Component-specific styles
│   │   ├── components/     # UI elements (header, cards)
│   │   ├── base.css        # Global variables and resets
│   │   └── layout.css      # Dashboard Grid definition
│   ├── js/
│   │   ├── charts/         # D3 Chart Class modules
│   │   ├── dataProcessor.js# Logic for nesting and aggregating git data
│   │   ├── eventBus.js     # D3 Dispatcher for linkage
│   │   └── main.js         # Application Controller
│   ├── lib/
│   │   └── d3.v7.min.js    # D3 Library
│   └── index.html          # Main Entry Point
└── README.md
```

## Installation & Setup

### Prerequisites
*   Python 3.9+
*   Git installed on your system path.

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```
The API will be available at `http://localhost:8000`.

### 2. Frontend Setup
Since the frontend uses ES6 Modules, it must be served via a local web server (to avoid CORS issues with `file://` protocol).
*   **Option A (VS Code):** Use the "Live Server" extension on `index.html`.
*   **Option B (Python):** 
    ```bash
    cd frontend
    python -m http.server 3000
    ```
Visit `http://localhost:3000` in your browser.

## API Documentation

*   `GET /analyze?url=<repo_url>`: Performs a deep clone/pull and returns a JSON payload containing the full file tree (with author metadata) and commit history.
*   `GET /check_update?url=<repo_url>&last_commit_hash=<hash>`: Returns a boolean indicating if the remote repository has moved ahead of the local cache.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-visualization`)
3. Commit your changes (`git commit -m 'Add amazing visualization'`)
4. Push to the branch (`git push origin feature/amazing-visualization`)
5. Open a Pull Request

## License

This project is open source and available under the [Apache 2.0 License](LICENSE).