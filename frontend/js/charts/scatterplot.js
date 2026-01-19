import eventBus from '../eventBus.js';

export class Scatterplot {
    constructor(container, legendContainer) {
        this.container = container;
        this.legendContainer = d3.select(legendContainer).attr("class", "hidden");
        
        this.margin = { top: 20, right: 20, bottom: 40, left: 50 };

        const totalWidth = container.clientWidth;
        const totalHeight = container.clientHeight;
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;

        d3.select(container).selectAll("svg").remove();
        this.svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, totalWidth, totalHeight])
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.plotArea = this.svg.append("g").attr("class", "plot-area");
        this.xAxisGroup = this.svg.append("g").attr("transform", `translate(0,${this.height})`);
        this.yAxisGroup = this.svg.append("g");

        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip scatter-tooltip hidden");

        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleSymlog().constant(10).range([this.height, 0]); 
        this.color = d3.scaleOrdinal(d3.schemeTableau10);
    }

    update(data) {
        if (!data || data.length === 0) return;

        this.x.domain(d3.extent(data, d => d.dateObj));
        this.y.domain([0, d3.max(data, d => d.impact)]);
        
        const topAuthors = Array.from(d3.rollup(data, v => v.length, d => d.author))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(d => d[0]);
        this.color.domain(topAuthors);

        this.xAxisGroup.call(d3.axisBottom(this.x).ticks(5).tickSizeOuter(0));
        this.yAxisGroup.call(d3.axisLeft(this.y).ticks(5));

        this.svg.selectAll(".domain, .tick line").style("stroke", "#36364e");
        this.svg.selectAll("text").style("fill", "#a0a0b0");

        // Render Points
        this.plotArea.selectAll("circle")
            .data(data, d => d.hash)
            .join(
                enter => enter.append("circle")
                    .attr("cx", d => this.x(d.dateObj))
                    .attr("cy", d => this.y(d.impact))
                    .attr("r", 0)
                    .attr("fill", d => this.color(d.author))
                    .attr("opacity", 0.7)
                    .call(enter => enter.transition().duration(800).attr("r", 3.5)),
                update => update.transition().duration(800)
                    .attr("cx", d => this.x(d.dateObj))
                    .attr("cy", d => this.y(d.impact))
                    .attr("fill", d => this.color(d.author))
            )
            // --- EVENT BUS INTEGRATION ---
            .on("mouseover", (e, d) => {
                this.showTooltip(e, d);
                // Trigger global selection
                this.highlightAuthor(d.author); 
            })
            .on("mouseout", () => {
                this.hideTooltip();
                // Reset global selection
                this.resetHighlight();
            });

        this.renderLegend(topAuthors);
    }

    renderLegend(authors) {
        this.legendContainer.html("");
        this.legendContainer.classed("hidden", false);
        authors.forEach(author => {
            const item = this.legendContainer.append("div")
                .attr("class", "legend-item")
                .style("cursor", "pointer") // Visual cue
                // --- EVENT BUS INTEGRATION ---
                .on("mouseover", () => this.highlightAuthor(author))
                .on("mouseout", () => this.resetHighlight());

            item.append("div")
                .style("background-color", this.color(author))
                .attr("class", "legend-color-box");
            
            item.append("span").text(author);
        });
    }

  

    /**
     * Highlights commits by a specific author.
     * Can be called internally (interaction) or externally (from Streamgraph via main.js)
     */
    highlightAuthor(authorName) {
        // 1. Visual Update: Dim non-matching circles
        this.plotArea.selectAll("circle")
            .transition().duration(200)
            .attr("opacity", d => d.author === authorName ? 1 : 0.1)
            .attr("r", d => d.author === authorName ? 6 : 3.5);

        // 2. Visual Update: Highlight legend
        this.legendContainer.selectAll(".legend-item")
            .style("opacity", (d, i, nodes) => {
                const text = d3.select(nodes[i]).text();
                return text === authorName ? 1 : 0.3;
            })
            .style("font-weight", (d, i, nodes) => {
                const text = d3.select(nodes[i]).text();
                return text === authorName ? "bold" : "normal";
            });

        // 3. Broadcast Event
        // (Use .call to pass 'this' context, enabling main.js to avoid infinite loops if needed)
        eventBus.call("selectAuthor", this, authorName);
    }

    resetHighlight() {
        // 1. Reset Visuals
        this.plotArea.selectAll("circle")
            .transition().duration(200)
            .attr("opacity", 0.7)
            .attr("r", 3.5);

        this.legendContainer.selectAll(".legend-item")
            .style("opacity", 1)
            .style("font-weight", "normal");

        // 2. Broadcast Reset
        eventBus.call("selectAuthor", this, null);
    }

    showTooltip(event, d) {
        this.tooltip.classed("hidden", false)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px")
            .html(`
                <strong>${d.author}</strong><br/>
                Date: ${d.dateObj.toLocaleDateString()}<br/>
                Impact: ${d.impact} LOC<br/>
                <span style="color:#aaa; font-size:0.8em">${d.msg.slice(0, 50)}...</span>
            `);
    }

    hideTooltip() {
        this.tooltip.classed("hidden", true);
    }
}