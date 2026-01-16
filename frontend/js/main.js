import { SunburstChart } from './charts/sunburst.js';
import eventBus  from './eventBus.js';
import { DataProcessor } from './dataProcessor.js';

// Configuration
const API_BASE = "http://localhost:8000";

// State Holders
let sunburstChart;

// DOM Elements
const btnAnalyze = document.getElementById("btnAnalyze");
const inputUrl = document.getElementById("repoUrl");
const loadingIndicator = document.getElementById("loading");
const sunburstContainer = document.getElementById("sunburst-container");


/**
 * Application initialization.
 * Sets up chart instances and event listeners.
 */
function init() {
    sunburstChart = new SunburstChart(sunburstContainer);

    btnAnalyze.addEventListener("click", handleAnalyze);

    eventBus.on("hoverFile", (data) => {
        console.log("User hovering:", data.name);
    });

    eventBus.on("selectAuthor", (authorName) => {
         if (authorName) {
            console.log(`Focusing on work by: ${authorName}`);
            // Future: sunburstChart.highlightFilesByAuthor(authorName);
        } else {
            console.log("Cleared author selection");
            // Future: sunburstChart.resetHighlight();
        }
    });
}

/**
 * Handles the "Visualize" button click.
 * Fetches data from Python backend and triggers UI updates.
 */
async function handleAnalyze() {
    const url = inputUrl.value;
    if(!url) return alert("Please enter a URL");

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/analyze?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) throw new Error("Failed to fetch repo data");
        
        const data = await response.json();
        console.log("Data received:", data);
        
        updateDashboard(data);

        

    } catch (error) {
        console.error(error);
        alert("Error analyzing repo: " + error.message);
    } finally {
        setLoading(false);
    }
}

/**
 * Updates all views with fresh data.
 * @param {Object} data - The complete JSON payload from backend.
 */
function updateDashboard(data) {
    if (data.file_tree) {
        const hierarchyData = DataProcessor.processHierarchy(data.file_tree);

        sunburstChart.update(hierarchyData);
        
        const totalLoc = hierarchyData.value.toLocaleString();
        document.getElementById("totalFiles").innerText = `Repository: ${data.meta.repo_name}`;
        document.getElementById("totalLoc").innerText = `${totalLoc} LoC`;
    }
}

/**
 * Toggles loading UI state.
 * @param {boolean} isLoading 
 */
function setLoading(isLoading) {
    if(isLoading) {
        loadingIndicator.classList.remove("hidden");
        btnAnalyze.disabled = true;
        btnAnalyze.innerText = "Analyzing...";
    } else {
        loadingIndicator.classList.add("hidden");
        btnAnalyze.disabled = false;
        btnAnalyze.innerText = "Visualize Repository";
    }
}

init();