"use client";

import { AlertTriangle, Copy, Check, Download, ExternalLink } from "lucide-react";
import { useCallback, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlaybackKind } from "@/lib/playback";

/** A sidecar subtitle track served as WebVTT by the subtitle route. */
export type PlayerSubtitle = {
  id: string;
  lang: string | null;
  label: string;
};

type VideoPlayerProps = {
  /** Debrid link id, used to build refresh/playlist URLs. */
  linkId: string;
  /** Direct, range-capable media URL. */
  url: string;
  mimeType: string | null;
  kind: PlaybackKind;
  /** Whether the browser can decode this format in an HTML5 element. */
  browserPlayable: boolean;
  /** Sidecar subtitle files in the same pack, offered as `<track>` selections. */
  subtitles?: PlayerSubtitle[];
};

/**
 * Minimal typing for the non-standard `HTMLMediaElement.audioTracks` API. Only
 * Safari (and a few Chromium builds behind a flag) populate it; elsewhere it's
 * absent, so the audio-track switcher stays hidden.
 */
type MediaAudioTrack = {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
};
type AudioTrackList = {
  length: number;
  [index: number]: MediaAudioTrack;
};
type VideoWithAudioTracks = HTMLVideoElement & {
  audioTracks?: AudioTrackList;
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
  subtitles = [],
}: VideoPlayerProps) {
  // Promote to the handoff panel if the embedded element fails to decode.
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const showHandoff = !browserPlayable || playbackFailed;

  // The <video> is reached via the DOM (not a React ref) for the imperative,
  // non-standard audioTracks API, so mutating track.enabled stays outside
  // React's tracked state.
  const videoId = useId();
  const [audioTracks, setAudioTracks] = useState<MediaAudioTrack[]>([]);

  const audioTrackListOf = useCallback((): AudioTrackList | undefined => {
    const element = document.getElementById(videoId) as VideoWithAudioTracks | null;
    return element?.audioTracks;
  }, [videoId]);

  // Read the (Safari-only) audioTracks list once metadata loads; hidden when
  // the browser doesn't expose it or there's only a single track to choose.
  const syncAudioTracks = useCallback(() => {
    const tracks = audioTrackListOf();
    if (!tracks || tracks.length <= 1) {
      setAudioTracks([]);
      return;
    }
    setAudioTracks(Array.from({ length: tracks.length }, (_, i) => tracks[i]));
  }, [audioTrackListOf]);

  function selectAudioTrack(index: number) {
    const tracks = audioTrackListOf();
    if (!tracks) {
      return;
    }
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].enabled = i === index;
    }
    syncAudioTracks();
  }

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
            id={videoId}
            onError={() => setPlaybackFailed(true)}
            onLoadedMetadata={syncAudioTracks}
            playsInline
            src={url}
          >
            <source src={url} type={mimeType ?? undefined} />
            {subtitles.map((subtitle) => (
              <track
                key={subtitle.id}
                kind="subtitles"
                label={subtitle.label}
                src={`/api/debrid/links/${subtitle.id}/subtitle.vtt`}
                srcLang={subtitle.lang ?? undefined}
              />
            ))}
          </video>
        )
      ) : (
        <HandoffPanel inBrowserAttempted={playbackFailed} linkId={linkId} url={url} />
      )}

      {!showHandoff && kind === "video" && subtitles.length ? (
        <p className="text-xs font-semibold text-muted-foreground">
          {subtitles.length} subtitle track{subtitles.length === 1 ? "" : "s"}{" "}
          available — use the player&apos;s CC button to choose.
        </p>
      ) : null}

      {!showHandoff && audioTracks.length > 1 ? (
        <div className="border-2 border-foreground bg-card p-3">
          <p className="text-xs font-black uppercase text-muted-foreground">
            Audio track
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {audioTracks.map((audioTrack, index) => (
              <Button
                key={audioTrack.id || index}
                onClick={() => selectAudioTrack(index)}
                size="sm"
                type="button"
                variant={audioTrack.enabled ? "default" : "outline"}
              >
                {audioTrack.label || audioTrack.language || `Track ${index + 1}`}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

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
        <a href={`/api/debrid/links/${linkId}/download`} rel="noreferrer" target="_blank">
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
