import React from "react";
import ReactDOM from "react-dom/client";
import "./services/pdf/pdfjs-setup";
import "pdfjs-dist/web/pdf_viewer.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
