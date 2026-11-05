"""Portable entry points. Uses the existing financial engines and review policy."""
import argparse
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent
APP = ROOT/'prototype/vinfinx/local_app'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['init','serve','accounts','prepare','test','qa'])
    parser.add_argument('--state',type=Path,default=ROOT/'.demo-state')
    parser.add_argument('--port',type=int,default=4176)
    parser.add_argument('--browsers',default='chromium,webkit',help='Comma-separated QA browser engines')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Port must be between 1024 and 65535.')
    state = args.state.resolve()
    os.umask(0o077)
    os.environ.update(VINFINX_LOCAL_STATE=str(state),VINFINX_LOCAL_PORT=str(args.port),
                      VINFINX_MODEL_DIR=str(ROOT/'.runtime/model'),
                      VINFINX_MODEL_MANIFEST=str(ROOT/'.runtime/model/manifest.json'),
                      VINFINX_HYBRID_PATH=str(ROOT/'.runtime/model/hierarchy.json'),
                      VINFINX_WORKSPACE_ROOT=str(ROOT),VINFINX_SAMPLE_ONLY='1')
    os.environ.setdefault('VINFINX_QWEN_ORIGIN',f'http://127.0.0.1:{args.port}')
    sys.path.insert(0,str(APP))
    if args.command == 'init':
        from provision_pilot import provision
        if state.exists():
            if not (state/'pilot_accounts.json').is_file() or not (state/'vinfinx.sqlite').is_file():
                raise SystemExit('State exists but is incomplete. Choose a new --state directory; nothing was overwritten.')
            print('Existing accounts and records preserved:',state)
        else:
            print('Generated fresh synthetic accounts:',provision(state))
        return
    if args.command == 'accounts':
        for a in json.loads((state/'pilot_accounts.json').read_text()):
            print(f"{a['role']:14} {a['email']:34} {a['password']}")
        print('Generated passwords are local to this installation. Do not record or commit this output.')
        return
    lock=json.loads((ROOT/'assets.lock.json').read_text())
    for name,digest in lock['files'].items():
        path=APP/'assets/market.json' if name=='market.json' else ROOT/'.runtime'/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
            raise SystemExit('Missing or modified trusted asset: '+name+'. Run setup_demo.py.')
    if args.command == 'qa':
        from scripts.qa import run
        run(args.browsers.split(','))
    elif args.command == 'serve':
        if not (state/'vinfinx.sqlite').is_file():
            raise SystemExit('Run demo.py init first.')
        print(f'Web: http://127.0.0.1:{args.port}/\niPhone: http://127.0.0.1:{args.port}/?demo=ios',flush=True)
        import serve
        serve.main()
    elif args.command == 'test':
        subprocess.run([sys.executable,'-m','unittest','test_pilot','-v'],cwd=APP,check=True)
    elif args.command == 'prepare':
        # Uses normal authenticated API operations; never approves or rewrites an existing profile.
        base=f'http://127.0.0.1:{args.port}'
        client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        def request(path,data=None):
            req=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers={'Origin':base,'Content-Type':'application/json'})
            with client.open(req,timeout=60) as response:return json.load(response)
        account=next(a for a in json.loads((state/'pilot_accounts.json').read_text()) if a['id']=='customer01')
        request('/api/login',{'email':account['email'],'password':account['password']})
        try:
            snapshot=request('/api/summary')
            if not snapshot['property']:
                request('/api/valuation',{'property':{'district':'quận đống đa','ward':'phường quang trung','street':'đường thái hà','area':52.3,'floors':4,'frontage':4,'road':4,'bedrooms':3,'bathrooms':3,'method':'lightgbm'}})
            if not request('/api/documents'):
                request('/api/upload',{'demo_sample':'pdf'})
            print('Customer 01 has a saved valuation and a sample payslip. Existing records were kept; no review was approved.')
        finally:
            request('/api/logout',{})

if __name__ == '__main__':
    main()
