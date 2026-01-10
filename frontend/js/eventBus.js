/**
 * @fileoverview Central Event Bus
 * Uses d3.dispatch to handle communication between decoupled components.
 * Implementation of the "Dispatch/Linkage" pattern.
 */

// Define the specific events that can be broadcasted across the app
const eventBus = d3.dispatch(
    "dataLoaded",   // Triggered when API successfully returns repository data
    "filterTime",   // Triggered when user brushes a timeline 
    "selectAuthor", // Triggered when user selects a specific author 
    "hoverFile"     // Triggered when user interacts with the Sunburst chart 
);

export default eventBus;