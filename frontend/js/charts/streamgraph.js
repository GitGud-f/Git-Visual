import eventBus from '../eventBus.js';

export class Streamgraph {
    constructor(container) {
        this.container = container;
        
        // Clear placeholder text if it exists
        this.container.innerHTML = "";

        // Dimensions
        this.margin = { top: 20, right: 30, bottom: 30, left: 30 };
        this.width = container.clientWidth - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom; // Fixed height for the panel

        // SVG Setup
        this.svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Scales
        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        this.color = d3.scaleOrdinal(d3.schemeTableau10);

        // Generators
        this.area = d3.area()
            .curve(d3.curveBasis) // Smooth curves
            .x(d => this.x(d.data.date))
            .y0(d => this.y(d[0]))
            .y1(d => this.y(d[1]));

        this.stack = d3.stack()
            .offset(d3.stackOffsetSilhouette); // Centers the stream

        // Tooltip (reusing the global one or creating a local one)
        this.tooltip = d3.select("#tooltip");

        // Axis groups
        this.xAxisGroup = this.svg.append("g")
            .attr("transform", `translate(0,${this.height})`);
    }

    update(chartData) {
        if (!chartData || chartData.data.length === 0) return;

        const { data, keys } = chartData;

        // Update Domains
        this.x.domain(d3.extent(data, d => d.date));
        this.color.domain(keys);

        // Create Stack
        this.stack.keys(keys);
        const layers = this.stack(data);

        // Update Y Domain based on the stacked layers
        this.y.domain([
            d3.min(layers, layer => d3.min(layer, d => d[0])),
            d3.max(layers, layer => d3.max(layer, d => d[1]))
        ]);

        // Render Layers
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
                    .style("fill", d => this.color(d.key))), // Update color in case keys shift

            exit => exit.remove()
        )
        .on("mouseover", (e, d) => this.handleHover(e, d))
        .on("mousemove", (e) => this.handleMove(e))
        .on("mouseout", () => this.handleOut());

        // Update Axis
        this.xAxisGroup.transition().duration(1000).call(d3.axisBottom(this.x));
    }

    handleHover(event, d) {
        // 1. DIM OTHER LAYERS
        d3.selectAll(".layer").style("opacity", 0.4);
        d3.select(event.currentTarget).style("opacity", 1);

        // 2. SHOW TOOLTIP
        const authorName = d.key;
        this.tooltip.classed("hidden", false)
            .html(`<strong>Author:</strong> ${authorName}`);

        // 3. BROADCAST EVENT (The Missing Piece)
        // We tell the rest of the app: "User selected this author"
        eventBus.call("selectAuthor", this, authorName);
    }

    handleMove(event) {
        this.tooltip
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px");
    }

    handleOut() {
        d3.selectAll(".layer").style("opacity", 0.9);
        this.tooltip.classed("hidden", true);

        eventBus.call("selectAuthor", this, null);
    }
}