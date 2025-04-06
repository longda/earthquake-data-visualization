# Real-Time Global Earthquake Data Visualization

This project is a web application that visualizes global earthquake data on an interactive map. It uses a static dataset but simulates real-time updates to demonstrate dynamic data handling and visualization techniques.

## Features

*   **Interactive World Map:** Displays earthquake locations using D3.js.
*   **Data Representation:**
    *   Circles scaled by magnitude.
    *   Color-coded markers based on depth (Red: Shallow, Blue: Deep).
*   **Real-Time Simulation:** Cycles through a historical earthquake dataset (`public/database.csv`) to simulate new events appearing over time.
*   **Animation:** Uses GSAP for smooth appearance/disappearance animations of earthquake markers.
*   **Filtering:**
    *   Filter earthquakes by minimum magnitude (0-10 Richter scale).
    *   Toggle to show only shallow earthquakes (< 50km depth).
*   **Simulation Controls:**
    *   Play/Pause the simulation.
    *   Scrub through the simulation timeline using a progress bar.
    *   Displays the date/time of the current point in the simulation.
*   **Tooltips:** Hover over an earthquake marker to see details (Magnitude, Depth, Time).

## Technology Stack

*   **Frontend Framework:** [Next.js](https://nextjs.org/) (with React)
*   **Data Visualization:** [D3.js](https://d3js.org/)
*   **Animation:** [GSAP (GreenSock Animation Platform)](https://greensock.com/gsap/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Date Formatting:** [date-fns](https://date-fns.org/)
*   **Hosting:** (Intended for) [Vercel](https://vercel.com/)

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm, yarn, pnpm, or bun

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd earthquake-data-visualization
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install / pnpm install / bun install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    # or yarn dev / pnpm dev / bun dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

*   `public/`: Static assets
    *   `database.csv`: The earthquake dataset.
    *   `world-110m.json`: GeoJSON data for world map outlines.
*   `src/`: Source code
    *   `app/`: Next.js App Router files (layout, page).
    *   `components/`: React components
        *   `WorldMap.tsx`: The main component handling map rendering, data fetching, simulation, and filtering.
    *   `styles/`: Global styles (if any beyond Tailwind).

## Data Source

The earthquake data (`database.csv`) is derived from a publicly available dataset, likely sourced originally from organizations like the USGS. It includes latitude, longitude, magnitude, depth, date, and time for historical earthquakes.

## Development Notes

*   The application is designed to be self-contained and does not require a backend API.
*   Data parsing includes handling for various date formats and potential inconsistencies.
*   D3.js handles the core map rendering and earthquake plotting.
*   GSAP is integrated for animating the enter/exit transitions of earthquake markers.
*   React state management is used for filters, simulation control, and tooltip display.
*   Tailwind CSS provides utility classes for styling.
