"""Same-customer evidence only. Qwen remains optional and never writes records."""
import json
import os
import re
import time
import urllib.request
import urllib.error
import urllib.parse
import threading

BASE=os.environ.get('VINFINX_QWEN_URL','http://127.0.0.1:8061/vinfinx-api').rstrip('/')
_CACHE={};_HEALTH_LOCK=threading.Lock()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
_HTTP=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())

def local_endpoint():
    parsed=urllib.parse.urlparse(BASE)
    if parsed.scheme!='http' or parsed.hostname not in ['127.0.0.1','localhost'] or parsed.username or parsed.password:
        raise ValueError('Qwen must use a trusted loopback HTTP endpoint')
    return BASE

def health():
    with _HEALTH_LOCK:
        if _CACHE.get('base')==BASE and time.monotonic()-_CACHE.get('at',0)<5:return dict(_CACHE['result'])
        result=_probe()
        _CACHE.update(base=BASE,at=time.monotonic(),result=result)
        return dict(result)

def _probe():
    try:
        with _HTTP.open(local_endpoint()+'/health',timeout=2) as r:
            d=json.load(r)
        return {'online':d.get('status')=='ready','provider':'Private Qwen loopback service','details':{k:d[k] for k in ['status','model','revision','engine','precision'] if k in d}}
    except Exception:return {'online':False,'provider':'Evidence mode','details':'Qwen endpoint unavailable. No LLM answer is being simulated.'}

def _select_evidence(topic,candidates):
    """Qwen selects optional labels. It receives neither user text nor customer values."""
    if not candidates or not health()['online']:
        return [],{}
    schema={'type':'object','properties':{'evidence_ids':{'type':'array','maxItems':2,
            'items':{'type':'string','enum':list(candidates)}}},'required':['evidence_ids'],'additionalProperties':False}
    payload={'messages':[{'role':'system','content':'Select up to two relevant optional evidence IDs. Return JSON only.'},
                         {'role':'user','content':json.dumps({'topic':topic,'options':candidates})}],
             'max_tokens':100,'response_format':{'type':'json_schema','json_schema':{'name':'evidence_selection','strict':True,'schema':schema}}}
    req=urllib.request.Request(local_endpoint()+'/v1/chat/completions',data=json.dumps(payload).encode(),
        headers={'Content-Type':'application/json','Origin':os.environ.get('VINFINX_QWEN_ORIGIN','http://127.0.0.1:4173')})
    with _HTTP.open(req,timeout=12) as response:
        out=json.load(response)
    parsed=json.loads(out['choices'][0]['message']['content'])
    if not isinstance(parsed,dict) or set(parsed)!={'evidence_ids'}:
        raise ValueError('Invalid evidence selection')
    ids=parsed['evidence_ids']
    if (not isinstance(ids,list) or len(ids)>2 or
            any(not isinstance(key,str) or key not in candidates for key in ids) or len(ids)!=len(set(ids))):
        raise ValueError('Invalid evidence IDs')
    return ids,out.get('usage',{})


def answer(message,summary):
    started=time.monotonic()
    profile=summary['profile'];h=summary['health'];p=summary.get('property')
    facts={};ids=[];optional={}
    mode='Evidence mode (deterministic explanation)';usage={}
    def fact(key,label,value,unit,source):
        facts[key]={'label':label,'value':value,'unit':unit,'status':source}
        return key

    if re.search(r'\b(macro|market|rates?|rumou?rs?|leaks?|inflation|policy)\b',message,re.I):
        text=('The pilot has no verified live market signal to apply. No macro adjustment is reflected '
              'in the property estimate or financial-health score. Check the source and date of any reported change with an advisor.')
    elif re.search(r'\b(home|house|property|valuation|estimate|price|worth)\b',message,re.I):
        if not p or p.get('status')=='rejected':
            text='There is no usable saved property estimate. Calculate and save an estimate to review its range and model factors.'
        else:
            r=p['result']
            ids=[fact('property.low','Lower end',r['low'],'VND','Research AVM'),
                 fact('property.high','Upper end',r['high'],'VND','Research AVM'),
                 fact('property.estimate','Point estimate',r['value'],'VND','Research AVM')]
            factors=', '.join(item['factor'] for item in r.get('factors',[])[:3])
            text=(f"The saved indicative range is VND {r['low']:,.0f} to {r['high']:,.0f}. "
                  f"The point estimate is VND {r['value']:,.0f}. "
                  +(f"The largest model contributions include {factors}. " if factors else '')
                  +'The model uses historical asking prices. No verified live market adjustment was applied.')
    elif re.search(r'\b(loan|borrow\w*|qualif\w*|eligib\w*|credit|mortgage)\b',message,re.I):
        capacity=h['illustrative_borrowing_capacity']
        ids=[fact('health.capacity','Illustrative borrowing capacity',capacity,'VND','Demo rules')]
        text=(f'Your demo borrowing simulation shows VND {capacity:,.0f} under its stated assumptions. '
              'An advisor can review the inputs. The simulation does not determine bank eligibility.')
    else:
        ids=[fact('health.score','Financial-health score',h['score'],'points','Demo rules'),
             fact('profile.income','Monthly income',profile['income'],'VND/month',
                  'Approved synthetic payslip' if profile['verified'] else 'Self-reported'),
             fact('health.surplus','Monthly surplus',h['monthly_surplus'],'VND/month','Demo calculation')]
        fact('profile.expenses','Monthly living expenses',profile['expenses'],'VND/month','Self-reported')
        fact('profile.debt_payment','Monthly debt payments',profile['debt_payment'],'VND/month','Self-reported')
        optional={key:facts[key]['label'] for key in ['profile.expenses','profile.debt_payment']}
        text=(f"Your demo financial-health score is {h['score']}/1000. Monthly income is VND {profile['income']:,.0f}. "
              f"After living expenses and debt payments, your monthly surplus is VND {h['monthly_surplus']:,.0f}. "
              +('An approved synthetic payslip supports your income.' if profile['verified'] else
                'Your income is self-reported. Ask an Authenticator to review the synthetic payslip.'))
    try:
        extra,usage=_select_evidence('financial-health explanation',optional)
    except (ValueError,TypeError,KeyError,IndexError,OSError):
        extra=[]
    if extra:
        mode='Qwen evidence selection · deterministic explanation'
        for key in extra:
            entry=facts[key]
            text+=f" {entry['label']}: VND {entry['value']:,.0f}."
            ids.append(key)
    return {'message':text,'evidence_ids':ids,'mode':mode,'facts':{key:facts[key] for key in ids},
            'seconds':time.monotonic()-started,'usage':usage}
