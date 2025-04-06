'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FeatureCollection } from 'geojson';

const WorldMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    // Fetch GeoJSON data
    d3.json<FeatureCollection>('/world-110m.json').then(data => {
      if (data) {
        setGeoData(data);
      } else {
        console.error('Failed to load GeoJSON data');
      }
    }).catch(err => console.error('Error loading GeoJSON:', err));
  }, []);

  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;

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

  }, [geoData]); // Redraw when geoData is loaded or container size changes (implicitly via parent)

  // Note: Proper resize handling would ideally use ResizeObserver

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default WorldMap; 