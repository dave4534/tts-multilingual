#!/usr/bin/env python3
"""
Extract a 6-10 second clip from source audio for use as a Chatterbox voice reference.

Requires: pip install pydub; ffmpeg on PATH (for MP3 support).

Usage:
  python voices/extract_clip.py input.mp3 output.wav --start 30 --duration 8
  python voices/extract_clip.py input.wav output.wav --start 1:30 --duration 8

Times: --start in seconds or M:SS; --duration in seconds (default 8, range 6-10).
"""

import argparse
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
except ImportError:
    print("Error: pydub required. Run: pip install pydub", file=sys.stderr)
    sys.exit(1)


def parse_time(s: str) -> float:
    """Parse seconds or M:SS to seconds."""
    if ":" in s:
        parts = s.split(":")
        return int(parts[0]) * 60 + float(parts[1])
    return float(s)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract a 6-10 second clip from source audio for Chatterbox voice reference."
    )
    parser.add_argument("input", type=Path, help="Input audio file (MP3, WAV, etc.)")
    parser.add_argument("output", type=Path, help="Output WAV file")
    parser.add_argument(
        "--start",
        type=str,
        default="0",
        help="Start time in seconds or M:SS (default: 0)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=8.0,
        help="Clip duration in seconds, 6-10 (default: 8)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    duration = args.duration
    if duration < 6 or duration > 10:
        print("Warning: Chatterbox works best with 6-10 second clips. Using --duration 8.", file=sys.stderr)
        duration = min(max(duration, 6), 10)

    start_sec = parse_time(args.start)
    start_ms = int(start_sec * 1000)
    duration_ms = int(duration * 1000)

    audio = AudioSegment.from_file(str(args.input))
    if start_ms + duration_ms > len(audio):
        print(
            f"Error: Clip extends past end of file "
            f"(file length: {len(audio)/1000:.1f}s, requested: {start_sec}s + {duration}s)",
            file=sys.stderr,
        )
        sys.exit(1)

    clip = audio[start_ms : start_ms + duration_ms]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    clip.export(str(args.output), format="wav")
    print(f"Saved {args.output} ({duration}s from {start_sec}s)")


if __name__ == "__main__":
    main()
