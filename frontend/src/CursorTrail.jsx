import { useEffect, useState } from "react";

export default function CursorTrail() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    const handleMove = (e) => {
      const newPoint = {
        x: e.clientX,
        y: e.clientY,
        id: Math.random(),
      };

      setPoints((prev) => [...prev.slice(-50), newPoint]);
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <>
      {points.map((point) => (
        <div
          key={point.id}
          className="trail-dot"
          style={{
            left: point.x,
            top: point.y,
          }}
        />
      ))}
    </>
  );
}