"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function QRCard({ path, label, filename }: { path: string; label: string; filename: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const url = `${window.location.origin}${path}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 96, margin: 1 });
  }, [path]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <Card className="p-3 flex items-center gap-3 border-border/60">
      <canvas ref={canvasRef} className="border border-border/60 rounded bg-white p-1" />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <Button variant="secondary" size="sm" onClick={download}>
          Download
        </Button>
      </div>
    </Card>
  );
}
