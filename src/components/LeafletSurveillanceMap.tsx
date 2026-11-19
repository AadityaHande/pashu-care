"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { HealthReport } from "@/lib/types";

type Point = { report: HealthReport; lat: number; lng: number };
function FitToPoints({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points.map(p => [p.lat, p.lng] as [number, number]), { padding: [28, 28], maxZoom: 13 });
  }, [map, points]);
  return null;
}
export default function LeafletSurveillanceMap({ points, onOpen }: { points: Point[]; onOpen: (id: string) => void }) {
  return <div className="leaflet-map-wrap">
    <MapContainer center={[18.542, 73.792]} zoom={12} scrollWheelZoom className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPoints points={points} />
      {points.map(({ report, lat, lng }) => <CircleMarker key={report.id} center={[lat, lng]} radius={report.assessment.priority === "PRIORITY" ? 9 : 6} pathOptions={{ color: report.assessment.priority === "PRIORITY" ? "#c18a32" : "#397653", fillOpacity: 0.75 }}>
        <Popup><strong>{report.id}</strong><br />{report.location}<br />{report.symptoms.join(", ")}<br /><button className="map-popup-action" onClick={() => onOpen(report.id)}>Open report</button></Popup>
      </CircleMarker>)}
    </MapContainer>
    <div className="map-attribution-note">Approximate report locations · OpenStreetMap tiles · Use the report list for records without coordinates</div>
  </div>;
}
