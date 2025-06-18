import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Screen } from "./screens/Screen";

// Render main app
createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
);

// Stagewise dev-tool integration - only in development mode
if (process.env.NODE_ENV === 'development') {
  import('@stagewise/toolbar-react').then(({ StagewiseToolbar }) => {
    // Create separate React root for toolbar to avoid interfering with main app
    const toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'stagewise-toolbar-root';
    document.body.appendChild(toolbarContainer);
    
    const stagewiseConfig = {
      plugins: []
    };
    
    createRoot(toolbarContainer).render(
      <StagewiseToolbar config={stagewiseConfig} />
    );
  }).catch(err => console.error('Failed to load stagewise toolbar:', err));
}
