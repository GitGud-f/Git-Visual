import eventBus from '../eventBus.js';

/**
 * @class Streamgraph Chart Class
 * Renders a streamgraph visualization of contributions over time.
 */
export class Streamgraph {
    /**
     * 
     * @param {*} container 
     * @param {*} legendContainer 
     * Initializes the Streamgraph chart within the given container.
     */
    constructor(container, legendContainer) {
        this.container = container;
        this.legendContainer = d3.select(legendContainer).attr("class", "hidden");
        
        // 1. Define Margins
        // Increased 'bottom' to 60px to accommodate rotated text
        this.margin = { top: 20, right: 20, bottom: 60, left: 30 };

        // 2. Get Total Dimensions
        const totalWidth = container.clientWidth;
        const totalHeight = container.clientHeight;

        // 3. Calculate Inner Drawing Dimensions
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;

        // 4. Setup SVG with Group Transform
        // We use selectAll("svg").join... pattern to ensure we don't duplicate on re-init
        d3.select(container).selectAll("svg").remove();

        this.svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, totalWidth, totalHeight]) 
            .attr("preserveAspectRatio", "none")
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // 5. Create Groups for Layering
        // Layers go first (background)
        this.layerGroup = this.svg.append("g").attr("class", "layers");
        
        // Axis goes second (foreground)
        this.xAxisGroup = this.svg.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${this.height})`);

        // 6. Scales
        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        this.color = d3.scaleOrdinal(d3.schemeTableau10);

        // Generators
        this.area = d3.area()
            .curve(d3.curveBasis)
            .x(d => this.x(d.data.date))
            .y0(d => this.y(d[0]))
            .y1(d => this.y(d[1]));

        this.stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)
            .order(d3.stackOrderNone);
    }

    update(chartData) {
        if (!chartData || chartData.data.length === 0) {
            this.container.innerHTML = "<div class='placeholder-text'>No history data available</div>";
            return;
        }

        const { data, keys } = chartData;

        // Update Domains
        this.x.domain(d3.extent(data, d => d.date));
        this.color.domain(keys);

        // Stack Data
        this.stack.keys(keys);
        const layers = this.stack(data);

        // Update Y Domain
        this.y.domain([
            d3.min(layers, layer => d3.min(layer, d => d[0])),
            d3.max(layers, layer => d3.max(layer, d => d[1]))
        ]);

        // Render Layers
        this.layerGroup.selectAll(".layer")
            .data(layers, d => d.key)
            .join(
                enter => enter.append("path")
                    .attr("class", "layer")
                    .style("fill", d => this.color(d.key))
                    .style("opacity", 0)
                    .attr("d", this.area)
                    .call(enter => enter.transition().duration(1000).style("opacity", 0.9)),
                
                update => update
                    .call(update => update.transition().duration(1000)
                        .attr("d", this.area)
                        .style("fill", d => this.color(d.key)))
            )
            .on("mouseover", (e, d) => this.highlightAuthor(d.key))
            .on("mouseout", () => this.resetHighlight());

        // 7. Render Axis (Every Week)
        const axis = d3.axisBottom(this.x)
            .ticks(d3.timeWeek.every(1)) 
            .tickFormat(d3.timeFormat("%b %d"))
            .tickSizeOuter(0);

        // Call axis and styling immediately
        this.xAxisGroup
            .call(axis);

        // Style the text elements 
        this.xAxisGroup.selectAll("text")
            .style("fill", "#a0a0b0")
            .style("font-size", "10px")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)"); // <--- Rotate text
            
        // Remove the solid axis line
        this.xAxisGroup.select(".domain");
        this.xAxisGroup.selectAll(".tick line").style("stroke", "#ffffff");

        this.renderLegend(keys);
    }
    
    // ... renderLegend, highlightAuthor, resetHighlight (Keep existing code) ...
    renderLegend(keys) {
        this.legendContainer.html(""); 
        this.legendContainer.classed("hidden", false);
        
        const items = this.legendContainer.selectAll(".stream-legend-item")
            .data(keys)
            .enter()
            .append("div")
            .attr("class", "stream-legend-item")
            .on("mouseover", (e, d) => this.highlightAuthor(d))
            .on("mouseout", () => this.resetHighlight());

        items.append("div")
            .attr("class", "stream-legend-color")
            .style("background-color", d => this.color(d));

        items.append("div")
            .attr("class", "stream-legend-name")
            .text(d => d)
            .attr("title", d => d);
    }

    highlightAuthor(authorName) {
        this.layerGroup.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", d => d.key === authorName ? 1 : 0.2);

        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", d => d === authorName)
            .classed("dimmed", d => d !== authorName);

        eventBus.call("selectAuthor", this, authorName);
    }

    resetHighlight() {
        this.layerGroup.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", 0.9);

        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", false)
            .classed("dimmed", false);

        eventBus.call("selectAuthor", this, null);
    }
}