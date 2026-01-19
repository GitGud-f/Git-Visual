import eventBus from '../eventBus.js';

export class CommitGraph {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select(container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, this.width, this.height]);

        this.g = this.svg.append("g");

        // Arrowhead definition for links
        this.svg.append("defs").append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#4a4a5e");

        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(50)) // Increased distance for horizontal clarity
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            // New Horizontal Constraint: Time on X-axis
            .force("x", d3.forceX(d => {
                const timeScale = d3.scaleTime()
                    .domain(d3.extent(this.nodes, n => new Date(n.date)))
                    .range([50, this.width - 50]); // Margin of 50px
                return timeScale(new Date(d.date));
            }).strength(1.5))
            // New Vertical Constraint: Stay in the middle
            .force("y", d3.forceY(this.height / 2).strength(0.2));


        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip graph-tooltip hidden");
        this.color = d3.scaleOrdinal(d3.schemeTableau10);
    }

    update(data) {
        this.nodes = data.nodes;
        this.links = data.links;

        // Enter/Update/Exit for Links
        this.linkElements = this.g.selectAll(".commit-link")
            .data(this.links)
            .join("line")
            .attr("class", "commit-link")
            .attr("stroke", "#4a4a5e")
            .attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead)");

        // Enter/Update/Exit for Nodes
        this.nodeElements = this.g.selectAll(".commit-node")
            .data(this.nodes, d => d.hash)
            .join(
                enter => enter.append("circle")
                    .attr("class", "commit-node")
                    .attr("r", 5)
                    .attr("fill", d => this.color(d.author))
                    .call(enter => enter.transition().attr("r", 6)),
                update => update,
                exit => exit.remove()
            )
            .on("mouseover", (e, d) => {
                this.showTooltip(e, d);
                eventBus.call("selectAuthor", this, d.author);
            })
            .on("mouseout", () => {
                this.hideTooltip();
                this.resetHighlight(true);
                eventBus.call("selectAuthor", this, null);
            });

        this.simulation.nodes(this.nodes);
        this.simulation.force("link").links(this.links);

        const timeScale = d3.scaleTime()
            .domain(d3.extent(this.nodes, n => new Date(n.date)))
            .range([50, this.width - 50]);

        this.simulation.force("x", d3.forceX(d => timeScale(new Date(d.date))).strength(1.5));

        this.simulation.alpha(1).restart();

        this.simulation.on("tick", () => {
            this.linkElements
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            this.nodeElements
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });
    }


    highlightAuthor(authorName) {
        this.nodeElements
            .transition().duration(200)
            .attr("opacity", d => (d.author === authorName || !authorName) ? 1 : 0.1)
            .attr("r", d => d.author === authorName ? 8 : 5);
    }
    /**
 * Resets the visual state of the graph.
 * @param {boolean} broadcast - Whether to notify other charts via the eventBus.
 */
    resetHighlight(broadcast = true) {
        // 1. Restore Nodes
        this.nodeElements
            .transition().duration(200)
            .attr("opacity", 1)
            .attr("r", 6) // Matches original size in update()
            .style("stroke", "#1e1e2e")
            .style("stroke-width", "1.5px");

        // 2. Restore Links
        this.linkElements
            .transition().duration(200)
            .attr("stroke-opacity", 0.4)
            .attr("stroke", "#4a4a5e")
            .attr("stroke-width", 1);

        // 3. Broadcast to others (if needed)
        // We pass 'this' as the context so main.js knows NOT to call highlight back on this chart
        if (broadcast) {
            eventBus.call("selectAuthor", this, null);
        }
    }


    showTooltip(event, d) {
        this.tooltip.classed("hidden", false)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 20) + "px")
            .html(`
            <strong>${d.author}</strong>
            <div style="margin-bottom: 5px; font-size: 0.8em; color: #aaa;">${d.hash.substring(0, 7)}</div>
            <div>${d.msg}</div>
            <div style="margin-top: 5px; color: #64ffda;">Impact: ${d.impact} LOC</div>
        `);
    }

    hideTooltip() {
        this.tooltip.classed("hidden", true);
    }
}