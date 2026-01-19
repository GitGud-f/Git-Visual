import eventBus from '../eventBus.js';

/**
 * @class SunburstChart
 * Renders a interactive sunburst chart representing the file system.
 * Implements the Enter/Update/Exit pattern.
 */
export class SunburstChart {

    /**
     * Initializes the SVG context and layout generators.
     * @param {HTMLElement} container - The DOM element to render the chart into.
     */
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth || 600;
        this.height = container.clientHeight || 600;
        this.radius = Math.min(this.width, this.height) / 2;

        this.svg = d3.select(container)
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("viewBox", [0, 0, this.width, this.height])
            .append("g")
            .attr("transform", `translate(${this.width / 2},${this.height / 2})`);

        this.legendContainer = d3.select(container)
            .append("div")
            .attr("class", "sunburst-legend hidden");

        this.partition = d3.partition();

        this.x = d3.scaleLinear().range([0, 2 * Math.PI]);
        this.y = d3.scaleSqrt().range([0, this.radius]);

        this.arc = d3.arc()
            .startAngle(d => Math.max(0, Math.min(2 * Math.PI, this.x(d.x0))))
            .endAngle(d => Math.max(0, Math.min(2 * Math.PI, this.x(d.x1))))
            .innerRadius(d => Math.max(0, this.y(d.y0)))
            .outerRadius(d => Math.max(0, this.y(d.y1)));



        this.color = d3.scaleOrdinal(d3.schemeTableau10);
        this.tooltip = d3.select("#tooltip");
    }

    /**
     * Updates the visualization with new hierarchical data.
     * Handles the complex interpolation of arcs.
     * 
     * @param {d3.HierarchyNode} root - The processed D3 hierarchy object.
     */
    update(root) {
        if (!root) return;
        
        this.focus = root; 
        this.x.domain([0, 1]);
        this.y.domain([0, 1]).range([0, this.radius]);


        const leaves = root.leaves();
        const extensionCounts = d3.rollup(leaves, v => v.length, d => d.data.extension || "other");


        const sortedExtensions = Array.from(extensionCounts).sort((a, b) => b[1] - a[1]);
        const topExtensions = sortedExtensions.slice(0, 12).map(d => d[0]);

        this.color.domain(topExtensions);

        root = this.partition(root);

        const paths = this.svg.selectAll("path")
            .data(root.descendants(), d => {
                return d.ancestors().map(n => n.data.name).reverse().join("/");
            });

        paths.join(
            // ENTER: Create new elements (fade in)
            enter => enter.append("path")
                .attr("class", "slice")
                .style("stroke", "#1e1e2e")       
                .style("stroke-width", "1px")
                 .style("opacity", 0) 
                 .each(function(d) { this._current = d; }) 
                 .attr("d", d => this.arc(d)) 
                .style("fill", d => d.depth === 0 ? "rgba(255,255,255,0.1)" : this.getFileColor(d, topExtensions))
                .style("cursor", "pointer")
                .call(enter => enter.transition().duration(750).style("opacity", 1)),

            // UPDATE: Transition existing elements (interpolate angles)
            update => update
                .style("stroke", "#1e1e2e") 
                .interrupt() 
                .style("fill", d => this.getFileColor(d, topExtensions))
                .call(update => update.transition().duration(750)
                    .attrTween("d", (d, i, nodes) => this.arcTween(d, nodes[i]))
                    .style("opacity", 1)
                ),

            // EXIT: Remove deleted elements (fade out)
            exit => exit.transition().duration(750)
                .style("z-index", -1)
                .style("opacity", 0)
                .remove()
        )
            .on("mouseover", (e, d) => {
                this.handleMouseOver(e, d);
                eventBus.call("hoverFile", this, d.data);
            })
            .on("mousemove", (e) => this.handleMouseMove(e))
            .on("mouseout", (e, d) => this.handleMouseOut(e, d))
            .on("click", (e, d) => this.clickToZoom(d));

        this.renderLegend(sortedExtensions, topExtensions);
    }

    /**
     * Renders the interactive HTML legend.
     * @param {Array} allExtensions - [extension, count] pairs
     * @param {Array} topExtensions - Just the keys of top extensions
     */
    renderLegend(allExtensions, topExtensions) {
        this.legendContainer.classed("hidden", false).html(""); // Clear existing

        let legendData = allExtensions.slice(0, 12);

        const otherCount = allExtensions.slice(12).reduce((sum, current) => sum + current[1], 0);
        if (otherCount > 0) {
            if (!legendData.find(d => d[0] === "other")) {
                legendData.push(["other", otherCount]);
            }
        }

        const items = this.legendContainer.selectAll(".legend-item")
            .data(legendData)
            .enter()
            .append("div")
            .attr("class", "legend-item")
            .attr("data-ext", d => d[0]);

        items.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => this.color(d[0]));

        items.append("span")
            .attr("class", "legend-label")
            .text(d => `${d[0]} (${d[1]})`);

        items.on("mouseover", (e, d) => {
            const ext = d[0];

            this.legendContainer.selectAll(".legend-item")
                .classed("dimmed", true)
                .classed("active", false);
            d3.select(e.currentTarget)
                .classed("dimmed", false)
                .classed("active", true);


            this.svg.selectAll("path")
                .transition().duration(200)
                .style("opacity", node => {

                    if (node.depth === 0) return 0;
                    if (node.children) return 0.1;

                    const nodeExt = this.normalizeExtension(node.data.extension, topExtensions);
                    return nodeExt === ext ? 1 : 0.1;
                });
        })
            .on("mouseout", () => {
                this.legendContainer.selectAll(".legend-item")
                    .classed("dimmed", false)
                    .classed("active", false);

                this.svg.selectAll("path")
                    .transition().duration(200)
                    .style("opacity", 1);
            });
    }

    normalizeExtension(ext, topExtensions) {
        if (!ext) return "other";
        return topExtensions.includes(ext) ? ext : "other";
    }

    /**
     * Determines color based on file type.
     * @param {d3.HierarchyRectangularNode} d - The data point.
     * @returns {string} - The color string.
     */
    getFileColor(d, topExtensions) {
        if (d.depth === 0) return "rgba(255,255,255,0.1)";
        if (d.children) return "#4a4a5e"; // Folders
        const ext = this.normalizeExtension(d.data.extension, topExtensions);
        return this.color(ext);
    }

    /**
     * Custom Tween function to interpolate angles smoothly.
    * @param {d3.HierarchyRectangularNode} newDatapoint - The new data point.
    * @param {SVGPathElement} element - The SVG path element being updated.
    * @returns {function} - The interpolator function for D3 transition.
     */
    arcTween(newDatapoint, element) {
        const previous = element._current || newDatapoint;

        const interpolate = d3.interpolate(previous, newDatapoint);

        element._current = interpolate(1); 

        return t => this.arc(interpolate(t));
    }

    /**
     * Handles tooltip display on hover.
     * @param {Event} event - The mouse event.
     * @param {d3.HierarchyRectangularNode} d - The data point.
     */
    handleMouseOver(event, d) {
        const target = d3.select(event.currentTarget);

        target.style("opacity", 0.8);

        const total = d.ancestors()[d.ancestors().length - 1].value;
        const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;

        this.tooltip.classed("hidden", false)
            .html(`
                <strong>${d.data.name}</strong><br>
                Type: ${d.data.extension || 'Folder'}<br>
                Size: ${d.value.toLocaleString()} LoC<br>
                Share: ${percent}%
            `);

        if (!d.children && d.data.extension) {
            const currentDomain = this.color.domain();
            const ext = this.normalizeExtension(d.data.extension, currentDomain);

            this.legendContainer.selectAll(".legend-item")
                .classed("dimmed", item => item[0] !== ext)
                .classed("active", item => item[0] === ext);
        }

        eventBus.call("hoverFile", this, d.data);
    }


    handleMouseMove(event) {
        this.tooltip
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px");
    }

    handleMouseOut(event, d) {
        this.tooltip.classed("hidden", true);

        // Reset Chart Opacity
        if (event && event.currentTarget) {
            d3.select(event.currentTarget).style("opacity", 1);
        }

        // Reset Legend Opacity
        this.legendContainer.selectAll(".legend-item")
            .classed("dimmed", false)
            .classed("active", false);
    }
    clickToZoom(p) {
        const target = (this.focus === p) ? (p.parent || p) : p;

        this.focus = target;

        this.svg.transition()
            .duration(750)
            .tween("scale", () => {
                const xd = d3.interpolate(this.x.domain(), [target.x0, target.x1]);
            
                const yd = d3.interpolate(this.y.domain(), [target.y0, 1]);
                const yr = d3.interpolate(this.y.range(), [target.y0 ? 20 : 0, this.radius]);
                return t => {
                    this.x.domain(xd(t));
                    this.y.domain(yd(t)).range(yr(t));
                };
            })
            .selectAll("path")
            .attrTween("d", (d) => () => this.arc(d));
    }
}