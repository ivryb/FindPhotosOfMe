"""The web copy of an uploaded video: an H.264 MP4 of at most 1920 pixels on its long edge, which every browser plays
and can start and seek before it has fully loaded, plus still frames from across it for its poster and moderation.
Needs ffmpeg and ffprobe.
"""

import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import NamedTuple

WEB_VIDEO_TYPE = "video/mp4"
WEB_EDGE = 1920
# Where frames are taken, as fractions of the video's length. The first is the poster.
FRAMES = (0.1, 0.3, 0.5, 0.7, 0.9)

# Longer conversions are given up, so the worker can report them before Modal's 480-second limit stops it.
TIME_LIMIT = 360
# Phone HDR video (HLG or PQ) looks washed out when shown as standard video, so it is tone mapped first.
HDR = {"arib-std-b67", "smpte2084"}
TONE_MAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv"


def is_video(name: str) -> bool:
    """Matches isVideo in packages/backend/convex/photoKeys.ts."""
    return bool(re.search(r"\.(mp4|mov|m4v|webm)$", name, re.IGNORECASE))


class WebVideo(NamedTuple):
    video: bytes
    frames: list[bytes]


def make_web_video(original: bytes) -> WebVideo:
    """Raises ValueError when the upload isn't a video ffmpeg can read."""
    with tempfile.TemporaryDirectory() as folder:
        source, web = Path(folder, "source"), Path(folder, "web.mp4")
        source.write_bytes(original)
        try:
            hdr = probe(source).get("streams", [{}])[0].get("color_transfer") in HDR
            scale = f"scale='min({WEB_EDGE},iw)':'min({WEB_EDGE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"
            filters = ",".join([scale, *([TONE_MAP] if hdr else []), "format=yuv420p"])
            colors = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"] if hdr else []
            run("ffmpeg", "-i", source, "-map", "0:v:0", "-map", "0:a:0?", "-vf", filters, "-fpsmax", "60",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "6M", "-bufsize", "12M", *colors,
                "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-map_metadata", "-1", "-movflags", "+faststart", web)
            duration = float(probe(web)["format"]["duration"])
            frames = [run("ffmpeg", "-ss", f"{duration * at:.3f}", "-i", web, "-frames:v", "1", "-c:v", "png", "-f", "image2pipe", "-")
                      for at in FRAMES]
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, KeyError, IndexError, ValueError) as error:
            raise ValueError("A video could not be read") from error
        return WebVideo(video=web.read_bytes(), frames=[frame for frame in frames if frame])


def probe(path: Path) -> dict:
    return json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration:stream=color_transfer",
                                      "-of", "json", path], capture_output=True, check=True).stdout)


def run(*command) -> bytes:
    return subprocess.run([command[0], "-nostdin", "-v", "error", "-y", *command[1:]], capture_output=True, check=True, timeout=TIME_LIMIT).stdout
