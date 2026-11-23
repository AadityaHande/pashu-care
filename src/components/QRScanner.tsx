"use client";
import { useEffect, useId } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera } from "lucide-react";

export default function QRScanner({ onDetected }: { onDetected: (value: string) => void }) {
  const reactId = useId().replace(/:/g, "");
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(`animal-qr-reader-${reactId}`, { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 }, false);
    scanner.render((decodedText) => {
      onDetected(decodedText);
      scanner.clear().catch(() => undefined);
    }, () => undefined);
    return () => { scanner.clear().catch(() => undefined); };
  }, [reactId, onDetected]);
  return <div className="qr-scanner-shell">
    <div id={`animal-qr-reader-${reactId}`} className="qr-reader" />
    <p className="muted small"><Camera size={14} /> Allow camera access to scan an animal&apos;s QR identity tag.</p>
  </div>;
}
