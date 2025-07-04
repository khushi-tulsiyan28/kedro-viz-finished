# Kedro Pipeline Visualizer

A real-time visualization dashboard for monitoring Kedro pipeline execution.

## Features

- Real-time pipeline execution monitoring
- Visual representation of node status (pending, running, completed, error)
- Live execution logs
- Interactive controls to start/stop pipeline execution
- Responsive design that works on desktop and mobile

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Python 3.7+
- Kedro

## Installation

1. Install the frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Install Kedro-Viz (if not already installed):
   ```bash
   pip install kedro-viz
   ```

## Running the Visualizer

1. Start the visualization server:
   ```bash
   cd frontend
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Click the "Run Pipeline" button to start the visualization.

## How It Works

1. The frontend connects to a Node.js server using Socket.IO
2. When you click "Run Pipeline", the server spawns a Kedro process
3. The server sends real-time updates about the pipeline execution to the frontend
4. The frontend updates the visualization based on these updates

## Project Structure

- `server.js` - Node.js server that manages the pipeline execution
- `public/index.html` - The main visualization interface
- `public/style.css` - Custom styles
- `package.json` - Node.js dependencies and scripts

## Customization

### Changing the Pipeline

To visualize a different pipeline, update the `nodes` array in `public/index.html` to match your pipeline's nodes.

### Styling

You can customize the appearance by modifying the CSS in `public/style.css` or by updating the Tailwind classes in the HTML.

## Troubleshooting

- If the visualization doesn't update, check the browser's developer console for errors
- Make sure Kedro is installed and available in your system's PATH
- Ensure no other service is using port 3000

## License

This project is open source and available under the [MIT License](LICENSE).
