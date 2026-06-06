"use client";

import { AlertTriangle, Copy, Check, Download, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlaybackKind } from "@/lib/playback";

type VideoPlayerProps = {
  /** Debrid link id, used to build refresh/playlist URLs. */
  linkId: string;
  /** Direct, range-capable media URL. */
  url: string;
  mimeType: string | null;
  kind: PlaybackKind;
  /** Whether the browser can decode this format in an HTML5 element. */
  browserPlayable: boolean;
};

/**
 * Renders an embedded HTML5 player for browser-playable media, with a built-in
 * fallback to external-player (VLC) handoff. Formats the browser can't decode
 * skip straight to the handoff panel.
 */
export function VideoPlayer({
  linkId,
  url,
  mimeType,
  kind,
  browserPlayable,
}: VideoPlayerProps) {
  // Promote to the handoff panel if the embedded element fails to decode.
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const showHandoff = !browserPlayable || playbackFailed;

  return (
    <div className="space-y-4">
      {!showHandoff ? (
        kind === "audio" ? (
          <audio
            className="w-full"
            controls
            onError={() => setPlaybackFailed(true)}
            src={url}
          >
            <source src={url} type={mimeType ?? undefined} />
          </audio>
        ) : (
          <video
            autoPlay
            className="aspect-video w-full border-2 border-foreground bg-black shadow-line"
            controls
            onError={() => setPlaybackFailed(true)}
            playsInline
            src={url}
          >
            <source src={url} type={mimeType ?? undefined} />
          </video>
        )
      ) : (
        <HandoffPanel inBrowserAttempted={playbackFailed} linkId={linkId} url={url} />
      )}

      {!showHandoff ? (
        <details className="border-2 border-foreground bg-card p-3 text-sm">
          <summary className="cursor-pointer font-bold">
            Trouble playing? Open in an external player
          </summary>
          <div className="mt-3">
            <HandoffActions linkId={linkId} url={url} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function HandoffPanel({
  inBrowserAttempted,
  linkId,
  url,
}: {
  inBrowserAttempted: boolean;
  linkId: string;
  url: string;
}) {
  return (
    <div className="border-2 border-foreground bg-card p-4 shadow-line">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-black">
            {inBrowserAttempted
              ? "Your browser couldn’t play this file"
              : "This format needs an external player"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Containers like MKV and AVI don&apos;t decode in most browsers. Open the
            stream in VLC (or another desktop player), or download it to your host.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <HandoffActions linkId={linkId} url={url} />
      </div>
    </div>
  );
}

function HandoffActions({ linkId, url }: { linkId: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable on insecure origins; the raw URL is still
      // visible via the download/playlist actions, so fail quietly.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        {/* The .m3u opens in the OS-default media player (typically VLC). */}
        <a href={`/api/debrid/links/${linkId}/playlist`}>
          <ExternalLink className="size-4" />
          Open in VLC
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={url} rel="noreferrer" target="_blank">
          <Download className="size-4" />
          Download
        </a>
      </Button>
      <Button onClick={() => void copyUrl()} type="button" variant="outline">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy stream URL"}
      </Button>
    </div>
  );
}
