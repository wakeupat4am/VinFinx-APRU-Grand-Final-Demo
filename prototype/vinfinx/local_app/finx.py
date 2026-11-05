"""Ask Finx. Qwen proposes bounded navigation and evidence IDs."""
import json
import os
import re
import unicodedata
import urllib.request

import assistant

TOPICS = {
    'property': ('gia nha', 'dinh gia', 'khoang gia', 'tai san', 'bat dong san', 'property', 'valuation'),
    'health': ('suc khoe tai chinh', 'diem', 'dong tien', 'du phong', 'tai chinh', 'score', 'financial health', 'cash flow', 'emergency fund', 'emergency savings'),
    'documents': ('phieu luong', 'thu nhap', 'giay to', 'xac minh', 'ocr', 'chung tu', 'payslip', 'verified', 'income evidence'),
    'loan': ('vay', 'tra gop', 'tra no', 'khoan vay', 'du no', 'loan', 'borrow', 'borrowing', 'repayments'),
    'advisor': ('tu van', 'bao cao', 'chia se', 'xuat', 'advisor', 'report'),
    'market': ('tin don', 'tin thi truong', 'vi mo', 'rumor', 'rumors', 'macro', 'lai suat hien tai', 'live rate'),
}
ACTIONS = {'property': 'OPEN_PROPERTY', 'health': 'OPEN_HEALTH', 'documents': 'OPEN_DOCUMENTS',
           'loan': 'OPEN_LOAN', 'advisor': 'OPEN_REPORT'}
INTENTS = {'EXPLAIN','NAVIGATE','COMPARE','SIMULATE','REQUEST_EVIDENCE','SUPPORT'}
FLAGS = ['UNVERIFIED_MARKET', 'READ_ONLY', 'UNSUPPORTED_TRANSACTION']
FIELDS = ['intent','evidence_ids','action_id','status','clarification_key','safety_flags']
SCREENS = {'overview','property','health','documents','map','clients','appointments','loan','chat','advisor'}
GOALS = {'property','health','loan'}
STEPS = {'goal','property','valuation','documents','health','loan','chat','advisor'}
CLARIFICATIONS = {'PROPERTY_ESTIMATE','RECENT_VALUATION','USER_GOAL','PROPERTY_FOR_LOAN','INCOME_EVIDENCE'}


def normalize(text):
    normalized = unicodedata.normalize('NFKD', text.casefold().replace('đ','d'))
    return ' '.join(re.findall(r'[a-z]+', ''.join(c for c in normalized if not unicodedata.combining(c))))


def classify(message, context, role):
    screen = context.get('screen')
    allowed = SCREENS if role == 'advisor' else SCREENS - {'clients','appointments'}
    screen = screen if isinstance(screen,str) and screen in allowed else 'overview'
    goal = context.get('goal')
    goal = goal if isinstance(goal,str) and goal in GOALS else None
    step = context.get('step')
    step = step if isinstance(step,str) and step in STEPS else None
    phrase = ' '+normalize(message)+' '
    cues = [topic for topic, words in TOPICS.items() if any(' '+word+' ' in phrase for word in words)]
    if (' lai suat ' in phrase and ' loan ' not in phrase and ' vay ' not in phrase
            and ' mo phong ' not in phrase and screen!='loan' and step!='loan'):
        cues.insert(0,'market')
    # Broad terms can coexist with a specific request. Market refusals take priority.
    topic = next((t for t in ['market','advisor','loan','property','health','documents'] if t in cues),None)
    if not topic:
        contextual = {'map':'property','clients':'health','appointments':'advisor','valuation':'property'}
        candidate = contextual.get(step or screen,step or screen)
        if candidate in ACTIONS:
            topic=candidate
        elif goal in ACTIONS:
            topic=goal
    return topic, cues, screen, goal, step, phrase


def plan_for(topic, phrase, role, snapshot):
    evidence=snapshot['evidence']; profile=snapshot['profile']; prop=evidence['valuation']['status']
    has_pending=any(state=='OCR_PENDING' for state in evidence['documents'].values())
    choices=[]; status='READY'; question=None; flags=[]
    intent='NAVIGATE' if any(x in phrase for x in [' mo ',' o dau ',' den trang ',' navigate ', ' where ']) else 'EXPLAIN'
    action=ACTIONS.get(topic)
    if topic=='health':
        choices=['health.score','health.surplus','profile.income','profile.expenses','profile.debt_payment']
        if profile.get('income') is None:
            status,question='NEEDS_EVIDENCE','INCOME_EVIDENCE'
    elif topic=='property':
        if prop=='MODEL_ESTIMATED':
            choices=['property.range','property.estimate','property.computed_at']
        else:
            status,question='NEEDS_EVIDENCE',('RECENT_VALUATION' if prop=='STALE' else 'PROPERTY_ESTIMATE')
    elif topic=='documents':
        choices=['profile.income_status']
        if not profile['verified'] and not has_pending:
            status,question='NEEDS_EVIDENCE','INCOME_EVIDENCE'
    elif topic=='loan':
        intent='SIMULATE'
        if prop=='MODEL_ESTIMATED':
            choices=['loan.capacity','loan.assumptions']
        else:
            status,question='NEEDS_EVIDENCE',('RECENT_VALUATION' if prop=='STALE' else 'PROPERTY_FOR_LOAN')
            action='OPEN_PROPERTY'
    elif topic=='advisor':
        intent,status='NAVIGATE','HANDOFF'
    elif topic=='market':
        intent,status,flags='SUPPORT','UNSUPPORTED',['UNVERIFIED_MARKET']
    else:
        intent,status,question='SUPPORT','NEEDS_EVIDENCE','USER_GOAL'
    if any(x in phrase for x in [' chuyen tien ',' phe duyet vay ',' duyet khoan vay ',' xac nhan thay ', ' transfer money ', ' send money ', ' approve my loan ', ' approve a loan ']):
        intent,status,action,choices,question,flags='SUPPORT','UNSUPPORTED',None,[],None,['UNSUPPORTED_TRANSACTION']
    if status=='NEEDS_EVIDENCE' and question!='USER_GOAL':
        intent='REQUEST_EVIDENCE'
    if topic=='documents' and role=='advisor' and action:
        flags.append('READ_ONLY')
    return dict(zip(FIELDS,[intent,choices,action,status,question,flags]))


def validate(candidate, safe):
    if not isinstance(candidate,dict) or set(candidate)!=set(FIELDS):
        return False
    for key in ['status','clarification_key']:
        if candidate[key]!=safe[key]:
            return False
    allowed_intents=({safe['intent'],'COMPARE'} if safe['status']=='READY' and safe['intent']=='EXPLAIN'
                     else {safe['intent']})
    if not isinstance(candidate['intent'],str) or candidate['intent'] not in allowed_intents:
        return False
    if candidate['action_id'] not in (None,safe['action_id']):
        return False
    ids=candidate['evidence_ids']
    return (isinstance(ids,list) and all(isinstance(key,str) and key in safe['evidence_ids'] for key in ids)
            and len(set(ids))==len(ids) and candidate['safety_flags']==safe['safety_flags'])


def propose(safe, context):
    if not assistant.health()['online']:
        return None
    def enum(values):
        if values==[None]:
            return {'type':'null'}
        if None in values:
            return {'anyOf':[{'type':'string','enum':[value for value in values if value is not None]}, {'type':'null'}]}
        return {'type':'string','enum':values}
    def list_of(values):
        schema={'type':'array','maxItems':len(values)}
        if values:
            schema['items']=enum(values)
        return schema
    intents=[safe['intent']]
    if safe['status']=='READY' and safe['intent']=='EXPLAIN':
        intents.append('COMPARE')
    fields={'intent':enum(intents),'status':enum([safe['status']]),
            'clarification_key':enum([safe['clarification_key']]),
            'action_id':enum([safe['action_id'],None] if safe['action_id'] else [None]),
            'evidence_ids':list_of(safe['evidence_ids']),'safety_flags':list_of(safe['safety_flags'])}
    schema={'type':'object','properties':fields,'required':FIELDS,'additionalProperties':False}
    prompt=('Choose an allowed intent, navigation action and relevant evidence IDs from this context. '
            'Copy the supplied safety flags and status. Return only the JSON object. '
            +json.dumps({'context':context,'permitted_plan':safe}))
    payload={'messages':[{'role':'user','content':prompt}],'max_tokens':180,
             'response_format':{'type':'json_schema','json_schema':{'name':'finx_plan','strict':True,'schema':schema}}}
    req=urllib.request.Request(assistant.local_endpoint()+'/v1/chat/completions',data=json.dumps(payload).encode(),
        headers={'Content-Type':'application/json','Origin':os.environ.get('VINFINX_QWEN_ORIGIN','http://127.0.0.1:4173')})
    with assistant._HTTP.open(req,timeout=12) as response:
        result=json.load(response)
    return json.loads(result['choices'][0]['message']['content'])


def render(topic, plan, snapshot, glossary=None):
    h=snapshot['health']; p=snapshot['profile']; e=snapshot['evidence']
    def amount(value):
        return f'{value:,.0f} VND'
    if 'UNSUPPORTED_TRANSACTION' in plan['safety_flags']:
        return 'Finx can explain your profile. You confirm any changes or downloads yourself.'
    if topic=='market':
        return 'There is no verified live market evidence to adjust this estimate. Ask an advisor about sources and publication dates.'
    if plan['clarification_key']=='USER_GOAL':
        return 'Would you like help with property prices, financial health or a loan scenario?'
    if plan['clarification_key']=='RECENT_VALUATION':
        if (snapshot.get('property') or {}).get('address_review_required'):
            return 'Review the saved district, ward and street, then run the valuation again.'
        return 'The saved estimate is outdated or missing a date. Run the valuation again for a current range.'
    if plan['clarification_key'] in ('PROPERTY_ESTIMATE','PROPERTY_FOR_LOAN'):
        return 'Save a property estimate first. Enter the district and land area to calculate a range.'
    if glossary=='buffer':
        return ('An emergency fund is money you set aside to cover essential expenses if your income stops. '
                'The Finances screen shows how long the savings on file could cover expenses and debt payments.')
    if topic=='property':
        r=snapshot['property']['result']
        return f"The estimated asking-price range is {amount(r['low'])} to {amount(r['high'])}. The central estimate is {amount(r['value'])}. This range reflects model uncertainty."
    if topic=='documents':
        if e['income_disagreement']:
            return 'The pending payslip differs from the verified income. A verifier needs to review the difference.'
        if p['verified']:
            return 'A verifier confirmed the income on file using the sample payslip.'
        if 'OCR_PENDING' in e['documents'].values():
            return 'The app read the sample payslip. Income is still pending human review.'
        return 'This profile needs income evidence. Open Documents to check the sample payslip.'
    if topic=='loan':
        return f"The illustrative borrowing amount is {amount(h['illustrative_borrowing_capacity'])}. Open the loan scenario to see monthly payments and how they change at different assumed rates."
    if topic=='advisor':
        return 'Preview the report before downloading it, or save a consultation request for your advisor.'
    if p.get('income') is None:
        return 'Add your monthly income in Finances so Finx can explain the score.'
    message=f"Your illustrative financial health score is {h['score']}/1,000. You have {amount(h['monthly_surplus'])} left each month after expenses and debt payments."
    message+=(' A verifier confirmed your income.' if p['verified'] else ' Your income is self-reported.')
    for key,label in [('profile.expenses','Monthly expenses'),('profile.debt_payment','Monthly debt payments')]:
        if key in plan['evidence_ids']:
            message+=f' {label} are {amount(p[key.split(".")[1]])}.'
    return message


def answer(message, snapshot, role, context):
    topic,cues,screen,goal,step,phrase=classify(message,context,role)
    safe=plan_for(topic,phrase,role,snapshot)
    # Explicitly list the only metadata permitted over the private tunnel.
    metadata={'role':role,'screen':screen,'goal':goal,'step':step,'intent_cues':cues,
              'income_status':snapshot['evidence']['profile']['income'],
              'valuation_status':snapshot['evidence']['valuation']['status'],
              'ocr_pending':'OCR_PENDING' in snapshot['evidence']['documents'].values()}
    buffer_question=any(term in phrase for term in (' quy du phong ', ' emergency fund ', ' emergency savings '))
    definition=any(cue in phrase for cue in (' nghia la gi ', ' la gi ', ' dinh nghia ', ' what is ', ' what are ', ' define '))
    glossary='buffer' if topic=='health' and buffer_question and definition else None
    if glossary and safe['status']=='READY':
        safe['evidence_ids']=[]
        metadata['glossary_topic']=glossary
    candidate=None
    try:
        if safe['status'] in ('READY','HANDOFF'):
            candidate=propose(safe,metadata)
    except (ValueError,TypeError,KeyError,IndexError,OSError):
        pass
    live=validate(candidate,safe)
    plan=dict(candidate if live else safe)
    # Required facts always accompany the deterministic text, even if Qwen omits them.
    required={'health':['health.score','health.surplus','profile.income'],
              'property':['property.range','property.estimate'],
              'documents':['profile.income_status'],'loan':['loan.capacity','loan.assumptions']}
    if safe['status']=='READY':
        plan['evidence_ids']=list(dict.fromkeys([*(key for key in required.get(topic,[]) if key in safe['evidence_ids']),*plan['evidence_ids']]))
    return {**plan,'message':render(topic,plan,snapshot,glossary),'mode':'Qwen evidence selection' if live else 'Rule-based explanation'}
