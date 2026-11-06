# HARNESS: make a 12-frame contact sheet (4x3) of a clip so it can be checked by eye.
# usage: python tools/clip-sheet.py <clip.webm> <out.png>
import glob, os, re, subprocess, sys, tempfile
from PIL import Image

clip, out = sys.argv[1], sys.argv[2]
ff = glob.glob(os.path.expanduser('~/AppData/Local/ms-playwright/ffmpeg*/ffmpeg-win64.exe'))[0]
info = subprocess.run([ff, '-i', clip], capture_output=True, text=True).stderr
h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info).groups()
dur = int(h) * 3600 + int(m) * 60 + float(s)
tmp = tempfile.mkdtemp()
frames = []
for k in range(12):
    t = dur * (k + 0.5) / 12
    p = os.path.join(tmp, f'{k}.png')
    subprocess.run([ff, '-v', 'error', '-ss', f'{t:.1f}', '-i', clip, '-frames:v', '1', '-y', p])
    if os.path.exists(p):
        frames.append((t, Image.open(p).convert('RGB').resize((800, 450))))
sheet = Image.new('RGB', (800 * 4, 450 * 3), 'black')
for i, (t, im) in enumerate(frames):
    sheet.paste(im, ((i % 4) * 800, (i // 4) * 450))
sheet.save(out)
print(f'{os.path.basename(clip)}: {dur:.0f}s, {len(frames)} frames -> {out}')
