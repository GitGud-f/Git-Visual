import eventBus from '../eventBus.js';

/**
 * @class SunburstChart
 * Renders a zoomable/interactive sunburst chart representing the file system.
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

        this.partition = d3.partition()
            .size([2 * Math.PI, this.radius]);

        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(0.005)
            .padRadius(this.radius / 2)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1 - 1);

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

        root = this.partition(root);

        const paths = this.svg.selectAll("path")
            .data(root.descendants(), d => {
                return d.ancestors().map(n => n.data.name).reverse().join("/");
            });

        paths.join(
             // ENTER: Create new elements (fade in)
            enter => enter.append("path")
                .attr("display", d => d.depth ? null : "none")
                .attr("d", this.arc) 
                .style("fill", d => this.getFileColor(d))
                .style("opacity", 0)
                .each(function(d) { this._current = d; }) 
                .call(enter => enter.transition().duration(750).style("opacity", 1)),

            // UPDATE: Transition existing elements (interpolate angles)
            update => update
                .style("fill", d => this.getFileColor(d)) 
                .call(update => update.transition().duration(750)
                    .attrTween("d", (d, i, nodes) => this.arcTween(d, nodes[i])) 
                ),
            
            // EXIT: Remove deleted elements (fade out)
            exit => exit.transition().duration(750)
                .style("opacity", 0)
                .remove()
        )
        .on("mouseover", (e, d) => {
            this.handleMouseOver(e, d);
            eventBus.call("hoverFile", this, d.data);
        })
        .on("mousemove", (e) => this.handleMouseMove(e))
        .on("mouseout", () => this.handleMouseOut());
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
        
        element._current = interpolate(0);
        
        return t => this.arc(interpolate(t));
    }

    /**
     * Determines color based on file type.
     * @param {d3.HierarchyRectangularNode} d - The data point.
     * @returns {string} - The color string.
     */
    getFileColor(d) {
        if (d.children) return "#4a4a5e"; 
        return this.color(d.data.extension || "other");
    }

    /**
     * Handles tooltip display on hover.
     * @param {Event} event - The mouse event.
     * @param {d3.HierarchyRectangularNode} d - The data point.
     */
    handleMouseOver(event, d) {
        d3.select(event.currentTarget).style("opacity", 0.8);
    
        const total = d.ancestors()[d.ancestors().length - 1].value;
        const percent = ((d.value / total) * 100).toFixed(1);

        this.tooltip.classed("hidden", false)
            .html(`
                <strong>${d.data.name}</strong><br>
                Type: ${d.data.extension || 'Folder'}<br>
                Size: ${d.value.toLocaleString()} LoC<br>
                Share: ${percent}%
            `);
    }

    handleMouseMove(event) {
        this.tooltip
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px"); 
    }

    handleMouseOut() {
        this.tooltip.classed("hidden", true);
        this.svg.selectAll("path").style("opacity", 1);
    }
}