import { SunburstChart } from './charts/sunburst.js';
import eventBus from './eventBus.js';
import { Streamgraph } from './charts/streamgraph.js';
import { Scatterplot } from './charts/scatterplot.js';
import { DataProcessor } from './dataProcessor.js';
import { CommitGraph } from './charts/commitGraph.js';

// Configuration
const API_BASE = "http://localhost:8000";

// State Holders
let sunburstChart;
let streamChart;
let scatterChart;
let commitGraph;
let pollingTimer = null;

// DOM Elements
const btnAnalyze = document.getElementById("btnAnalyze");
const inputUrl = document.getElementById("repoUrl");
const loadingIndicator = document.getElementById("loading");
const sunburstContainer = document.getElementById("sunburst-container");
const streamContainer = document.getElementById("stream-chart-container");
const streamLegendContainer = document.getElementById("stream-legend-container");
const scatterContainer = document.getElementById("scatterplot-chart-container");
const scatterLegendContainer = document.getElementById("scatterplot-legend-container");
const commitGraphContaineer = document.getElementById("commit-graph-container")

/**
 * Application initialization.
 * Sets up chart instances and event listeners.
 */
function init() {
    sunburstChart = new SunburstChart(sunburstContainer);
    streamChart = new Streamgraph(streamContainer, streamLegendContainer);
    scatterChart = new Scatterplot(scatterContainer, scatterLegendContainer);
    commitGraph = new CommitGraph(commitGraphContaineer);


    btnAnalyze.addEventListener("click", handleAnalyze);

    eventBus.on("hoverFile", (data) => {
        console.log("User hovering:", data.name);
    });

    eventBus.on("selectAuthor", function (authorName) {
        const source = this; // 'this' is the chart instance that triggered the event

        // If an author is selected (Hover ON)
        if (authorName) {
            console.log(`Focusing on work by: ${authorName}`);

            // If the event didn't come from Streamgraph, update Streamgraph
            // Pass 'false' to prevent infinite loop
            if (source !== streamChart) {
                streamChart.highlightAuthor(authorName, false);
            }

            // If the event didn't come from Scatterplot, update Scatterplot
            if (source !== scatterChart) {
                scatterChart.highlightAuthor(authorName, false);
            }
             if (source !== commitGraph) {
                commitGraph.highlightAuthor(authorName, false);
            }

            if (sunburstChart) {
                sunburstChart.highlightAuthor(authorName);
            }
            if (commitGraph)
                commitGraph.highlightAuthor(authorName);
        }
        // If selection is cleared (Hover OFF)
        else {
            sunburstChart.resetHighlight()
            console.log("Cleared author selection");

            if (source !== streamChart) {
                streamChart.resetHighlight(false);
            }
            if (source !== scatterChart) {
                scatterChart.resetHighlight(false);
            }
            if(source !== commitGraph){
                commitGraph.resetHighlight(false);
            }
        }
    });
}

/**
 * Handles the "Visualize" button click.
 * Fetches data from Python backend and triggers UI updates.
 */
async function handleAnalyze() {
    const url = inputUrl.value;
    if (!url) return alert("Please enter a URL");

    setLoading(true);

    if (pollingTimer) {
        clearTimeout(pollingTimer);
        pollingTimer = null;
    }

    try {
        // Initial Load
        const response = await fetch(`${API_BASE}/analyze?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error("Failed to fetch repo data");

        let data = await response.json();
        updateDashboard(data);

        let currentHash = data.history[0].hash;

        const pollForUpdates = async () => {
            try {
                console.log("Checking for updates...");

                const checkResponse = await fetch(`${API_BASE}/check_update?url=${encodeURIComponent(url)}&last_commit_hash=${currentHash}`);

                const checkStatus = await checkResponse.json();

                if (checkStatus.has_update) {
                    console.log("Update detected! Re-analyzing...");

                    const analyzeResponse = await fetch(`${API_BASE}/analyze?url=${encodeURIComponent(url)}`);
                    const newData = await analyzeResponse.json();

                    updateDashboard(newData);
                    currentHash = newData.history[0].hash;

                    showNotification("New commit detected! Dashboard updated.");
                } else {
                    console.log("No updates.");
                }
            } catch (err) {
                console.warn("Polling error:", err);
            }

            pollingTimer = setTimeout(pollForUpdates, 10000);
        };

        pollingTimer = setTimeout(pollForUpdates, 10000);

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
    if (data.file_tree && data.history) {
        const hierarchyData = DataProcessor.processHierarchy(data.file_tree);
        sunburstChart.update(hierarchyData);

        const totalLoc = hierarchyData.value.toLocaleString();
        document.getElementById("totalFiles").innerText = `Repository: ${data.meta.repo_name}`;
        document.getElementById("totalLoc").innerText = `${totalLoc} LoC`;
    }
    if (data.history) {
        const streamData = DataProcessor.processCommitsByAuthor(data.history);
        streamChart.update(streamData);

        const scatterData = DataProcessor.processScatterplotData(data.history);
        scatterChart.update(scatterData);

        const graphData = DataProcessor.processCommitGraph(data.history);
        commitGraph.update(graphData);
    }

}

/**
 * Toggles loading UI state.
 * @param {boolean} isLoading 
 */
function setLoading(isLoading) {
    if (isLoading) {
        loadingIndicator.classList.remove("hidden");
        btnAnalyze.disabled = true;
        btnAnalyze.innerText = "Analyzing...";
    } else {
        loadingIndicator.classList.add("hidden");
        btnAnalyze.disabled = false;
        btnAnalyze.innerText = "Visualize Repository";
    }
}

function showNotification(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

init();