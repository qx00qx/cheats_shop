export function getVideoEmbedUrl(value: string, autoplay = false): string | null {
  try {
    const url = new URL(value, window.location.origin);
    const hostname = url.hostname.toLowerCase();
    let embed: URL | null = null;

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) {
        embed = new URL(
          `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
        );
      }
    } else if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    ) {
      const videoId =
        url.searchParams.get("v") ??
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      if (videoId) {
        embed = new URL(
          `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
        );
      }
    } else if (
      hostname === "vimeo.com" ||
      hostname.endsWith(".vimeo.com")
    ) {
      const videoId = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1];
      if (videoId) {
        embed = new URL(`https://player.vimeo.com/video/${videoId}`);
        const privateHash = url.searchParams.get("h") ??
          url.pathname.match(/^\/\d+\/([a-zA-Z0-9]+)/)?.[1];
        if (privateHash) embed.searchParams.set("h", privateHash);
      }
    } else if (hostname === "kinescope.io" || hostname === "www.kinescope.io") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const videoId = pathParts[0] === "embed" ? pathParts[1] : pathParts[0];
      if (videoId) {
        embed = new URL(`https://kinescope.io/embed/${encodeURIComponent(videoId)}`);
        url.searchParams.forEach((value, key) => {
          embed?.searchParams.set(key, value);
        });
        embed.searchParams.set("controls", "1");
        if (autoplay) {
          embed.searchParams.set("autoplay", "true");
          embed.searchParams.set("muted", "true");
          embed.searchParams.set("playsinline", "true");
        }
        return embed.toString();
      }
    }

    if (!embed) return null;
    embed.searchParams.set("controls", "1");
    if (autoplay) {
      embed.searchParams.set("autoplay", "1");
      embed.searchParams.set("mute", "1");
      embed.searchParams.set("playsinline", "1");
    }
    return embed.toString();
  } catch {
    return null;
  }
}

export function isDirectVideoUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      /\.(?:mp4|webm|ogg)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
