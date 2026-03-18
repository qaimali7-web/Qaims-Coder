// src/convexClient.js
import { ConvexHttpClient } from "convex/browser";

// Initialize Convex client
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export default convex;