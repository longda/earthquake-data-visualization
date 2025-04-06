'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';
import { formatDistanceToNow } from 'date-fns'; // Import date-fns function

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

const WorldMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [earthquakeData, setEarthquakeData] = useState<EarthquakeData[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, content: '', x: 0, y: 0 }); // State for tooltip
  // --- Filter State ---
  const [minMagnitudeFilter, setMinMagnitudeFilter] = useState<number>(0);
  const [showOnlyShallow, setShowOnlyShallow] = useState<boolean>(false); // Shallow = depth < 50km

  useEffect(() => {
    // Fetch GeoJSON data for world map outlines
    d3.json<FeatureCollection>('/world-110m.json').then(data => {
      if (data) {
        setGeoData(data);
      } else {
        console.error('Failed to load GeoJSON data');
      }
    }).catch(err => console.error('Error loading GeoJSON:', err));

    // Fetch Earthquake CSV data
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
            const year = dateParts[2];
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
      // Removed console.log for parsed data
      setEarthquakeData(parsedData);
    }).catch(err => console.error('Error loading or parsing earthquake CSV:', err));

  }, []); // Run only once on component mount

  useEffect(() => {
    // Apply filters
    const filteredEarthquakes = earthquakeData.filter(d => {
      const magnitudePass = d.magnitude >= minMagnitudeFilter;
      const depthPass = !showOnlyShallow || (showOnlyShallow && d.depth < 50);
      // Placeholder for region filter logic if/when implemented
      return magnitudePass && depthPass;
    });

    // Add guard clause for refs and data
    if (!geoData || !filteredEarthquakes || !svgRef.current || !containerRef.current) { // Use filteredEarthquakes here for check
        // Removed console.log for prerequisites
        return;
    }

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    // Removed console.log for dimensions

    // Add guard clause for valid dimensions
    if (width <= 0 || height <= 0) {
      // console.warn('Container dimensions not ready or invalid:', { width, height }); // Keep this warning potentially
      return; // Don't draw if dimensions are not valid
    }

    // Clear previous render
    svg.selectAll('*').remove();

    const projection = d3.geoMercator()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, height / 1.5]);

    // Removed console.log for projection

    const pathGenerator = d3.geoPath().projection(projection);

    svg.append('rect')
       .attr('width', width)
       .attr('height', height)
       .attr('fill', '#a0c4ff');

    svg.append('g')
      .selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', pathGenerator)
      .attr('fill', '#cccccc')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.5);

    const minDepth = 0;
    const maxDepth = 700;

    const depthColorScale = d3.scaleSequential(d3.interpolateRgb("red", "blue"))
      .domain([minDepth, maxDepth]);

    // --- Plot Earthquakes with Tooltips ---
    svg.append('g')
       .attr('class', 'earthquakes')
       .selectAll('circle')
       .data(filteredEarthquakes) // Use filtered data
       .enter()
       .append('circle')
       .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0)
       .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
       .attr('r', d => d.magnitude * 1.5)
       .attr('fill', d => depthColorScale(d.depth))
       .attr('fill-opacity', 0.7) // Slightly increased opacity
       .attr('stroke', '#333')
       .attr('stroke-width', 0.5)
       .style('cursor', 'pointer') // Add pointer cursor on hover
       .on('mouseover', (event, d: EarthquakeData) => {
         try { // Keep try-catch for safety
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
       });
    // --- End Plot Earthquakes ---

  }, [geoData, earthquakeData, minMagnitudeFilter, showOnlyShallow]); // Add filter states to dependencies

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-100"> {/* Added bg color for contrast */}
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