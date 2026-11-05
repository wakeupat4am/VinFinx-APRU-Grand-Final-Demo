"""A single English report renderer for review and consented download."""
import hashlib
import html

from evidence import iso_time


def preview(snapshot):
    p=snapshot['profile']; h=snapshot['health']; prop=snapshot['property']; ev=snapshot['evidence']
    esc=html.escape
    amount=lambda value: f'{value:,.0f} VND'
    income=('Verified by a reviewer (HUMAN_VERIFIED)' if p['verified']
            else 'Self-reported by the customer (USER_PROVIDED)')
    figures=[('Monthly income',p['income']),('Monthly expenses',p['expenses']),('Monthly debt payments',p['debt_payment']),
             ('Money left each month',h['monthly_surplus']),('Emergency savings',p['cash'])]
    rows=''.join(f'<tr><th scope="row">{label}</th><td>{amount(value)}</td></tr>' for label,value in figures)
    labels=['Cash flow','Debt burden','Emergency savings','Income evidence']
    components=''.join(f"<tr><th scope='row'>{label}</th><td>{line['points']:.1f} / {line['max_points']} points</td></tr>"
                       for label,line in zip(labels,h['breakdown']))
    content=(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
             '<title>VinFinx Report</title><style>body{font:16px system-ui;max-width:48rem;margin:2rem auto;padding:1rem}'
             'th,td{text-align:left;padding:.45rem;border-bottom:1px solid #888}table{border-collapse:collapse;width:100%}</style>'
             f'<h1>VinFinx Financial Health Report</h1><p>Synthetic data (SIMULATED) for illustration and consultation.</p>'
             f'<h2>{esc(p["name"])}</h2><p>Illustrative score {h["score"]}/1000. Version {esc(h["rules_version"])}.</p>'
             f'<p>Income evidence: {income}.</p><table>{rows}</table><h2>Score breakdown</h2><table>{components}</table>'
             '<p>Credit scoring and lending decisions follow a separate bank process.</p>'
             '<p>The comparison group contains 100 synthetic profiles.</p>')
    if ev['income_disagreement']:
        content+='<p>The pending evidence shows a different income from the verified profile (CONFLICTING).</p>'
    if prop and prop['status']!='rejected':
        r=prop['result']; v=ev['valuation']
        content+=(f'<h2>Model valuation ({v["status"]})</h2><p>{amount(r["value"])}. '
                  f'Prediction range: {amount(r["low"])} to {amount(r["high"])}.</p>'
                  f'<p>Model {esc(str(v["model_version"]))}, method {esc(str(v["method"]))}. '
                  f'Calculated: {iso_time(v["computed_at"])}. Training data cutoff: unavailable in this record.</p>'
                  f'<p>Inference ID {esc(str(r.get("inference",{}).get("id") or "Unavailable"))}. '
                  f'Model SHA-256 {esc(str(r.get("model_sha256") or "Unavailable"))}.</p>'
                  '<p>The model uses historical asking prices. The prediction range reflects uncertainty.</p>')
        if prop.get('address_review_required'):
            content+='<p>The saved address requires review. Recalculate before using this estimate.</p>'
    else:
        content+='<p>No usable valuation (MISSING).</p>'
    content+='</html>'
    return {'html':content,'digest':hashlib.sha256((p['id']+'\n'+content).encode()).hexdigest()}
