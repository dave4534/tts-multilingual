#!/usr/bin/env python3
"""
Normalize audio levels across voice reference clips for consistent volume.

Requires: pip install pydub; ffmpeg on PATH (for MP3 support).

Usage:
  python voices/normalize_clips.py clip1.wav clip2.wav clip3.wav
  python voices/normalize_clips.py voices/*.wav --target -3 --out-dir voices/normalized
"""

import argparse
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
except ImportError:
    print("Error: pydub required. Run: pip install pydub", file=sys.stderr)
    sys.exit(1)


def match_target_amplitude(sound: AudioSegment, target_dBFS: float) -> AudioSegment:
    """Adjust audio to target dBFS for consistent loudness."""
    change_in_dBFS = target_dBFS - sound.dBFS
    return sound.apply_gain(change_in_dBFS)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize voice reference clips to consistent volume."
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="Input audio files (WAV, MP3, etc.)",
    )
    parser.add_argument(
        "--target",
        type=float,
        default=-3.0,
        help="Target dBFS (default: -3, leaves headroom)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: overwrite input files)",
    )
    args = parser.parse_args()

    out_dir = args.out_dir
    for inp in args.inputs:
        if not inp.exists():
            print(f"Error: Input not found: {inp}", file=sys.stderr)
            sys.exit(1)

    for inp in args.inputs:
        audio = AudioSegment.from_file(str(inp))
        normalized = match_target_amplitude(audio, args.target)
        if out_dir:
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / inp.name
        else:
            out_path = inp
        normalized.export(str(out_path), format="wav")
        print(f"Normalized {inp.name} ({audio.dBFS:.1f} → {args.target} dBFS) → {out_path}")


if __name__ == "__main__":
    main()
