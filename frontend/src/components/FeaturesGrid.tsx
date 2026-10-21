import { useState } from "react";

export default function FeaturesGrid({ features }: { features: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!features?.length) return null;

  return (
    <div className="features-block">
      <h3 className="section-title">Возможности</h3>
      <div className={`features-grid ${expanded ? "" : "collapsed"}`}>
        {features.map((f, i) => (
          <div key={i} className="feature-item">
            {f}
          </div>
        ))}
      </div>
      {features.length > 8 && (
        <button className="toggle-features" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Свернуть" : "Показать все"}
        </button>
      )}
    </div>
  );
}