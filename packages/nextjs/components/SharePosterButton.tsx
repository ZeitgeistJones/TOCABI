"use client";

import { useRef, useState } from "react";
import { formatClawd } from "~~/components/PotAmount";
import { getStatusEntry } from "~~/utils/statusMap";

type SharePosterButtonProps = {
  bountyId: bigint;
  title: string;
  totalPledged: bigint;
  status: number;
};

/**
 * Downloads a shareable PNG "wanted poster" via the Canvas API.
 * No server-side rendering required — pure client canvas drawing.
 * Matches the TOCABI visual language: parchment background, blood red accents,
 * Barlow Condensed for numeric data, bold for the WANTED headline.
 */
export const SharePosterButton = ({ bountyId, title, totalPledged, status }: SharePosterButtonProps) => {
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generatePoster = async () => {
    setGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { label: statusLabel } = getStatusEntry(status);

      // Background: parchment
      ctx.fillStyle = "#EDE0C4";
      ctx.fillRect(0, 0, 800, 1000);

      // Border
      ctx.strokeStyle = "rgba(44, 26, 14, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, 760, 960);

      ctx.strokeStyle = "rgba(44, 26, 14, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, 740, 940);

      // File no.
      ctx.fillStyle = "#5C4433";
      ctx.font = "bold 18px 'Arial Narrow', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`FILE NO. #${bountyId.toString()}`, 400, 100);

      // MOST CLAWD WANTED
      ctx.fillStyle = "#2C1A0E";
      ctx.font = "bold 28px Georgia, serif";
      ctx.fillText("MOST CLAWD WANTED", 400, 145);

      // WANTED headline
      ctx.fillStyle = "#2C1A0E";
      ctx.font = "bold 140px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("WANTED", 400, 320);

      // Divider line
      ctx.fillStyle = "rgba(44, 26, 14, 0.3)";
      ctx.fillRect(60, 340, 680, 2);

      // Title — wrapping text
      ctx.fillStyle = "#2C1A0E";
      ctx.font = "italic 26px Georgia, serif";
      ctx.textAlign = "center";
      const maxWidth = 640;
      const lineHeight = 36;
      const words = title.split(" ");
      let line = "";
      let y = 400;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, 400, y);
          line = word;
          y += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, 400, y);

      // Reward section
      y += 80;
      ctx.fillStyle = "#5C4433";
      ctx.font = "bold 16px 'Arial Narrow', Arial, sans-serif";
      ctx.letterSpacing = "0.3em";
      ctx.fillText("REWARD", 400, y);

      y += 50;
      ctx.fillStyle = "#8B1A1A";
      ctx.font = "bold 80px Georgia, serif";
      ctx.fillText(`${formatClawd(totalPledged)} CLAWD`, 400, y);

      // Divider line
      y += 30;
      ctx.fillStyle = "rgba(44, 26, 14, 0.3)";
      ctx.fillRect(60, y, 680, 2);

      // Status stamp
      y += 50;
      ctx.fillStyle = status === 3 ? "#9A7318" : "#2C1A0E";
      ctx.strokeStyle = status === 3 ? "#9A7318" : "#2C1A0E";
      ctx.lineWidth = 2;
      const stampW = 180;
      const stampH = 40;
      const stampX = 400 - stampW / 2;
      ctx.strokeRect(stampX, y - 28, stampW, stampH);
      if (status === 3) {
        ctx.fillStyle = "#9A7318";
        ctx.fillRect(stampX, y - 28, stampW, stampH);
        ctx.fillStyle = "#F4EAD5";
      }
      ctx.font = "bold 20px 'Arial Narrow', Arial, sans-serif";
      ctx.fillText(statusLabel, 400, y);

      // Footer
      ctx.fillStyle = "#5C4433";
      ctx.font = "16px 'Arial Narrow', Arial, sans-serif";
      ctx.fillText("TOCABI · Take Our Clawd And Build It.", 400, 940);
      ctx.fillText("tocabi.xyz · Built on Base", 400, 965);

      // Download
      const link = document.createElement("a");
      link.download = `tocabi-bounty-${bountyId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        className="btn btn-ghost btn-sm rounded-none font-numeric uppercase tracking-widest text-xs"
        onClick={generatePoster}
        disabled={generating}
      >
        {generating ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <span>↓ Save Poster</span>
        )}
      </button>
    </>
  );
};
