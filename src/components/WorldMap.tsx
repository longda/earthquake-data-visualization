'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';

// Define an interface for our earthquake data
interface EarthquakeData {
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
  // Add other fields if needed later
}

const WorldMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [earthquakeData, setEarthquakeData] = useState<EarthquakeData[]>([]); // State for earthquake data

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
        // Convert string values to numbers, handle potential errors/missing data
        const latitude = parseFloat(d.Latitude ?? '');
        const longitude = parseFloat(d.Longitude ?? '');
        const magnitude = parseFloat(d.Magnitude ?? '');
        const depth = parseFloat(d.Depth ?? '');

        // Only include valid entries
        if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(magnitude) && !isNaN(depth)) {
          acc.push({ latitude, longitude, magnitude, depth });
        } else {
          // console.warn('Skipping row with invalid data:', d); // Optional: Log skipped rows
        }
        return acc;
      }, []);
      setEarthquakeData(parsedData);
    }).catch(err => console.error('Error loading or parsing earthquake CSV:', err));

  }, []); // Run only once on component mount

  useEffect(() => {
    if (!geoData || !earthquakeData.length || !svgRef.current || !containerRef.current) return; // Wait for both datasets

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();

    // Clear previous render
    svg.selectAll('*').remove();

    // Define projection - using Mercator as suggested in PRD
    // Adjust scale and translate to fit the container
    const projection = d3.geoMercator()
      .scale(width / (2 * Math.PI)) // Scale based on width
      .translate([width / 2, height / 1.5]); // Center the map slightly lower

    // Define path generator
    const pathGenerator = d3.geoPath().projection(projection);

    // Draw the ocean background
    svg.append('rect')
       .attr('width', width)
       .attr('height', height)
       .attr('fill', '#a0c4ff'); // Light blue for ocean

    // Draw the map features (countries)
    svg.append('g')
      .selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', pathGenerator)
      .attr('fill', '#cccccc') // Light gray for landmasses
      .attr('stroke', '#ffffff') // White borders
      .attr('stroke-width', 0.5);

    // --- Plot Earthquakes ---

    // Determine depth range for color scale
    // Using a fixed range based on typical data, adjust if needed
    const minDepth = 0; // d3.min(earthquakeData, d => d.depth) ?? 0;
    const maxDepth = 700; // Approx max depth; d3.max(earthquakeData, d => d.depth) ?? 700;

    // Color scale: Red (shallow) to Blue (deep)
    const depthColorScale = d3.scaleSequential(d3.interpolateRgb("red", "blue"))
      .domain([minDepth, maxDepth]);

    // Select all circles, bind data, and handle enter selection
    svg.append('g')
       .attr('class', 'earthquakes') // Group for earthquakes
       .selectAll('circle')
       .data(earthquakeData)
       .enter()
       .append('circle')
       .attr('cx', d => projection([d.longitude, d.latitude])?.[0] ?? 0) // Use projection for coordinates
       .attr('cy', d => projection([d.longitude, d.latitude])?.[1] ?? 0)
       .attr('r', d => d.magnitude * 1.5) // Scale radius by magnitude (adjust multiplier as needed)
       .attr('fill', d => depthColorScale(d.depth))
       .attr('fill-opacity', 0.6) // Make circles slightly transparent
       .attr('stroke', '#333') // Add a subtle border
       .attr('stroke-width', 0.5);

    // --- End Plot Earthquakes ---

  }, [geoData, earthquakeData]); // Redraw when geoData or earthquakeData changes

  // Note: Proper resize handling would ideally use ResizeObserver

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default WorldMap; 