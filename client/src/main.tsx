import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// After the server is updated, a tab that was already open still points at
// the previous build's script files, which no longer exist. Vite raises
// this event when loading one fails; reloading fetches the new build. The
// timestamp guard stops a reload loop if the failure has another cause
// (for example, the network is down).
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "healthsync:lastChunkReload";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
