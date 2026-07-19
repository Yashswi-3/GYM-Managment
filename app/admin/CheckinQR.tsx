"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

export default function CheckinQR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const url = `${window.location.origin}/checkin`;
    QRCode.toCanvas(canvasRef.current, url, { width: 96, margin: 1 });
  }, []);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "gym-checkin-qr.png";
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <div className="flex items-center gap-3">
      <canvas ref={canvasRef} className="border rounded" />
      <Button variant="secondary" size="sm" onClick={download}>
        Download check-in QR
      </Button>
    </div>
  );
}
