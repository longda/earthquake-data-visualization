'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';
import { formatDistanceToNow, format } from 'date-fns'; // Import date-fns functions
import { gsap } from 'gsap'; // Import GSAP

// Define an interface for our earthquake data
interface EarthquakeData {
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
  timestamp: string; // ISO 8601 format timestamp
}

// Define an interface for the tooltip state
interface TooltipState {
  visible: boolean;
  content: string;
  x: number; // screen X coordinate
  y: number; // screen Y coordinate
}

// Constants for simulation and animation
const SIMULATION_INTERVAL_MS = 100; // Milliseconds between adding each earthquake in the simulation
const ANIMATION_DURATION_S = 0.5; // Duration for earthquake appearance/disappearance animations
const DATE_DISPLAY_FORMAT = 'yyyy-MM-dd HH:mm'; // Format for displaying simulation time

const WorldMap: React.FC = () => {
  // Refs for SVG element, container div, D3 projection, and color scale
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Store D3 projection in a ref to avoid recomputing it on every render
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  // Store D3 color scale in a ref
  const depthColorScaleRef = useRef<d3.ScaleSequential<string, never> | null>(null);

  // State for GeoJSON world map data
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  // State for storing the entire earthquake dataset, sorted chronologically
  const [allEarthquakes, setAllEarthquakes] = useState<EarthquakeData[]>([]);
  // State representing the current index in the simulation timeline
  const [simulationIndex, setSimulationIndex] = useState<number>(0);
  // State for managing the tooltip visibility and content
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, content: '', x: 0, y: 0 });

  // State for filtering earthquakes
  const [minMagnitudeFilter, setMinMagnitudeFilter] = useState<number>(0);
  const [showOnlyShallow, setShowOnlyShallow] = useState<boolean>(false); // Shallow = depth < 50km

  // State for simulation controls
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(true); // Controls play/pause
  const [currentSimulationTime, setCurrentSimulationTime] = useState<string>(''); // Formatted time string for display

  // Effect 1: Fetch static data (GeoJSON for map outlines, CSV for earthquake data) on initial mount
  useEffect(() => {
    // Fetch GeoJSON data for world map outlines
    d3.json<FeatureCollection>('/world-110m.json').then(data => {
      if (data) {
        setGeoData(data);
      } else {
        console.error('Failed to load GeoJSON data');
      }
    }).catch(err => console.error('Error loading GeoJSON:', err));

    // Fetch and parse Earthquake CSV data
    d3.csv('/database.csv').then(data => {
      const parsedData: EarthquakeData[] = data.reduce((acc: EarthquakeData[], d) => {
        // Safely parse numeric values and date/time strings
        const latitude = parseFloat(d.Latitude ?? '');
        const longitude = parseFloat(d.Longitude ?? '');
        const magnitude = parseFloat(d.Magnitude ?? '');
        const depth = parseFloat(d.Depth ?? '');
        const dateStr = d.Date ?? ''; // Expects MM/DD/YYYY
        const timeStr = d.Time ?? ''; // Expects HH:mm:ss

        let timestamp = '';
        if (dateStr && timeStr) {
          const dateParts = dateStr.split('/');
          if (dateParts.length === 3) {
            const month = dateParts[0].padStart(2, '0');
            const day = dateParts[1].padStart(2, '0');
            let year = dateParts[2];
            // Simple heuristic to handle potential 2-digit years (e.g., '99' -> '1999', '05' -> '2005')
            if (year.length === 2) {
              const yearNum = parseInt(year, 10);
              year = (yearNum < 70 ? '20' : '19') + year;
            }
            // Construct an ISO-like timestamp string (required by new Date())
            timestamp = `${year}-${month}-${day}T${timeStr}Z`; // Assume UTC ('Z')
          } else {
            console.warn('Skipping row with unexpected date format:', dateStr);
          }
        }

        // Add to accumulator only if all data is valid and timestamp parses correctly
        if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(magnitude) && !isNaN(depth) && timestamp) {
          try {
            new Date(timestamp).toISOString(); // Validate the constructed timestamp
            acc.push({ latitude, longitude, magnitude, depth, timestamp });
          } catch (e) {
             console.warn('Skipping row with invalid reconstructed timestamp:', timestamp, e);
          }
        }
        // Silently skip rows with missing or invalid data
        return acc;
      }, []);

      // Sort data chronologically for the time-based simulation
      const sortedData = parsedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setAllEarthquakes(sortedData);
      setSimulationIndex(0); // Start simulation from the beginning
      setIsSimulationRunning(true); // Start simulation automatically

      // Initialize the displayed simulation time
      if (sortedData.length > 0) {
        try {
            setCurrentSimulationTime(format(new Date(sortedData[0].timestamp), DATE_DISPLAY_FORMAT));
        } catch {
            setCurrentSimulationTime('Invalid Date');
        }
      } else {
          setCurrentSimulationTime(''); // Handle empty dataset
      }
    }).catch(err => console.error('Error loading or parsing earthquake CSV:', err));

  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect 2: Controls the simulation timer based on `isSimulationRunning` state
  useEffect(() => {
    if (allEarthquakes.length === 0) return; // Don't run if data isn't loaded

    let intervalId: NodeJS.Timeout | null = null;

    // Only set the interval if the simulation is running
    if (isSimulationRunning) {
        intervalId = setInterval(() => {
            setSimulationIndex(prevIndex => {
                const nextIndex = prevIndex + 1;
                if (nextIndex < allEarthquakes.length) {
                    // Update time display to reflect the timestamp of the *next* earthquake to be shown
                    try {
                        setCurrentSimulationTime(format(new Date(allEarthquakes[nextIndex].timestamp), DATE_DISPLAY_FORMAT));
                    } catch {
                        setCurrentSimulationTime('Invalid Date');
                    }
                    return nextIndex; // Advance the simulation index
                } else {
                    // Simulation reached the end
                    setIsSimulationRunning(false); // Automatically pause
                    if (intervalId) clearInterval(intervalId); // Clear the interval
                    // Ensure the time display shows the timestamp of the very last earthquake
                    if (allEarthquakes.length > 0) {
                         try {
                            setCurrentSimulationTime(format(new Date(allEarthquakes[allEarthquakes.length - 1].timestamp), DATE_DISPLAY_FORMAT));
                         } catch {
                            setCurrentSimulationTime('Invalid Date');
                         }
                    }
                    return prevIndex; // Keep index at the final position
                }
            });
        }, SIMULATION_INTERVAL_MS);
    }

    // Cleanup function: clear the interval when the component unmounts
    // or when the dependencies (allEarthquakes, isSimulationRunning) change
    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [allEarthquakes, isSimulationRunning]); // Dependencies: rerun effect if data loads or play/pause state changes

  // Effect 3: Updates the displayed simulation time when the user manually changes the index via the slider
  useEffect(() => {
      // Ensure data exists and index is within bounds
      if (allEarthquakes.length > 0 && simulationIndex >= 0 && simulationIndex < allEarthquakes.length) {
        try {
            // Format and display the timestamp of the earthquake at the current slider index
            setCurrentSimulationTime(format(new Date(allEarthquakes[simulationIndex].timestamp), DATE_DISPLAY_FORMAT));
        } catch {
            setCurrentSimulationTime('Invalid Date')
        }
      } else if (allEarthquakes.length > 0 && simulationIndex >= allEarthquakes.length) {
          // Handle edge case where slider might exceed max index briefly
          // Show the time of the last available earthquake
           try {
                setCurrentSimulationTime(format(new Date(allEarthquakes[allEarthquakes.length - 1].timestamp), DATE_DISPLAY_FORMAT));
            } catch {
                setCurrentSimulationTime('Invalid Date')
            }
      }
  }, [simulationIndex, allEarthquakes]); // Dependencies: rerun if slider index or data changes

  // Effect 4: Sets up D3 projection, color scale, and draws static map elements (background, land)
  // This effect runs when GeoData is loaded or if the container size potentially changes (though resize handling isn't fully implemented here)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    // Get container dimensions for responsive scaling
    const { width, height } = containerRef.current.getBoundingClientRect();

    if (width <= 0 || height <= 0) return; // Avoid drawing if container isn't ready

    // Initialize or update D3 projection (Mercator in this case)
    projectionRef.current = d3.geoMercator()
      .scale(width / (2 * Math.PI) * 0.9) // Scale based on width, slightly adjusted
      .center([0, 20]) // Center the map view (longitude 0, latitude 20)
      .translate([width / 2, height / 2]); // Center projection within the SVG container

    // Initialize or update D3 color scale for depth (Red=Shallow, Blue=Deep)
    const minDepth = 0; // Assumed minimum depth
    const maxDepth = 700; // Assumed maximum depth from typical earthquake data
    depthColorScaleRef.current = d3.scaleSequential(d3.interpolateRgb("red", "blue"))
      .domain([minDepth, maxDepth]); // Map depth range to color gradient

    // Draw static map background (ocean color)
    // Use join pattern to add rect if it doesn't exist, or update dimensions if it does
    svg.selectAll('.map-background')
       .data([null]) // Bind a single data point
       .join('rect') // Enter/Update/Exit pattern
       .attr('class', 'map-background')
       .attr('width', width)
       .attr('height', height)
       .attr('fill', '#a0c4ff'); // Light blue for oceans

    // Draw land features using GeoJSON data
    // Ensure the projection is valid before creating the path generator
    if (!projectionRef.current) return;
    const pathGenerator = d3.geoPath().projection(projectionRef.current);

    // Select the group for land features, create if it doesn't exist
    let landGroup = svg.select<SVGGElement>('g.land-features');
    if (landGroup.empty()) {
        landGroup = svg.append('g').attr('class', 'land-features');
    }

    // Draw paths for each country/feature in the GeoJSON data
    landGroup.selectAll('path')
      .data(geoData.features)
      .join('path') // Use join for efficient updates if geoData were to change
      .attr('d', pathGenerator) // Generate SVG path data from GeoJSON feature
      .attr('fill', '#cccccc') // Light grey for land
      .attr('stroke', '#ffffff') // White borders between countries
      .attr('stroke-width', 0.5);

    // Ensure the group element for earthquakes exists, creating it if necessary
    // This prevents earthquakes from being drawn before the land/background
    if (svg.select('g.earthquakes').empty()) {
        svg.append('g').attr('class', 'earthquakes');
    }

  }, [geoData]); // Dependency: rerun only if GeoData changes (assumes container size stable after initial load)

  // Effect 5: Renders and animates earthquake circles based on the current simulation index and filters
  useEffect(() => {
    // Ensure all required elements and data are available
    if (!svgRef.current || !projectionRef.current || !depthColorScaleRef.current || allEarthquakes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const projection = projectionRef.current;
    const depthColorScale = depthColorScaleRef.current;

    // 1. Determine the subset of earthquakes to display based on the simulation index
    const activeEarthquakes = allEarthquakes.slice(0, simulationIndex);

    // 2. Apply filters (magnitude, depth) to the active subset
    const filteredEarthquakes = activeEarthquakes.filter(d => {
      const magnitudePass = d.magnitude >= minMagnitudeFilter;
      const depthPass = !showOnlyShallow || (showOnlyShallow && d.depth < 50); // Apply depth filter if toggled
      return magnitudePass && depthPass;
    });

    // 3. Use D3's data join pattern to efficiently add, update, and remove circles
    const earthquakeGroup = svg.select<SVGGElement>('g.earthquakes');

    earthquakeGroup.selectAll<SVGCircleElement, EarthquakeData>('circle')
      // Bind filtered data; use timestamp as a unique key for object constancy
      .data(filteredEarthquakes, d => d.timestamp)
      .join(
        // --- ENTER selection --- (for new data points)
        enter => enter.append('circle')
          // Set initial attributes (position, color, etc.)
          .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0) // Use projection to get screen coords
          .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
          .attr('fill', d => depthColorScale(d.depth)) // Use color scale for depth
          .attr('stroke', '#333')
          .attr('stroke-width', 0.5)
          .style('cursor', 'pointer') // Indicate interactivity
          // --- Tooltip event handlers ---
          .on('mouseover', (event, d) => {
             // Show tooltip on hover
             try {
                 const [x, y] = d3.pointer(event, svg.node()); // Get mouse position relative to SVG
                 const formattedTime = formatDistanceToNow(new Date(d.timestamp), { addSuffix: true });
                 const content = `
                     Magnitude: ${d.magnitude.toFixed(1)}<br/>
                     Depth: ${d.depth.toFixed(0)} km<br/>
                     Time: ${formattedTime}
                 `;
                 setTooltip({ visible: true, content, x: x + 10, y: y + 10 }); // Position tooltip near cursor
             } catch (e) {
                 // Handle potential date parsing errors
                 console.error('Error formatting date for tooltip:', d.timestamp, e);
                 const [x, y] = d3.pointer(event, svg.node());
                 setTooltip({ visible: true, content: 'Error displaying data', x: x + 10, y: y + 10 });
             }
          })
          .on('mousemove', (event) => {
             // Update tooltip position as mouse moves
             const [x, y] = d3.pointer(event, svg.node());
             setTooltip(prev => ({ ...prev, x: x + 10, y: y + 10 }));
          })
          .on('mouseout', () => {
             // Hide tooltip when mouse leaves the circle
             setTooltip({ visible: false, content: '', x: 0, y: 0 });
          })
          // --- GSAP Enter Animation ---
          .each(function(d) { // Use 'function' to preserve 'this' context
              // Animate from radius 0, opacity 0 to final size and opacity
              gsap.fromTo(this, // Target the current circle element
                  { attr: { r: 0 }, autoAlpha: 0 }, // Initial state: invisible, zero radius
                  {
                      attr: { r: d.magnitude * 1.5 }, // Final state: radius based on magnitude
                      autoAlpha: 0.7, // Final state: semi-transparent
                      duration: ANIMATION_DURATION_S,
                      ease: 'power1.out' // Easing function for smooth appearance
                  }
              );
          }),
        // --- UPDATE selection --- (for existing data points that remain after filtering)
        update => update
          // Optionally, add a transition for attribute changes if filters might affect existing points
          .call(update => update.transition(`update-${Date.now()}`).duration(ANIMATION_DURATION_S / 2)
            .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0)
            .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
            .attr('r', d => d.magnitude * 1.5) // Update radius if magnitude changes (unlikely here)
            .attr('fill', d => depthColorScale(d.depth)) // Update color if depth scale changes
            .style('opacity', 0.7) // Ensure opacity remains consistent
          ),
        // --- EXIT selection --- (for data points removed by filtering or simulation progress)
        exit => exit
          // --- GSAP Exit Animation ---
          .each(function() { // Use 'function' to preserve 'this' context
              const circleElement = this; // Capture 'this' for use in callback
              // Animate to radius 0, opacity 0
              gsap.to(circleElement, { // Target the circle being removed
                  attr: { r: 0 }, // Final state: zero radius
                  autoAlpha: 0, // Final state: invisible
                  duration: ANIMATION_DURATION_S,
                  ease: 'power1.in', // Easing function for smooth disappearance
                  // Remove the SVG element from the DOM after animation completes
                  onComplete: () => {
                      d3.select(circleElement).remove();
                  }
              });
          })
      );

  }, [allEarthquakes, simulationIndex, minMagnitudeFilter, showOnlyShallow, geoData]); // Dependencies: Rerun rendering if data, simulation index, filters, or map data changes

  // --- Component JSX ---
  return (
    // Main container div, using refs for size calculations
    <div ref={containerRef} className="relative w-full h-full bg-gray-100 overflow-hidden">
      {/* Filter & Simulation Controls Panel */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-80 p-4 rounded shadow-md z-10 space-y-3 w-64">
         <p className="text-xs text-gray-600 mb-2">
           An interactive map simulating global earthquake occurrences over time.
         </p>
         <h3 className="text-sm font-semibold text-gray-700">Filters & Simulation</h3>

         {/* Simulation Controls Section */}
         <div className="border-t pt-3 mt-3 space-y-3">
            {/* Play/Pause Button and Time Display */}
            <div className="flex items-center justify-between">
                 <button
                    onClick={() => setIsSimulationRunning(!isSimulationRunning)}
                    // Disable button if data isn't loaded or simulation finished
                    disabled={allEarthquakes.length === 0 || simulationIndex >= allEarthquakes.length}
                    // Dynamic styling for Play/Pause state
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      isSimulationRunning
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white' // Pause style
                        : 'bg-green-500 hover:bg-green-600 text-white'   // Play style
                    } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                 >
                    {isSimulationRunning ? 'Pause' : (simulationIndex >= allEarthquakes.length ? 'Finished' : 'Play')}
                 </button>
                 {/* Display current simulation time */}
                 <span className="text-xs text-gray-600 whitespace-nowrap ml-2">
                    {currentSimulationTime || 'Loading data...'}
                 </span>
            </div>
             {/* Simulation Progress Slider */}
             <div>
                <label htmlFor="simulationProgress" className="sr-only">Simulation Progress</label>
                <input
                    type="range"
                    id="simulationProgress"
                    min="0"
                    // Set max value to the last valid index of the earthquake array
                    max={allEarthquakes.length > 0 ? allEarthquakes.length -1 : 0}
                    value={simulationIndex}
                    // Update simulationIndex state when slider changes
                    onChange={(e) => setSimulationIndex(parseInt(e.target.value))}
                    disabled={allEarthquakes.length === 0} // Disable if no data
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:bg-gray-300"
                    // Tooltip for the slider itself
                    title={`Earthquake ${simulationIndex + 1} of ${allEarthquakes.length}`}
                />
             </div>
         </div>


         {/* Filtering Controls Section */}
         {/* Magnitude Filter Slider */}
         <div>
            <label htmlFor="magnitude" className="block text-xs font-medium text-gray-600">
              Min Magnitude: {minMagnitudeFilter.toFixed(1)}
            </label>
            <input
              type="range"
              id="magnitude"
              min="0"
              max="10" // Richter scale range
              step="0.1"
              value={minMagnitudeFilter}
              onChange={(e) => setMinMagnitudeFilter(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          {/* Depth Filter Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="depthToggle"
              checked={showOnlyShallow}
              onChange={(e) => setShowOnlyShallow(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="depthToggle" className="ml-2 text-xs font-medium text-gray-600">
              Show Only Shallow (&lt;50km)
            </label>
          </div>
      </div>

      {/* SVG Container for the D3 map */}
      <svg ref={svgRef} width="100%" height="100%"></svg>

      {/* Tooltip Element (rendered conditionally) */}
      {tooltip.visible && (
        <div
          // Standard tooltip styling
          className="absolute bg-gray-800 text-white text-xs rounded p-2 pointer-events-none shadow-lg"
          // Position tooltip based on state updated by mouse events
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          // Use dangerouslySetInnerHTML for simple HTML content in tooltip
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default WorldMap; 