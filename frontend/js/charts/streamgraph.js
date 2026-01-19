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
        this.marginContext = { top: 0, right: 20, bottom: 20, left: 30 };

        // 2. Get Total Dimensions
        const totalWidth = container.clientWidth;
        const totalHeight = container.clientHeight;

        // 3. Calculate Inner Drawing Dimensions
        this.width = totalWidth - this.margin.left - this.margin.right;
        this.height = totalHeight - this.margin.top - this.margin.bottom;
        this.heightContext = 30;

        // 4. Setup SVG with Group Transform
        // We use selectAll("svg").join... pattern to ensure we don't duplicate on re-init
        d3.select(container).selectAll("svg").remove();

        this.svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "80%")
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

        this.context = this.svg.append("g")
            .attr("class", "context")
            .attr("transform", `translate(${this.marginContext.left},${this.marginContext.top + this.heightContext + 350})`);

        // 6. Scales
        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);

        this.xContext = d3.scaleTime().range([0, this.width]);
        this.yContext = d3.scaleLinear().range([this.heightContext, 0]);

        this.color = d3.scaleOrdinal(d3.schemeTableau10);

        // Generators
        this.area = d3.area()
            .curve(d3.curveBasis)
            .x(d => this.x(d.data.date))
            .y0(d => this.y(d[0]))
            .y1(d => this.y(d[1]));

        this.areaContext = d3.area()
            .curve(d3.curveBasis)
            .x(d => this.xContext(d.data.date))
            .y0(this.heightContext)
            .y1(d => this.yContext(d[1]));
        
        this.stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)
            .order(d3.stackOrderNone);

        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.heightContext]])
            .on("brush end", (event) => this.brushed(event));
    }

    update(chartData) {
        if (!chartData || chartData.data.length === 0) {
            this.container.innerHTML = "<div class='placeholder-text'>No history data available</div>";
            return;
        }

        const { data, keys } = chartData;

        // Update Domains
        this.x.domain(d3.extent(data, d => d.date));
        this.xContext.domain(d3.extent(data, d => d.date));
        this.color.domain(keys);

        // Stack Data
        this.stack.keys(keys);
        const layers = this.stack(data);
        const layersContext = d3.stack().keys(keys).offset(d3.stackOffsetNone)(data);
        // Update Y Domain
        this.y.domain([
            d3.min(layers, layer => d3.min(layer, d => d[0])),
            d3.max(layers, layer => d3.max(layer, d => d[1]))
        ]);

        this.yContext.domain([0, d3.max(layersContext, layer => d3.max(layer, d => d[1]))]);

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


        this.context.selectAll(".context-layer")
            .data(layersContext)
            .join("path")
            .attr("class", "context-layer")
            .attr("d", this.areaContext)
            .style("fill", d => this.color(d.key))
            .style("opacity", 0.3);

        // 6. Append Brush
        // Remove old brush to prevent duplicates on re-update
        this.context.selectAll(".brush").remove();
        
        this.brushGroup = this.context.append("g")
            .attr("class", "brush")
            .call(this.brush);

        this.drawXAxis();

        this.context.selectAll(".axis-context").remove();
        this.context.append("g")
            .attr("class", "axis-context")
            .attr("transform", `translate(0,${this.heightContext})`)
            .call(d3.axisBottom(this.xContext).ticks(5).tickSize(0))
            .select(".domain").remove();

        this.renderLegend(keys);
    }
     drawXAxis() {
        this.xAxisGroup.call(d3.axisBottom(this.x)
            .ticks(5) // Reduced ticks to fit better when zoomed
            .tickFormat(d3.timeFormat("%b %d")));

        // Style Axis
        this.xAxisGroup.selectAll("text")
            .style("fill", "#a0a0b0")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
            
        this.xAxisGroup.select(".domain").remove();
        this.xAxisGroup.selectAll(".tick line").style("stroke", "#ffffff");
    }
    brushed(event) {
        const selection = event.selection;
        let extent;
        
        if (selection) {
            // Convert pixels to Dates
            extent = [
                this.xContext.invert(selection[0]),
                this.xContext.invert(selection[1])
            ];
            
            // 1. Update the Main Chart's X Domain
            this.x.domain(extent);
        } else {
            // Reset to full extent
            extent = this.xContext.domain();
            this.x.domain(extent);
        }

        // 2. Redraw the Main Chart (Focus)
        // We use .attr directly here for performance (no transition needed during drag)
        this.layerGroup.selectAll(".layer")
            .attr("d", this.area);

        // 3. Redraw the Axis
        this.drawXAxis();

        // 4. Broadcast the date range to Scatterplot
        eventBus.call("filterTime", this, extent);
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

    highlightAuthor(authorName, broadcast = true) {
        this.layerGroup.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", d => d.key === authorName ? 1 : 0.2);


        this.context.selectAll(".context-layer")
            .transition().duration(200)
            .style("opacity", d => d.key === authorName ? 0.8 : 0.1);


        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", d => d === authorName)
            .classed("dimmed", d => d !== authorName);

            if (broadcast)
            {
                eventBus.call("selectAuthor", this, authorName);
            }
        
    }

    resetHighlight(broadcast = true) {
        this.layerGroup.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", 0.9);

        this.context.selectAll(".context-layer")
            .transition().duration(200)
            .style("opacity", 0.3);

        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", false)
            .classed("dimmed", false);
        if (broadcast)
        {
            eventBus.call("selectAuthor", this, null);
        }
    }
}