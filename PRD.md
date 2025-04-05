# PRD: Real-Time Global Earthquake Data Visualization

## **Project Overview**
A web app that visualizes global earthquake data on an interactive map using a static dataset. The visualization updates dynamically to simulate real-time data flow while remaining fully self-contained with no backend dependencies.

---

## **Goals**
1. Create an engaging, interactive map to display earthquake locations and magnitudes.
2. Demonstrate proficiency in modern data visualization techniques and tools.
3. Ensure the app is lightweight, responsive, and works on all modern browsers (including mobile).
4. Use only publicly available static data to avoid external API dependencies.

---

## **Technology Stack**
- **Frontend Framework**: Next.js
- **Data Visualization**: D3.js (for map rendering) + React for UI
- **Styling**: Tailwind CSS
- **Animation**: GSAP (for smooth transitions)
- **Hosting**: Vercel

---

## **Core Features**

### 1. Interactive World Map
- Render a world map using D3.js's GeoJSON capabilities.
- Plot earthquake locations as:
  - **Circles** scaled by magnitude (e.g., larger circles = higher magnitude).
  - **Color-coded markers** based on depth (e.g., red = shallow, blue = deep).

### 2. Data Simulation
- Use a static JSON dataset of historical earthquakes (embedded in the app).
- Simulate "real-time" updates by cycling through the dataset at intervals (e.g., new earthquakes appear every 5 seconds).

### 3. Filtering Controls
- Allow users to:
  - Filter earthquakes by magnitude range (slider: 0–10 Richter scale).
  - Toggle depth visualization (shallow vs. deep).
  - Focus on specific regions using a dropdown (e.g., "Pacific Ring of Fire").

### 4. Dynamic Tooltips
- Show details on hover/click:
  - Magnitude
  - Depth
  - Location (nearest city/country)
  - Timestamp

### 5. Legend and Stats Panel
- Display a color-coded legend for depth and magnitude scales.
- Show real-time stats:
  - Total earthquakes displayed
  - Average magnitude
  - Most active region

---

## **Technical Requirements**

### Data Handling
- **Dataset**: Use a static JSON file (e.g., `earthquakes.json`) containing:
  ```json
  [
    {
      "latitude": 34.0522,
      "longitude": -118.2437,
      "magnitude": 4.5,
      "depth": 10,
      "timestamp": "2023-01-01T12:00:00Z",
      "region": "California"
    },
    // ...additional entries
  ]
  ```
- **Data Parsing**: Convert timestamps to relative time (e.g., "2 hours ago") using `date-fns`.

### Visualization Logic
1. **Map Projection**: 
   ```javascript
   const projection = d3.geoMercator()
     .scale(150)
     .translate([width / 2, height / 2]);
   ```
2. **Earthquake Plotting**:
   ```javascript
   const circles = svg.selectAll("circle")
     .data(earthquakes)
     .enter()
     .append("circle")
     .attr("r", d => d.magnitude * 2)
     .attr("fill", d => depthColorScale(d.depth));
   ```

### Animation
- Use GSAP to animate the appearance/disappearance of earthquake markers.
- Implement a "ripple" effect on new earthquakes to simulate real-time updates.

### Performance
- Implement **data virtualization** to handle large datasets efficiently.
- Use Web Workers (if needed) for heavy computations.

---

## **UI/UX Specifications**

### Layout
- **Main View**: 
  - 80% of screen: Interactive map.
  - 20%: Control panel and stats.
- **Mobile Optimization**:
  - Stack controls vertically below the map.
  - Simplify tooltips for touch interactions.

### Controls
- **Magnitude Slider**: Range input (0–10).
- **Region Dropdown**: Predefined tectonic regions.
- **Depth Toggle**: Switch between shallow (50km).

### Styling
- Use Tailwind CSS for:
  - Responsive grids
  - Consistent spacing
  - Themed colors (e.g., red for high magnitude)
- D3.js for map styling:
  - Light gray for landmasses
  - Blue gradients for ocean

---

## **Development Milestones**

### Phase 1: Setup
1. Initialize Next.js project with D3.js and Tailwind.
2. Source and sanitize a static earthquake dataset (e.g., from USGS archives).

### Phase 2: Core Visualization
1. Render world map using D3.js GeoJSON.
2. Plot earthquake markers with basic scaling/coloring.

### Phase 3: Interactivity
1. Implement hover/click tooltips.
2. Add filtering controls (slider, dropdown, toggle).

### Phase 4: Animation
1. Add GSAP animations for marker updates.
2. Simulate real-time updates via `setInterval`.

### Phase 5: Optimization
1. Test with 10k+ data points (if possible).
2. Implement data virtualization for performance.

### Phase 6: Deployment
1. Deploy to Vercel.
2. Ensure all data is self-contained (no external fetches).

---

## **Deliverables**
1. A public GitHub repo with:
   - Complete source code
   - `README.md` explaining setup and data sources
2. Hosted demo on Vercel.
3. Performance metrics (e.g., <1s load time, 60 FPS animations).

---

## **Future Enhancements**
1. Add historical timelines (e.g., "earthquakes in the last 24 hours").
2. Integrate WebGL for GPU-accelerated rendering.
3. Allow users to upload custom datasets.
