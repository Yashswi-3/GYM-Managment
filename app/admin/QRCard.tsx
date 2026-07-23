"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const THUMB_SIZE = 96;
const EXPANDED_SIZE = 360;

/**
 * Renders the QR at the given pixel size and, if given, draws a center
 * badge letter on top. Shared by the small thumbnail and the enlarged
 * (click-to-scan) view so both stay in sync with the exact same logic.
 */
async function drawQr(canvas: HTMLCanvasElement, url: string, size: number, badge?: string) {
  // errorCorrectionLevel "H" (recovers ~30% of the code) is required
  // headroom for drawing the center badge below without breaking scans.
  await QRCode.toCanvas(canvas, url, { width: size, margin: 1, errorCorrectionLevel: "H" });
  if (!badge) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cx = size / 2;
  const cy = size / 2;
  // ~13% of the code's area — comfortably under level H's ~20-25% safe
  // limit, and nowhere near the corner finder squares.
  const radius = size * 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${radius * 1.4}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, cx, cy + 1);
}

export default function QRCard({
  path,
  label,
  filename,
  badge,
}: {
  path: string;
  label: string;
  filename: string;
  /** Single letter drawn in the center (e.g. "C"/"M"/"V") so the three posters are tellable apart at a glance. */
  badge?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // NEXT_PUBLIC_SITE_URL lets the QR always encode one fixed, chosen
    // domain instead of whatever's in the address bar right now — falls
    // back to that if the env var isn't set.
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    drawQr(canvas, `${base}${path}`, THUMB_SIZE, badge);
  }, [path, badge]);

  useEffect(() => {
    const canvas = expandedCanvasRef.current;
    if (!expanded || !canvas) return;
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    drawQr(canvas, `${base}${path}`, EXPANDED_SIZE, badge);
  }, [expanded, path, badge]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <>
      <Card className="p-3 flex items-center gap-3 border-border/60">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Enlarge ${label} QR code`}
          className="cursor-pointer"
        >
          <canvas ref={canvasRef} className="border border-border/60 rounded bg-white p-1" />
        </button>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          <Button variant="secondary" size="sm" onClick={download}>
            Download
          </Button>
        </div>
      </Card>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setExpanded(false)}
        >
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <canvas ref={expandedCanvasRef} className="w-[85vw] max-w-[360px] h-auto rounded bg-white p-3" />
            <span className="text-sm font-medium text-white">{label}</span>
            <Button variant="secondary" size="sm" onClick={() => setExpanded(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
