'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';
import { formatDistanceToNow } from 'date-fns'; // Import date-fns function
import { gsap } from 'gsap'; // Import GSAP

// Define an interface for our earthquake data
interface EarthquakeData {
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
  timestamp: string; // Added timestamp
  // Removed place as it's not directly available in the CSV
}

// Define an interface for the tooltip state
interface TooltipState {
  visible: boolean;
  content: string;
  x: number;
  y: number;
}

// Simulation speed (milliseconds between adding earthquakes)
const SIMULATION_INTERVAL_MS = 100; // Add new earthquake every 100ms
const ANIMATION_DURATION_S = 0.5; // Animation duration in seconds

const WorldMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null); // Ref to store projection
  const depthColorScaleRef = useRef<d3.ScaleSequential<string, never> | null>(null); // Ref for color scale
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  // Store all loaded earthquakes, sorted by time
  const [allEarthquakes, setAllEarthquakes] = useState<EarthquakeData[]>([]);
  // Index up to which earthquakes from allEarthquakes are considered "active"
  const [simulationIndex, setSimulationIndex] = useState<number>(0);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, content: '', x: 0, y: 0 }); // State for tooltip
  // --- Filter State ---
  const [minMagnitudeFilter, setMinMagnitudeFilter] = useState<number>(0);
  const [showOnlyShallow, setShowOnlyShallow] = useState<boolean>(false); // Shallow = depth < 50km

  // Effect 1: Fetch static data (GeoJSON, Earthquake CSV)
  useEffect(() => {
    // Fetch GeoJSON data
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
        const latitude = parseFloat(d.Latitude ?? '');
        const longitude = parseFloat(d.Longitude ?? '');
        const magnitude = parseFloat(d.Magnitude ?? '');
        const depth = parseFloat(d.Depth ?? '');
        const dateStr = d.Date ?? ''; // MM/DD/YYYY
        const timeStr = d.Time ?? ''; // HH:mm:ss

        let timestamp = '';
        if (dateStr && timeStr) {
          // Parse MM/DD/YYYY
          const dateParts = dateStr.split('/');
          if (dateParts.length === 3) {
            const month = dateParts[0].padStart(2, '0');
            const day = dateParts[1].padStart(2, '0');
            let year = dateParts[2];
            // Handle potential 2-digit years (heuristic: assume 20xx or 19xx)
            if (year.length === 2) {
              const yearNum = parseInt(year, 10);
              year = (yearNum < 70 ? '20' : '19') + year; // Adjust century based on year
            }
            // Construct ISO-like format YYYY-MM-DDTHH:mm:ssZ
            timestamp = `${year}-${month}-${day}T${timeStr}Z`;
          } else {
            console.warn('Skipping row with unexpected date format:', dateStr);
          }
        }

        if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(magnitude) && !isNaN(depth) && timestamp) {
          try {
            new Date(timestamp).toISOString(); // Check if the reconstructed timestamp parses
            acc.push({ latitude, longitude, magnitude, depth, timestamp });
          } catch (e) {
             console.warn('Skipping row with invalid reconstructed timestamp:', timestamp, e);
          }
        } else {
          // Silently skip rows with missing/invalid numeric data or date/time
        }
        return acc;
      }, []);

      // Sort data by timestamp ascending for simulation
      const sortedData = parsedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setAllEarthquakes(sortedData);
      setSimulationIndex(0); // Reset simulation index when new data is loaded
    }).catch(err => console.error('Error loading or parsing earthquake CSV:', err));

  }, []); // Run only once on component mount

  // Effect 2: Run the simulation timer
  useEffect(() => {
    if (allEarthquakes.length === 0) return; // Don't start if no data

    const intervalId = setInterval(() => {
      setSimulationIndex(prevIndex => {
        if (prevIndex < allEarthquakes.length) {
          return prevIndex + 1;
        }
        clearInterval(intervalId); // Stop interval when all data is processed
        return prevIndex;
      });
    }, SIMULATION_INTERVAL_MS);

    // Cleanup function to clear interval on unmount or data change
    return () => clearInterval(intervalId);
  }, [allEarthquakes]); // Rerun if earthquake data changes

  // Effect 3: Setup D3 projection, color scale, and static map elements
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();

    if (width <= 0 || height <= 0) return; // Don't draw if dimensions are not valid

    // --- Setup Projection ---
    projectionRef.current = d3.geoMercator()
      .scale(width / (2 * Math.PI) * 0.9) // Slightly smaller scale
      .center([0, 20]) // Center map slightly higher
      .translate([width / 2, height / 2]); // Center in the SVG container

    // --- Setup Color Scale ---
    const minDepth = 0;
    const maxDepth = 700; // Example depth range
    depthColorScaleRef.current = d3.scaleSequential(d3.interpolateRgb("red", "blue"))
      .domain([minDepth, maxDepth]);

    // --- Draw Static Elements (only if they don't exist) ---
    // Background
    if (svg.select('.map-background').empty()) {
        svg.append('rect')
           .attr('class', 'map-background')
           .attr('width', width)
           .attr('height', height)
           .attr('fill', '#a0c4ff'); // Ocean blue
    } else {
         svg.select('.map-background')
            .attr('width', width)
            .attr('height', height);
    }

    // Land Features
    const pathGenerator = d3.geoPath().projection(projectionRef.current);
    let landGroup = svg.select<SVGGElement>('g.land-features');
    if (landGroup.empty()) {
        landGroup = svg.append('g').attr('class', 'land-features');
    }

    landGroup.selectAll('path')
      .data(geoData.features)
      .join('path') // Use join for potential updates if geoData could change
      .attr('d', pathGenerator)
      .attr('fill', '#cccccc') // Light grey land
      .attr('stroke', '#ffffff') // White borders
      .attr('stroke-width', 0.5);

    // Ensure earthquakes group exists
    if (svg.select('g.earthquakes').empty()) {
        svg.append('g').attr('class', 'earthquakes');
    }

  }, [geoData]); // Rerun only if GeoData changes

  // Effect 4: Update and animate earthquake circles based on simulation and filters
  useEffect(() => {
    if (!svgRef.current || !projectionRef.current || !depthColorScaleRef.current || allEarthquakes.length === 0) {
      return; // Need SVG, projection, color scale, and data
    }

    const svg = d3.select(svgRef.current);
    const projection = projectionRef.current;
    const depthColorScale = depthColorScaleRef.current;

    // 1. Get the current slice of "active" earthquakes based on simulation
    const activeEarthquakes = allEarthquakes.slice(0, simulationIndex);

    // 2. Apply current filters to the active earthquakes
    const filteredEarthquakes = activeEarthquakes.filter(d => {
      const magnitudePass = d.magnitude >= minMagnitudeFilter;
      const depthPass = !showOnlyShallow || (showOnlyShallow && d.depth < 50);
      return magnitudePass && depthPass;
    });

    // 3. D3 Data Join for Circles
    const earthquakeGroup = svg.select<SVGGElement>('g.earthquakes');

    earthquakeGroup.selectAll<SVGCircleElement, EarthquakeData>('circle')
      .data(filteredEarthquakes, d => d.timestamp) // Use timestamp as unique key
      .join(
        // --- ENTER --- (New earthquakes appearing)
        enter => enter.append('circle')
          .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0)
          .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
          .attr('fill', d => depthColorScale(d.depth))
          .attr('stroke', '#333')
          .attr('stroke-width', 0.5)
          .style('cursor', 'pointer')
          // Tooltip handlers
          .on('mouseover', (event, d) => {
             try {
                 const [x, y] = d3.pointer(event, svg.node());
                 const formattedTime = formatDistanceToNow(new Date(d.timestamp), { addSuffix: true });
                 const content = `
                     Magnitude: ${d.magnitude.toFixed(1)}<br/>
                     Depth: ${d.depth.toFixed(0)} km<br/>
                     Time: ${formattedTime}
                 `;
                 setTooltip({ visible: true, content, x: x + 10, y: y + 10 });
             } catch (e) {
                 console.error('Error formatting date for tooltip:', d.timestamp, e);
                 const [x, y] = d3.pointer(event, svg.node());
                 setTooltip({ visible: true, content: 'Error displaying data', x: x + 10, y: y + 10 });
             }
          })
          .on('mousemove', (event) => {
             const [x, y] = d3.pointer(event, svg.node());
             setTooltip(prev => ({ ...prev, x: x + 10, y: y + 10 }));
          })
          .on('mouseout', () => {
             setTooltip({ visible: false, content: '', x: 0, y: 0 });
          })
          // GSAP Animation for enter
          .each(function(d) {
              gsap.fromTo(this,
                  { attr: { r: 0 }, autoAlpha: 0 }, // Start state: radius 0, invisible
                  {
                      attr: { r: d.magnitude * 1.5 }, // End state: final radius
                      autoAlpha: 0.7, // End state: final opacity
                      duration: ANIMATION_DURATION_S,
                      ease: 'power1.out'
                  }
              );
          }),
        // --- UPDATE --- (Existing earthquakes that remain after filtering)
        update => update
          // Apply minor transition for smoothness if filters change attributes (optional)
          .call(update => update.transition(`update-${Date.now()}`).duration(ANIMATION_DURATION_S / 2) // Shorter update transition
            .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0) // Ensure position is correct
            .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
            .attr('r', d => d.magnitude * 1.5) // Ensure size is correct
            .attr('fill', d => depthColorScale(d.depth)) // Ensure color is correct
            .style('opacity', 0.7) // Ensure opacity is correct
          ),
        // --- EXIT --- (Earthquakes being filtered out or removed)
        exit => exit
          // GSAP Animation for exit
          .each(function() { // Use 'function' to preserve 'this' context for the SVG element
              const circleElement = this; // Capture 'this'
              gsap.to(circleElement, {
                  attr: { r: 0 }, // End state: radius 0
                  autoAlpha: 0, // End state: invisible
                  duration: ANIMATION_DURATION_S,
                  ease: 'power1.in',
                  onComplete: () => { // Use arrow function for onComplete
                      d3.select(circleElement).remove(); // Perform removal inside the callback body
                  }
              });
          })
      );

  }, [allEarthquakes, simulationIndex, minMagnitudeFilter, showOnlyShallow, geoData]); // Dependencies for rendering earthquakes

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-100 overflow-hidden"> {/* Added overflow-hidden */}
      {/* Filter Controls Panel */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-80 p-4 rounded shadow-md z-10 space-y-3">
         <h3 className="text-sm font-semibold text-gray-700 mb-2">Filters</h3>
        {/* Magnitude Slider */}
        <div>
          <label htmlFor="magnitude" className="block text-xs font-medium text-gray-600">
            Min Magnitude: {minMagnitudeFilter.toFixed(1)}
          </label>
          <input
            type="range"
            id="magnitude"
            min="0"
            max="10" // PRD specified 0-10
            step="0.1"
            value={minMagnitudeFilter}
            onChange={(e) => setMinMagnitudeFilter(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>

        {/* Depth Toggle */}
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

      <svg ref={svgRef} width="100%" height="100%"></svg>
      {/* Tooltip Element */}
      {tooltip.visible && (
        <div
          className="absolute bg-gray-800 text-white text-xs rounded p-2 pointer-events-none shadow-lg"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default WorldMap; 