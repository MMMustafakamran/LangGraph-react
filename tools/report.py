# HARNESS: builds LangGraph-testing-doc.html in the team testing doc's format (Page/Section | LangGraph.python |
# LangGraph.js), so rows can be pasted into the Google Doc. Only the JS column is filled (JS is what was tested).
# Links point at "#LOOM-<clip>" until the clips are on Loom; the clip list at the bottom maps each one.
import html, json, os, re

ROOT = 'C:/Users/QS/Desktop/Copilotkit'
D = 'https://docs.copilotkit.ai/langgraph-typescript/'
DV = 'https://docs.copilotkit.ai/vue/langgraph-typescript/'
VID = ROOT + '/LangGraph-react/autorecorder/videos'
UPLOAD = ROOT + '/LangGraph-upload'

# A failed take still writes a .webm, so batch-2 clips count only if a recorder log says it succeeded
# (or the take's "failure" is the doc's own error, shown on purpose).
LOGS = ROOT + '/LangGraph-react/logs'
good = set()
for lf in os.listdir(LOGS):
    if lf.startswith('record') and lf.endswith('.log'):
        good |= set(re.findall(r'RECORDING SUCCESSFUL\]: .*?(LANGGRAPH-react-[\w-]+)\.webm', open(os.path.join(LOGS, lf), encoding='utf8', errors='ignore').read()))
EXPECTED_FAIL = {'ReasoningMessages', 'A2UIStyling', 'Reasoning', 'RenderAgentState', 'InAppAgentWrite', 'ComponentsStateActions'}  # doc defect #30 is the "failure"
clips = {}
for d in (UPLOAD, ROOT + '/LangGraph-vue/autorecorder/videos', VID):
    if os.path.isdir(d):
        for f in os.listdir(d):
            m = re.match(r'LANGGRAPH-(react|vue)-\d+-(.+)\.webm$', f)
            if not m:
                continue
            if d == VID and f[:-5] not in good and m.group(2) not in EXPECTED_FAIL:
                continue
            clips.setdefault((m.group(1), m.group(2)), f[:-5])

LOOM = json.load(open(ROOT + '/LangGraph-react/tools/loom-links.json', encoding='utf8'))
OK, WARN, BAD = '✅', '⚠️', '❌'

def link(fw, video, text):
    f = clips.get((fw, video))
    if not f:
        return html.escape(text) + ' <i>(clip pending)</i>'
    url = LOOM.get(f, '#LOOM-' + f)
    return f'<a href="{url}">{html.escape(text)}</a>'

def cell(status, links=(), notes=(), block=None):
    """status emoji on its own line, then the Loom link(s), then short notes (doc style)."""
    out = [status] if status else []
    out += list(links)
    out += [html.escape(n) for n in notes]
    if block:
        out.append('Area/Surface: ' + html.escape(block[0]))
        out.append('Problem: ' + html.escape(block[1]))
        out.append('Tested context:')
        out.append('OS: Microsoft Windows 11 Pro')
        out.append('Package Manager and version: npm 11 (Node 26.7.0)')
        out.append('“@copilotkit/react-core”: “1.84.1”, “@copilotkit/runtime”: “1.84.1”, “@copilotkit/sdk-js”: “1.84.1”')
        out.append('Loom Video ' + (block[2] if len(block) > 2 else ''))
    return '<br>'.join(out)

TEMP = 'Note: the agent code on the page has temperature: 0, gpt-5-mini rejects it (400). Recorded with it removed.'

def R(label, path, js, child=False, base=D):
    return ('row', ('- ' if child else '') + label, base + path if path is not None else None, js)

def S(label, a='Section', b='Section'):
    return ('sec', label, a, b)

# ---------------------------------------------------------------- React Guides (team doc order)
L = lambda v, t: link('react', v, t)
react = [
    S('Basics'),
    S('Chat', 'Sub section', 'Sub Section'),
    S('Prebuilt Components', '', ''),
    R('CopilotChat', 'prebuilt-components/chat', cell(OK, [L('PrebuiltChat', 'CopilotChat - JS')])),
    R('CopilotSidebar', 'prebuilt-components/sidebar', cell(OK, [L('PrebuiltSidebar', 'CopilotSidebar - JS')])),
    R('CopilotPopup', 'prebuilt-components/popup', cell(OK, [L('PrebuiltPopup', 'CopilotPopup - JS')])),
    R('Open,Close and Feedback', 'prebuilt-components/chat-controls', cell(OK, [L('ChatControls', 'Open,Close and Feedback - JS')])),
    R('Threads', 'prebuilt-components/copilot-threads-drawer', cell('N/A', [], ['Note: Not tested, Threads needs the Intelligence Platform (skipped).'])),
    S('Custom Look and Feel', 'Sub section', 'Sub section'),
    R('Css Customization', 'custom-look-and-feel/css', cell(OK, [L('CSS', 'Css Customization - JS')])),
    R('Markdown', 'custom-look-and-feel/markdown', cell(OK, [L('Markdown', 'Markdown - JS')])),
    R('Slots', 'custom-look-and-feel/slots', cell(OK, [L('Slots', 'Slots - JS')])),
    R('Fully Headless UI', 'custom-look-and-feel/headless-ui', cell(OK, [L('HeadlessUI', 'Fully Headless UI - JS')])),
    R('Reasoning', 'generative-ui/reasoning', cell(WARN, [L('Reasoning', 'Reasoning - JS')], [
        'Issue: the page shows only frontend code, no agent / model.',
        'With the showcase agent the answer renders, then the chat shows "Cannot send RUN_FINISHED while text messages are still active".'])),
    R('Reasoning Messages', 'custom-look-and-feel/reasoning-messages', cell(WARN, [L('ReasoningMessages', 'Reasoning Messages - JS')], [
        'Issue: same as Reasoning, RUN_FINISHED error banner after the answer. No backend code on the page.'])),
    R('Multimodal Attachments', 'multimodal-attachments', cell(OK, [L('Multimodal', 'Multimodal Attachments - JS')])),
    R('Voice', 'voice', cell(OK, [L('Voice', 'Voice - JS')])),
    R('Frontend Tools', 'frontend-tools', cell(OK, [L('FrontendTools-Fixed', 'Frontend Tools - JS')], [TEMP])),
    S('Built Generative UI'),
    S('Controlled', 'Sub-Section', 'Sub-Section'),
    R('Components as Tools', 'generative-ui/tool-based', cell(OK, [L('ComponentsAsTools', 'Components as Tools - JS')], [TEMP.replace(' Recorded with it removed.', ' The demo agent runs without it.')]), child=True),
    R('Tool Call Rendering', 'generative-ui/tool-rendering', cell(OK, [L('ToolRendering', 'Tool Call Rendering - JS'), L('ToolRenderingDefault', 'Default catch-all - JS'), L('ToolRenderingCustom', 'Custom catch-all - JS')]), child=True),
    R('State Rendering', 'generative-ui/state-rendering', cell(OK, [L('StateRendering', 'State Rendering - JS')]), child=True),
    R('Display components', 'generative-ui/display', cell(OK, [L('Display', 'Display components - JS')], [TEMP.replace(' Recorded with it removed.', ' The demo agent runs without it.')]), child=True),
    R('Interactive components', 'generative-ui/interactive', cell(OK, [L('Interactive', 'Interactive components - JS')], [
        TEMP.replace(' Recorded with it removed.', ' The demo agent runs without it.'),
        'Note: the page says "Not supported on LangGraph (TypeScript)" but it works.']), child=True),
    R('Frontend-Driven Cards', 'generative-ui/frontend-cards', cell(BAD, [L('FrontendCards', 'Issue')], [
        'Issue: page.tsx has no agent, so CopilotChat looks for "default" and the page crashes.',
        'DeploymentWatcher is never mounted and connects to wss://example.com (404), so no card is ever added.',
        'Works with agent="sample_agent" and a button that calls agent.addMessage.']), child=True),
    S('Declarative', 'Sub-Section', 'Sub-Section'),
    R('Components and Surfaces', 'generative-ui/components', cell(BAD, [L('Components', 'Issue')], [], block=(
        'Components and Surfaces', 'standardUI needs maplibre-gl (no install step), and "Do step 3 only" crashes the quickstart app: agent "default" not found.'))),
    R('Surfaces', 'generative-ui/components/surfaces', cell(OK, [L('ComponentsSurfaces', 'Surfaces - JS')], [
        'Note: Product and ProductRow are used but never defined. Needs an agent that uses the run tools/context (quickstart agent does not).'])),
    R('Catalogs', 'generative-ui/components/catalogs', cell(OK, [L('ComponentsCatalogs', 'Catalogs - JS')])),
    R('Standard catalog', 'generative-ui/components/standard-catalog', cell(OK, [L('ComponentsStandardCatalog', 'Standard catalog - JS')])),
    R('State and actions', 'generative-ui/components/state-and-actions', cell(WARN, [L('ComponentsStateActions', 'Issue')], ['Issue: with the state + functions catalog the agent sends an empty reply; no ProductCard renders.', 
        'Note: the catalog is split over separate blocks on the page, had to merge them into one.'])),
    R('Theming', 'generative-ui/components/theming', cell(OK, [L('ComponentsTheming', 'Theming - JS')])),
    R('Transports', 'generative-ui/components/transports', cell(OK, [L('ComponentsTransports', 'Transports - JS')], [
        'Note: only says what a LangGraph Python agent needs, nothing for a TS agent.'])),
    R('Markdown mode', 'generative-ui/components/markdown-mode', cell(WARN, [L('ComponentsMarkdownMode', 'Issue')], [
        'Issue: the agent replies "here is a card with a seats slider" but no card renders, only the text.',
        'Note: only says what a LangGraph Python agent needs, nothing for a TS agent.'])),
    R('Adopt from A2UI', 'generative-ui/components/from-a2ui', cell(OK, [L('ComponentsFromA2UI', 'Adopt from A2UI - JS')], [
        'Note: the Airport / Arrow components are not shown, had to write them.'])),
    S('A2UI', 'Sub-Section', 'Sub-Section'),
    R('A2UI', 'generative-ui/a2ui', cell(WARN, [L('A2UI', 'Issue')], ['Issue: KPI cards render, but both charts fail: "Unable to display PieChart / BarChart: title: Invalid input".', 'Minor Issue: "How it works" shows only the Python SDK helpers on the TS page.'])),
    R('Dynamic Schema A2UI', 'generative-ui/a2ui/dynamic-schema', cell(WARN, [L('A2UIDynamicSchema', 'Issue')], ['Issue: the Card and BarChart fail: "Unable to display Card: title: Invalid input" / "BarChart: description: Invalid input". Only the text and the Export CSV button render.'])),
    R('Fixed Schema A2UI', 'generative-ui/a2ui/fixed-schema', cell(OK, [L('A2UIFixedSchema', 'Fixed Schema -JS')])),
    R('A2UI Advanced', 'generative-ui/a2ui/advanced', cell(OK, [L('A2UIAdvanced', 'A2UI Advanced - JS')], ['Note: step 3 page.tsx uses CopilotChat without importing it.'])),
    R('A2UI Styling', 'generative-ui/a2ui/styling', cell(BAD, [L('A2UIStyling', 'Issue')], [], block=(
        'A2UI Styling', 'Dark mode CSS is invalid (@media inside a selector list): "Parsing CSS source code failed" and the app 500s. Variable names also differ from the A2UI page.'))),
    R('JSON Render', 'generative-ui/json-render', cell(OK, [L('JsonRender', 'JSON Render -JS')])),
    R('Hashbrown', 'generative-ui/hashbrown', cell(OK, [L('Hashbrown', 'Hashbrown -JS')])),
    R('Open Generative UI', 'generative-ui/open-generative-ui', cell(OK, [L('OpenGenerativeUI', 'Open Generative UI -JS')])),
    R('MCP Apps', 'generative-ui/mcp-apps', cell(WARN, [L('McpApps', 'Issue')], [
        'Issue: the runtime snippet uses https://mcp.excalidraw.com which redirects (308), so no Excalidraw tools. The /mcp URL (also on the page) works.'])),
    S('Interactivity'),
    S('Shared State'),
    R('Shared State', 'shared-state', cell(OK, [L('SharedState', 'Shared State - JS')])),
    R('Render agent state in your app', 'shared-state/rendering-in-app', cell(WARN, [L('RenderAgentState', 'Issue')], [
        'Issue: useAgent() with no id + no agent on the provider looks for "default", the page crashes.',
        'Works once agent="sample_agent" is set on the provider.'])),
    R('State Streaming', 'shared-state/streaming', cell(OK, [L('StateStreaming', 'State Streaming -JS')])),
    R('Agent read-only context', 'shared-state/agent-readonly', cell(OK, [L('AgentReadOnly', 'Agent read-only context -JS')])),
    R('In-app agent read', 'shared-state/in-app-agent-read', cell(OK, [L('InAppAgentRead', 'In-app agent read - JS')], ['Minor Issue: RunnableConfig used without import, node body elided.'])),
    R('In-app agent write', 'shared-state/in-app-agent-write', cell(WARN, [L('InAppAgentWrite', 'Issue')], ['Issue: Toggle Language (agent.setState) shows "spanish" for a moment, then the state flips back to "english"; the agent still answers in English.'])),
    R('Predictive state updates', 'shared-state/predictive-state-updates', cell(OK, [L('PredictiveState', 'Predictive state updates - JS')])),
    R('Workflow Execution', 'shared-state/workflow-execution', cell(BAD, [L('WorkflowExecution', 'Issue')], [], block=(
        'Workflow Execution', 'TS agent has missing imports (ReferenceError: StateGraph is not defined), calls an undefined modelWithTools, and the "Divide state to Input and Output" step is empty.'))),
    R('Human in the Loop', 'human-in-the-loop', cell(OK, [L('HumanInTheLoop-Fixed', 'HITL-JS')], [
        TEMP, 'Note: "Going headless" says interrupts are not supported on LangGraph TS, they work.'])),
    R('Pausing the agent state for input', 'human-in-the-loop/useInterrupt', cell(WARN, [L('UseInterrupt', 'Issue')], [
        'Issue: page says "Not supported on LangGraph (TypeScript)" and hides the agent code; the .md agent never builds a graph.',
        'With the showcase graph added it works.']), child=True),
    R('Headless Interrupts', 'human-in-the-loop/headless', cell(WARN, [L('HeadlessInterrupts', 'Issue')], [
        'Issue: page says "Not supported on LangGraph (TypeScript)", but the headless picker works.']), child=True),
    R('Interrupt Flow', 'human-in-the-loop/interrupt-flow', cell(WARN, [L('InterruptFlow', 'Issue')], [
        'Issue: TS agent uses RunnableConfig without import and builds no graph; agentId "starterAgent" vs quickstart "sample_agent". Works once added.']), child=True),
    R('Governed Actions Approval UI', 'human-in-the-loop/governed-actions', cell(OK, [L('GovernedActions', 'Governed Actions Approval')], [
        'Note: no backend shown, only the useHumanInTheLoop variant could be run.']), child=True),
    R('Programmatic Control', 'programmatic-control', cell(OK, [L('ProgrammaticControl', 'Programmatic Control - JS')], [
        TEMP.replace(' Recorded with it removed.', ' The demo agent runs without it.'), 'Note: "Not supported on LangGraph (TypeScript)" banner, but it works.'])),
    R('Web MCP', 'webmcp', cell(WARN, [L('WebMCP', 'Issue')], [
        'Issue: searchOrders() is never defined, and the quickstart agent never calls the tool (it does not bind frontend tools).'])),
    S('Agent Capabilities'),
    S('LangGraph', 'Sub Section', 'Sub Section'),
    R('Readables', 'agent-app-context', '–'),
    R('Custom Graph', 'agent-app-context?impl=graph', cell(OK, [L('AgentAppContext', 'Readables - Custom Graph -JS')], [
        'Minor Issue: StateSchema / CopilotKitStateSchema / RunnableConfig not imported and no graph built, had to add them.']), child=True),
    R('Pre-built', 'agent-app-context?impl=prebuilt', cell(OK, [L('ReadablesPrebuilt', 'Readables -Prebuilt agent -JS')]), child=True),
    R('Agent Config', 'agent-config', cell(OK, [L('AgentConfig', 'Agent Config - JS')], [
        'Note: the agent on the page has temperature: 0.4, gpt-5-mini rejects it (400). Recorded with it removed.'])),
    R('Configurable', 'configurable', cell(BAD, [L('Configurable', 'Not Working')], [], block=(
        'Configurable', 'TS tab only shows graph.invoke(..., { context }); nothing shows how to pass context through LangGraphAgent / CopilotKit.'))),
    R('Subgraphs', 'subgraphs', cell(OK, [L('Subgraphs', 'SubGraphs - JS')], ['Note: no TS agent code, the demo is the feature viewer.'])),
    R('Guardrails and DPL', 'guardrails', 'The code is written only in Python.'),
    R('Sub Agents', 'multi-agent/subagents', cell(OK, [L('SubAgents-Fixed', 'Subagents -JS')], [TEMP])),
    S('Debugging'),
    R('Inspector', 'inspector', cell(OK, [L('Inspector', 'Inspector - JS')], ['Minor Issue: Agent pane shows "No agent selected" until you pick it.'])),
]

# ---------------------------------------------------------------- Vue
V = lambda v, t: link('vue', v, t)
vue = [
    R('Frontend Tools', 'frontend-tools', cell(BAD, [V('FrontendTools', 'Issue')], [
        'Issue: runtime-url="/api/copilotkit" 404s on Vite; a LangGraph agent only calls the tool if it binds CopilotKit actions (not shown).']), base=DV),
    R('Chat Components', 'agentic-chat-ui', cell(BAD, [V('ChatComponents', 'Issue')], [
        'Issue: the code is React/Next (page.tsx, <CopilotKit>); useConfigureSuggestions is not imported.']), base=DV),
    R('Sub Agents', 'multi-agent/subagents', cell(BAD, [V('SubAgents', 'Issue')], [
        'Issue: the agent file stops before the graph is built, and there is no Vue frontend code.']), base=DV),
    R('Web MCP', 'webmcp', cell(BAD, [V('WebMCP', 'Issue')], [
        'Issue: searchOrders is undefined, the tool call fails silently (no reply, no error).']), base=DV),
]

def table(rows, cols):
    h = ['<table>', '<tr>' + ''.join(f'<td><b>{c}</b></td>' for c in cols) + '</tr>']
    for r in rows:
        if r[0] == 'sec':
            vals = [f'<b>{html.escape(r[1])}</b>', html.escape(r[2]), html.escape(r[3])][:len(cols)]
            h.append('<tr>' + ''.join(f'<td>{v}</td>' for v in vals) + '</tr>')
        else:
            _, label, url, js = r
            if '(clip pending)' in js and '#LOOM-' not in js:
                js = ''
            first = f'<a href="{url}">{html.escape(label)}</a>' if url else html.escape(label)
            vals = [first, '', js] if len(cols) == 3 else [first, js]
            h.append('<tr>' + ''.join(f'<td>{v}</td>' for v in vals) + '</tr>')
    h.append('</table>')
    return '\n'.join(h)

qs = cell(WARN, [link('react', 'Quickstart', 'Quickstart - JS')], [
    'Minor Issue: ', '1) The route as published needs CPK_INTELLIGENCE_API_KEY, every request 500s without it. The "Running without the Intelligence Platform?" callout fixes it.',
    '2) Next.js error on every page: Date.now() in a Client Component (providers.tsx).'])
qsv = cell(BAD, [link('vue', 'Quickstart', 'Quickstart - Vue')], [
    'Issue: the Vue steps use BuiltInAgent (OpenAI), never a LangGraph agent, and the live page shows the landing page with Next.js code.'])

used = sorted(set(re.findall(r'#LOOM-([\w-]+)', table(react, ['a', 'b', 'c']) + table(vue, ['a', 'b']) + qs + qsv)))
clip_rows = '\n'.join(f'<tr><td>{c}.webm</td><td>#LOOM-{c}</td></tr>' for c in used)
pending = sorted(set(re.findall(r'([^<>]+) <i>\(clip pending\)</i>', table(react, ['a', 'b', 'c']))))

doc = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>LangGraph JS testing</title>
<style>
body{{font-family:Arial,sans-serif;font-size:11pt;max-width:1100px;margin:16px auto;padding:0 16px}}
table{{border-collapse:collapse;margin-bottom:24px;width:100%}}
td{{border:1px solid #000;padding:6px 8px;vertical-align:top}}
td:nth-child(1){{width:30%}}
</style></head><body>
<h1>LangGraph</h1>
<h2>Quickstarts</h2>
<table>
<tr><td><a href="{D}quickstart">JS (React)</a></td><td>{qs}</td></tr>
<tr><td><a href="{DV}quickstart">JS (Vue)</a></td><td>{qsv}</td></tr>
</table>
<h2>React Guides</h2>
{table(react, ['Page/Section', 'LangGraph.python', 'LangGraph.js'])}
<h2>Vue Guides</h2>
{table(vue, ['Page/Section', 'LangGraph.js'])}
<h2>Clips to upload</h2>
<p>Each link above points at #LOOM-&lt;clip&gt;. Replace it with the Loom URL of that clip (files are in LangGraph-upload).</p>
<table><tr><td><b>Clip</b></td><td><b>Placeholder</b></td></tr>
{clip_rows}
</table>
</body></html>"""
open(ROOT + '/LangGraph-testing-doc.html', 'w', encoding='utf8').write(doc)
print('clips linked:', len(used), '| pending:', len(pending))
for p in pending: print('  pending:', p)
