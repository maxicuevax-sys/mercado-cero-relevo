#!/usr/bin/env python3
from pathlib import Path
import json, xml.etree.ElementTree as ET, csv
root=Path(__file__).resolve().parents[2]
paths=[root/'01_REFERENCIAS/00_MASTER_1536x1024.png',root/'03_SISTEMA_DISENO/tokens/mercado-tokens.json',root/'08_PREVIEW/index.html',root/'05_PROMPTS/00_INICIO_ORQUESTADOR.md']
errors=[]
for p in paths:
    if not p.exists():errors.append('MISSING '+str(p))
for file in root.rglob('*.json'):
    try:json.loads(file.read_text(encoding='utf-8'))
    except Exception as e:errors.append(f'INVALID JSON {file}: {e}')
for file in root.rglob('*.svg'):
    try:
        tree=ET.parse(file)
        if not tree.getroot().tag.endswith('svg'): errors.append('NOT SVG '+str(file))
    except Exception as e:errors.append(f'INVALID SVG {file}: {e}')
for file in root.rglob('*.png'):
    if file.stat().st_size<64:errors.append('SMALL PNG '+str(file))
for md in (root/'04_PANTALLAS').glob('*.md'):
    if 'Definition of Done' not in md.read_text(encoding='utf-8') and md.name!='00_MAPA_DE_PANTALLAS.md':errors.append('NO DOD '+str(md))
agents=list((root/'06_OPENCODE_COPIAR_AL_REPO/.opencode/agents').glob('*.md'))
if len(agents)!=10:errors.append(f'AGENTS expected 10, found {len(agents)}')
for agent in agents:
    t=agent.read_text(encoding='utf-8')
    if not t.startswith('---') or 'mode: ' not in t:errors.append('INVALID AGENT HEADER '+str(agent))
print('SVG:',len(list(root.rglob('*.svg'))),'PNG:',len(list(root.rglob('*.png'))),'agents:',len(agents),'ERRORS:',len(errors))
for x in errors:print('ERROR:',x)
if errors:raise SystemExit(1)
print('OK: integridad básica del paquete, NO ejecución contra la app')
