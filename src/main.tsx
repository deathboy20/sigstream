import { Buffer } from 'buffer';
import process from 'process';
// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = process;
// @ts-ignore
window.global = window;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
