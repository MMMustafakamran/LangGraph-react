/**
 * Per-take timeline: when each step of the clip starts, in seconds from the start of the video.
 * Logging only — nothing here changes what is recorded. Used afterwards to place narration
 * audio on the clip (voice/NARRATION-GUIDE.md). Written next to the .webm as <name>.timeline.json.
 */
import { writeFileSync } from 'node:fs';

interface Mark { t: number; label: string; detail?: string }

let t0 = 0;
let marks: Mark[] = [];

/** Call when the recorded page is created (Playwright starts the video then). */
export function startTimeline(): void {
  t0 = Date.now();
  marks = [];
}

/** Record that a step starts now. Safe to call when no timeline is running. */
export function mark(label: string, detail?: string): void {
  if (!t0) return;
  marks.push({ t: Math.round((Date.now() - t0) / 100) / 10, label, ...(detail ? { detail } : {}) });
}

/** Write the timeline for a saved clip and reset. */
export function saveTimeline(path: string, clipId: string): void {
  if (!t0) return;
  mark('end');
  try {
    writeFileSync(path, JSON.stringify({ clip: clipId, marks }, null, 2));
  } catch {
    // A missing timeline only means the clip can't be narrated automatically.
  }
  t0 = 0;
  marks = [];
}
