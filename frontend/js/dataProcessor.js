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
        // Todo: Group by week, stack by author
        return [];
    }
}