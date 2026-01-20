import eventBus from '../eventBus.js';

export class CommitGraph {
    constructor(container) {
        this.container = container;
        this.margin = { top: 40, right: 50, bottom: 40, left: 80 };
        
        // Setup SVG
        this.svg = d3.select(container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%");

        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Sub-groups for layering (Links behind nodes)
        this.linkLayer = this.g.append("g").attr("class", "links-layer");
        this.nodeLayer = this.g.append("g").attr("class", "nodes-layer");

        // Scales
        this.x = d3.scaleTime();
        this.y = d3.scalePoint().padding(0.5);
        this.color = d3.scaleOrdinal(d3.schemeTableau10);
        this.radiusScale = d3.scaleSqrt().range([4, 12]);

        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip graph-tooltip hidden");
        }

    update(data) {
        this.nodes = data.nodes;
        this.links = data.links;

        const width = this.container.clientWidth - this.margin.left - this.margin.right;
        const height = this.container.clientHeight - this.margin.top - this.margin.bottom;

        // 1. Setup Scales
        this.x.domain(d3.extent(this.nodes, d => new Date(d.date))).range([0, width]);
        
        const authors = Array.from(new Set(this.nodes.map(d => d.author)));
        this.y.domain(authors).range([0, height]);
        
        this.radiusScale.domain([0, d3.max(this.nodes, d => d.impact || 0)]);

        // 2. Build a lookup map for coordinates
        const nodeMap = new Map(this.nodes.map(d => [d.hash, d]));

        // 3. Render Links (Metro Line Style)
        this.linkLayer.selectAll(".commit-link")
            .data(this.links)
            .join("path")
            .attr("class", "commit-link")
            .attr("d", d => {
                const source = nodeMap.get(d.source);
                const target = nodeMap.get(d.target);
                if (!source || !target) return null;

                const x0 = this.x(new Date(source.date));
                const y0 = this.y(source.author);
                const x1 = this.x(new Date(target.date));
                const y1 = this.y(target.author);

                // Professional "Metro" Curve: Horizontal -> Curve -> Horizontal
                return `M ${x0} ${y0} 
                        C ${(x0 + x1) / 2} ${y0}, 
                          ${(x0 + x1) / 2} ${y1}, 
                          ${x1} ${y1}`;
            })
            .attr("stroke", d => this.color(nodeMap.get(d.target).author))
            .attr("stroke-width", 10)
            .attr("fill", "none")
            .attr("opacity", 0.9);

        // 4. Render Nodes
        this.nodeLayer.selectAll(".commit-node")
            .data(this.nodes, d => d.hash)
            .join(
                enter => enter.append("circle")
                    .attr("class", "commit-node")
                    .attr("r", d => this.radiusScale(d.impact))
                    .attr("cx", d => this.x(new Date(d.date)))
                    .attr("cy", d => this.y(d.author))
                    .attr("fill", d => this.color(d.author))
                    .style("stroke", "#fff")
                    .style("stroke-width", 2)
                    .attr("opacity", 0)
                    .call(e => e.transition().duration(800).attr("opacity", 1)),
                update => update.transition().duration(800)
                    .attr("cx", d => this.x(new Date(d.date)))
                    .attr("cy", d => this.y(d.author))
                    .attr("r", d => this.radiusScale(d.impact))
            )
            .on("mouseover", (e, d) => {
                this.showTooltip(e, d);
                eventBus.call("selectAuthor", this, d.author);
            })
            .on("mouseout", () => {
                this.hideTooltip();
                this.resetHighlight();
                eventBus.call("selectAuthor", this, null);
            });

        // 5. Add Lane Labels (Professional touch)
        this.g.selectAll(".lane-label")
            .data(authors)
            .join("text")
            .attr("class", "lane-label")
            .attr("x", -10)
            .attr("y", d => this.y(d))
            .attr("text-anchor", "end")
            .attr("alignment-baseline", "middle")
            .text(d => d.split(' ')[0]) // Short name
            .style("font-size", "10px")
            .style("fill", "#aaa");
    }

    highlightAuthor(authorName) {
        this.nodeLayer.selectAll(".commit-node")
            .transition().duration(250)
            .attr("opacity", d => (d.author === authorName || !authorName) ? 1 : 0.05)
            .style("filter", d => d.author === authorName ? "drop-shadow(0 0 4px white)" : "none");

        this.linkLayer.selectAll(".commit-link")
            .transition().duration(250)
            .attr("opacity", d => {
                // Find node associated with this link
                const targetNode = this.nodes.find(n => n.hash === d.target);
                return (targetNode.author === authorName) ? 0.8 : 0.05;
            })
            .attr("stroke-width", d => {
                 const targetNode = this.nodes.find(n => n.hash === d.target);
                 return targetNode.author === authorName ? 20 : 10;
            });
    }

    resetHighlight() {
        this.nodeLayer.selectAll(".commit-node")
            .transition().duration(250)
            .attr("opacity", 1)
            .style("filter", "none");

        this.linkLayer.selectAll(".commit-link")
            .transition().duration(250)
            .attr("opacity", 0.3)
            .attr("stroke-width", 2);
    }

    filterByDate(range) {
        if (!range) return;
        this.x.domain(range);
        
        const width = this.container.clientWidth - this.margin.left - this.margin.right;
        this.x.range([0, width]);

        // Update link paths
        const nodeMap = new Map(this.nodes.map(d => [d.hash, d]));
        this.linkLayer.selectAll(".commit-link")
            .attr("d", d => {
                const source = nodeMap.get(d.source);
                const target = nodeMap.get(d.target);
                const x0 = this.x(new Date(source.date));
                const y0 = this.y(source.author);
                const x1 = this.x(new Date(target.date));
                const y1 = this.y(target.author);
                return `M ${x0} ${y0} C ${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`;
            });

        // Update nodes
        this.nodeLayer.selectAll(".commit-node")
            .attr("cx", d => this.x(new Date(d.date)))
            .attr("opacity", d => {
                const date = new Date(d.date);
                return (date >= range[0] && date <= range[1]) ? 1 : 0;
            });
    }

    showTooltip(event, d) {
        this.tooltip.classed("hidden", false)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 20) + "px")
            .html(`
            <div class="tt-header">
                <span class="tt-author">${d.author}</span>
                <span class="tt-hash">${d.hash.substring(0, 7)}</span>
            </div>
            <div class="tt-msg">${d.msg}</div>
            <div class="tt-impact">Δ ${d.impact} lines</div>
        `);
    }

    hideTooltip() {
        this.tooltip.classed("hidden", true);
    }
}