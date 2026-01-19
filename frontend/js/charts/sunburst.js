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

        this.x = d3.scaleLinear().domain([0, 1]).range([0, 2 * Math.PI]);
        this.y = d3.scaleSqrt().domain([0, 1]).range([0, this.radius]);

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

        const leaves = root.leaves();
        const extensionCounts = d3.rollup(leaves, v => v.length, d => d.data.extension || "other");


        const sortedExtensions = Array.from(extensionCounts).sort((a, b) => b[1] - a[1]);


        const currentExtensions = sortedExtensions.map(d => d[0]);
        const existingDomain = this.color.domain();
        const newExtensions = currentExtensions.filter(ext => !existingDomain.includes(ext));
        this.color.domain([...existingDomain, ...newExtensions]);
        const topExtensions = sortedExtensions.slice(0, 12).map(d => d[0]);

        this.currentTopExtensions = topExtensions;

        root = this.partition(root);

        const paths = this.svg.selectAll("path")
            .data(root.descendants(), d => {
                return d.ancestors().map(n => n.data.name).reverse().join("/");
            });

        paths.join(
            // ENTER: Create new elements (fade in)
            enter => enter.append("path")
                .attr("d", this.arc)
                .style("stroke", "#1e1e2e")
                .style("stroke-width", "1px")
                .style("fill", d => this.getFileColor(d))
                .style("cursor", "pointer")
                .style("opacity", 0)
                // Cache the initial state for future transitions
                .each(function (d) {
                    this._current = { x0: d.x0, x1: d.x0, y0: d.y0, y1: d.y1 };
                })
                .call(enter => enter.transition().duration(750)
                    .style("opacity", 1)
                    .attrTween("d", (d, i, nodes) => this.arcTween(d, nodes[i]))
                ),

            update => update
                .call(update => update.transition().duration(750)
                    // This is the core fix: interpolate "d" for EVERY node
                    .attrTween("d", (d, i, nodes) => this.arcTween(d, nodes[i]))
                )
                // Update colors in case a folder became a file or vice versa
                .style("fill", d => this.getFileColor(d)),

            exit => exit.transition().duration(750)
                .style("opacity", 0)
                .attrTween("d", (d, i, nodes) => {
                    const endState = { x0: d.x0, x1: d.x0, y0: d.y0, y1: d.y1 };
                    const interp = d3.interpolate(this._current || d, endState);
                    return t => this.arc(interp(t));
                })
                .remove()
        )
            // Re-bind events to the new/updated elements
            .on("mouseover", (e, d) => this.handleMouseOver(e, d))
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

                    const nodeExt = this.normalizeExtension(node.data.extension);
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

    normalizeExtension(ext) {
        if (!ext || !this.currentTopExtensions.includes(ext)) {
            return "other";
        }
        return ext;
    }

    /**
     * Determines color based on file type.
     * @param {d3.HierarchyRectangularNode} d - The data point.
     * @returns {string} - The color string.
     */
    getFileColor(d) {
        if (d.depth === 0) return "rgba(255,255,255,0.1)";
        if (d.children) return "#4a4a5e"; // Folders
        const ext = this.normalizeExtension(d.data.extension);
        if (ext === "other") return "#7f8c8d";
        return this.color(ext);
    }

    /**
     * Custom Tween function to interpolate angles smoothly.
    * @param {d3.HierarchyRectangularNode} newDatapoint - The new data point.
    * @param {SVGPathElement} element - The SVG path element being updated.
    * @returns {function} - The interpolator function for D3 transition.
     */
    arcTween(d, element) {
        const oldCoords = {
            x0: element._current.x0,
            x1: element._current.x1,
            y0: element._current.y0,
            y1: element._current.y1
        };
        const newCoords = {
            x0: d.x0,
            x1: d.x1,
            y0: d.y0,
            y1: d.y1
        };

        const i = d3.interpolate(oldCoords, newCoords);

        element._current = newCoords;

        return (t) => {
            // Return the path string for the interpolated coordinates
            return this.arc(i(t));
        };
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

        if (!d.children) {
            const extToHighlight = this.normalizeExtension(d.data.extension);

            this.legendContainer.selectAll(".legend-item")
                .classed("dimmed", item => item[0] !== extToHighlight)
                .classed("active", item => item[0] === extToHighlight);
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

    highlightAuthor(authorName) {
        if (!authorName) {
            this.resetHighlight();
            return;
        }

        this.svg.selectAll("path")
            .transition().duration(200)
            .style("opacity", d => {
                // Check if the author exists in this node's aggregated authors list
                const isRelated = d.authors && d.authors.includes(authorName);
                return isRelated ? 1 : 0.1;
            })
            .style("stroke", d => {
                const isRelated = d.authors && d.authors.includes(authorName);
                return isRelated ? "#fff" : "#1e1e2e";
            });
    }

    resetHighlight() {
        this.svg.selectAll("path")
            .transition().duration(200)
            .style("opacity", 1)
            .style("stroke", "#1e1e2e");
    }
}