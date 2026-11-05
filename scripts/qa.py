"""Fresh local state per browser. Never use the operator's recording database."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]

def run(engines):
    destination=ROOT/'qa-results'
    destination.mkdir(exist_ok=True)
    summary=destination/'summary.json'
    summary.write_text(json.dumps({'status':'running','browsers':engines})+'\n')
    try:
        _run(engines)
    except BaseException:
        summary.write_text(json.dumps({'status':'failed','browsers':engines})+'\n')
        raise

def _run(engines):
    results=[]
    for engine in engines:
        if engine not in ('chromium','webkit'):
            raise SystemExit('Supported QA browsers: chromium, webkit')
        out=ROOT/'qa-results'/engine
        out.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='vinfinx-ui-qa-') as scratch:
            state=Path(scratch)/'state'
            subprocess.run([sys.executable,str(ROOT/'demo.py'),'init','--state',str(state)],check=True)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            base=f'http://127.0.0.1:{port}'
            env={**os.environ,'VINFINX_QWEN_URL':'http://127.0.0.1:9/vinfinx-api',
                 'VINFINX_REQUIRE_QWEN':'0','VINFINX_REQUIRE_OCR':'0',
                 'VINFINX_TEST_URL':base,'VINFINX_TEST_STATE':str(state),
                 'VINFINX_TEST_ISOLATED':'1','VINFINX_BROWSER':engine,'VINFINX_TEST_OUTPUT':str(out)}
            client=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with (out/'server.log').open('w') as log:
                process=subprocess.Popen([sys.executable,str(ROOT/'demo.py'),'serve','--state',str(state),'--port',str(port)],
                                         env=env,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
                try:
                    deadline=time.monotonic()+90
                    while True:
                        if process.poll() is not None:raise RuntimeError('QA server exited; inspect '+str(out/'server.log'))
                        try:
                            with client.open(base+'/healthz',timeout=2) as r:
                                if r.status==200:break
                        except OSError:pass
                        if time.monotonic()>deadline:raise RuntimeError('QA server did not start')
                        time.sleep(.25)
                    subprocess.run(['node',str(ROOT/'scripts/qa_browser.cjs')],env=env,cwd=ROOT,check=True,timeout=300)
                    if engine=='chromium':
                        subprocess.run(['node',str(ROOT/'scripts/open_roles.cjs'),'--state',str(state),'--port',str(port),'--check'],cwd=ROOT,check=True)
                    results.append({'browser':engine,'passed':True})
                finally:
                    process.terminate()
                    try:process.wait(timeout=10)
                    except subprocess.TimeoutExpired:process.kill();process.wait()
    (ROOT/'qa-results/summary.json').write_text(json.dumps({'status':'passed','results':results},indent=2)+'\n')
    print('Browser QA passed:', ', '.join(engines), '— screenshots and measurements in qa-results/')
