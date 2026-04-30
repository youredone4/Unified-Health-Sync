import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDarkMode } from "./lib/dark-mode";

// Apply the saved dark-mode preference before React renders so the first
// paint matches the user's choice (avoids a flash from light → dark).
initDarkMode();

createRoot(document.getElementById("root")!).render(<App />);
