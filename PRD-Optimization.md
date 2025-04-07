**Phase 5: Optimization Plan**

**Goal:** Ensure the application performs smoothly (load time < 1s, interactions ~60 FPS) when handling a large dataset (10,000+ earthquake points).

**Steps:**

1.  **Data Acquisition & Verification:**
    *   **Action:** Check the size of the current earthquake dataset (`earthquakes.json` or `database.csv`).
    *   **Contingency:** If the dataset has fewer than 10,000 entries:
        *   Source a larger static dataset from public archives (e.g., USGS) matching the required JSON schema specified in the PRD.
        *   Alternatively, generate synthetic data conforming to the schema to reach the 10k+ target for testing purposes.
    *   **Outcome:** A verified `earthquakes.json` file containing at least 10,000 data points.

2.  **Performance Baseline:**
    *   **Action:** Load the application with the large dataset *without* virtualization implemented.
    *   **Metrics:** Measure and record:
        *   Initial load time.
        *   Map interaction latency (panning, zooming).
        *   Animation smoothness (FPS during updates/simulations) using browser developer tools.
    *   **Outcome:** Baseline performance metrics to compare against after optimization.

3.  **Implement Data Virtualization Strategy:**
    *   **Strategy Choice:** Focus on rendering only the data points visible within the current map viewport. Use spatial indexing for efficient querying.
    *   **Actions:**
        *   **Spatial Indexing:** Integrate `d3-quadtree` (or a similar library/implementation) to index the earthquake data points by their geographic coordinates (`latitude`, `longitude`).
        *   **Viewport Calculation:** On map pan/zoom events, determine the geographic bounding box of the visible map area based on the D3 projection and current transform.
        *   **Dynamic Data Querying:** Modify the rendering logic: Instead of binding all 10k+ points, use the Quadtree to query only the points falling within the current viewport bounding box.
        *   **D3 Update Pattern:** Update the D3 selection bound to the *subset* of visible points. Ensure the enter/update/exit pattern correctly adds points entering the viewport and removes points leaving it.
        *   **Filtering Integration:** Ensure existing filters (magnitude, depth, region) are applied efficiently, potentially by filtering the data *before* querying the Quadtree or filtering the subset returned by the Quadtree.

4.  **Performance Testing & Refinement:**
    *   **Action:** Load the application with the large dataset *with* virtualization implemented.
    *   **Metrics:** Re-measure the same metrics as in Step 2 (load time, interaction latency, FPS).
    *   **Analysis:** Compare the new metrics against the baseline. Identify any remaining bottlenecks (e.g., Quadtree query speed, D3 rendering updates).
    *   **Refinement:** Optimize the virtualization implementation based on the analysis. This might involve tweaking the Quadtree usage or refining the D3 update logic.

5.  **Consider Web Workers (If Necessary):**
    *   **Trigger:** If main thread performance (especially during interactions or filtering) is still unsatisfactory after Step 4.
    *   **Action:** Refactor the spatial indexing query logic (and potentially initial data parsing/indexing) to run within a Web Worker.
    *   **Integration:** Implement communication between the main thread (React/D3 components) and the Web Worker to pass viewport bounds and receive the subset of visible data points.
    *   **Testing:** Re-run performance tests to confirm the improvement in UI responsiveness.

This plan focuses on viewport-based virtualization using spatial indexing as the primary optimization technique, aligning with common practices for large geographic datasets in D3.
