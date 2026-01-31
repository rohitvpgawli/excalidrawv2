"use client";
import { Excalidraw } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

const ExcalidrawWrapper: React.FC = () => {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Excalidraw />
    </div>
  );
};

export default ExcalidrawWrapper;
