/**
 * @fileoverview Data Transformation Utility
 * Static methods to convert raw API responses into D3-compatible structures.
 */

export class DataProcessor {
    
    /**
     * Converts a recursive file tree object into a D3 Hierarchy.
     * Calculates the sum of Lines of Code (value) for directories.
     * 
     * @param {Object} fileTree - The raw recursive object from the backend (name, children, value).
     * @returns {d3.HierarchyNode} - A processed root node with calculated values and sorting applied.
     */
    static processHierarchy(fileTree) {
        if (!fileTree) return null;

        // Create the hierarchy structure
        const root = d3.hierarchy(fileTree)
            .sum(d => d.value ? d.value : 0) // Sum file sizes up to folder level
            .sort((a, b) => b.value - a.value); // Sort sectors by size

        return root;
    }

    /**
     * Prepares commit history data for the Streamgraph.
     * (Placeholder).
     * 
     * @param {Array<Object>} history - Array of commit objects from backend.
     * @returns {Array} - Data grouped by week and author.
     */
    static processCommitsByAuthor(history) {
        if (!history || history.length === 0) return { data: [], keys: [] };

        // 1. Parse dates and sort Oldest -> Newest
        const parseDate = d3.timeParse("%Y-%m-%dT%H:%M:%S%Z"); // ISO format from Python
        const cleanHistory = history.map(d => ({
            ...d,
            dateObj: new Date(d.date),
            value: d.insertions // Use insertions as the metric for "Activity"
        })).sort((a, b) => a.dateObj - b.dateObj);

        // 2. Identify Top Authors (e.g., Top 10 by total insertions)
        const authorTotals = d3.rollup(cleanHistory, v => d3.sum(v, d => d.value), d => d.author);
        const topAuthors = Array.from(authorTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(d => d[0]);
        
        const otherLabel = "Others";
        
        // 3. Bucket by Week
        // We create a map where keys are "Week Start Date"
        const commitsByWeek = d3.group(cleanHistory, d => d3.timeWeek(d.dateObj));

        const processedData = Array.from(commitsByWeek, ([date, commits]) => {
            const row = { date: date };
            
            // Initialize top authors to 0
            topAuthors.forEach(a => row[a] = 0);
            row[otherLabel] = 0;

            // Sum up values
            commits.forEach(c => {
                if (topAuthors.includes(c.author)) {
                    row[c.author] += c.value;
                } else {
                    row[otherLabel] += c.value;
                }
            });

            return row;
        }).sort((a, b) => a.date - b.date);

        // Ensure "Others" is only included if it has data
        const finalKeys = [...topAuthors];
        const hasOthers = processedData.some(d => d[otherLabel] > 0);
        if (hasOthers) finalKeys.push(otherLabel);

        return { data: processedData, keys: finalKeys };
    }
}