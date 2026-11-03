#!/usr/bin/env python3
from pathlib import Path
import csv
p=Path(__file__).resolve().parents[2]/'03_SISTEMA_DISENO/tokens/CONTRASTE_MEDIDO.csv'
rows=list(csv.DictReader(p.open(encoding='utf-8')))
for r in rows: print(f"{r['Combinación']}: {r['ratio']}:1 [{r['WCAG_AA_texto_normal_4.5:1']}]")
if any(r['WCAG_AA_texto_normal_4.5:1']!='PASS' for r in rows):
    raise SystemExit('ERROR: hay pares de contraste que requieren ajuste')
print('OK: pares definidos superan 4.5:1; esto no es auditoría WCAG completa')
