# HARNESS: does each doc code block appear verbatim (whitespace-normalised) in the showcase source?
import re, sys, pathlib
root = pathlib.Path("reference/showcase")
src = {}
for p in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")) + list(root.rglob("*.py")):
    if "node_modules" in p.parts: continue
    src[str(p)] = "\n".join(l.strip() for l in p.read_text(encoding="utf-8", errors="ignore").splitlines() if l.strip())
for md in sorted(pathlib.Path("doc-snapshot/pages").glob("langgraph-typescript_*.md")):
    text = md.read_text(encoding="utf-8")
    blocks = re.findall(r"^\s*(?:```|~~~~)(\w*)[^\n]*\n(.*?)^\s*(?:```|~~~~)\s*$", text, re.S | re.M)
    for i, (lang, body) in enumerate(blocks):
        if lang not in ("ts", "tsx", "typescript", "python", "py"): continue
        lines = [l.strip() for l in body.splitlines() if l.strip()]
        lines = [l for l in lines if not re.match(r"^//\s*(\[!code|src/)", l) and not l.startswith("{/* [!code")]
        if len(lines) < 3: continue
        norm = "\n".join(lines)
        hit = [k for k, v in src.items() if norm in v]
        if hit:
            print(f"OK    {md.name[21:-3]} #{i} ({len(lines)} lines) -> {pathlib.Path(hit[0]).name}")
        else:
            # find best partial: longest run of consecutive lines found
            best = 0; bestf = ""
            for k, v in src.items():
                run = 0
                for l in lines:
                    if l in v: run += 1
                if run > best: best, bestf = run, k
            print(f"MISS  {md.name[21:-3]} #{i} ({len(lines)} lines, {best} lines found in {pathlib.Path(bestf).name}) first: {lines[0][:70]}")
