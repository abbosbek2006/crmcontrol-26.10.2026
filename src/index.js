import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/motion.css";
import { installExitAnimations } from "./utils/motion";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Oyna, menyu va ro'yxatlar yopilganda teskari animatsiya.
installExitAnimations(document.body);
