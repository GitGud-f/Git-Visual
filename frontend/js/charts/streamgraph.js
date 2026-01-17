import eventBus from '../eventBus.js';

export class Streamgraph {
    constructor(container, legendContainer) {
        this.container = container;
        this.legendContainer = d3.select(legendContainer);
        
        // Dimensions
        // We use clientWidth/Height of the new flex child
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // SVG Setup
        this.svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, this.width, this.height])
            .attr("preserveAspectRatio", "none") // Allow stretching in flex
            .append("g");

        // Scales
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

        this.tooltip = d3.select("#tooltip");

        // Axis
        this.xAxisGroup = this.svg.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${this.height})`);
    }

    update(chartData) {
        if (!chartData || chartData.data.length === 0) {
            this.container.innerHTML = "<div class='placeholder-text'>No history data available</div>";
            return;
        }

        const { data, keys } = chartData;

        // 1. Update Domains
        this.x.domain(d3.extent(data, d => d.date));
        this.color.domain(keys);

        // 2. Stack Data
        this.stack.keys(keys);
        const layers = this.stack(data);

        // 3. Update Y Scale
        this.y.domain([
            d3.min(layers, layer => d3.min(layer, d => d[0])),
            d3.max(layers, layer => d3.max(layer, d => d[1]))
        ]);

        // 4. Render Areas
        const paths = this.svg.selectAll(".layer")
            .data(layers, d => d.key);

        paths.join(
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

        // 5. Render Axis
        this.xAxisGroup.transition().duration(1000).call(d3.axisBottom(this.x).ticks(5));

        // 6. Render Legend
        this.renderLegend(keys);
    }

    renderLegend(keys) {
        this.legendContainer.html(""); // Clear previous

        // The data processor has already sorted top 10 and added "Others"
        // We just iterate what is given.
        
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
            .attr("title", d => d); // Tooltip for truncated names
    }

    highlightAuthor(authorName) {
        // Highlight Graph Layers
        this.svg.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", d => d.key === authorName ? 1 : 0.2);

        // Highlight Legend Items
        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", d => d === authorName)
            .classed("dimmed", d => d !== authorName);

        // Broadcast
        eventBus.call("selectAuthor", this, authorName);
    }

    resetHighlight() {
        this.svg.selectAll(".layer")
            .transition().duration(200)
            .style("opacity", 0.9);

        this.legendContainer.selectAll(".stream-legend-item")
            .classed("active", false)
            .classed("dimmed", false);

        eventBus.call("selectAuthor", this, null);
    }
}