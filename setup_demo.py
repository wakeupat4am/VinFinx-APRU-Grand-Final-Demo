"""Install a private, hash-checked demo asset pack and create fresh synthetic accounts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = 'wakeupat4am/VinFinx-APRU-Grand-Final-Demo'

def install_pack(lock, supplied, runtime):
    archive=supplied.resolve() if supplied else runtime/lock['filename']
    if not archive.exists():
        if supplied:raise SystemExit('Asset ZIP does not exist: '+str(archive))
        subprocess.run(['gh','release','download',lock['release'],'--repo',REPO,'--pattern',lock['filename'],'--dir',str(runtime)],check=True)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=lock['sha256']:raise SystemExit('Asset ZIP checksum mismatch: '+lock['filename'])
    with zipfile.ZipFile(archive) as bundle:
        if set(bundle.namelist())!=set(lock['files']) or len(bundle.namelist())!=len(lock['files']):raise SystemExit('Unexpected asset archive members')
        for name,expected in lock['files'].items():
            data=bundle.read(name)
            if hashlib.sha256(data).hexdigest()!=expected:raise SystemExit('Asset checksum mismatch: '+name)
            target=runtime/name
            if not target.resolve().is_relative_to(runtime.resolve()):raise SystemExit('Unsafe asset path')
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', type=Path, help='Owner-supplied asset ZIP; otherwise download the private release with gh')
    parser.add_argument('--detail-assets',type=Path,help='Exact supplementary research interval ZIP for offline installation')
    parser.add_argument('--with-browser',action='store_true',help='Install the locked recording/QA browser tools (requires Node.js and npm)')
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 12):
        raise SystemExit('Use Python 3.12 for the serialized model and pinned dependencies: python3.12 setup_demo.py')
    os.umask(0o077)
    lock = json.loads((ROOT/'assets.lock.json').read_text())
    runtime = ROOT/'.runtime'
    runtime.mkdir(exist_ok=True)
    detail=json.loads((ROOT/'detail-assets.lock.json').read_text())
    install_pack(lock,args.assets,runtime)
    install_pack(detail,args.detail_assets,runtime)
    hashes={**lock['files'],**detail['files']}
    (runtime/'model/manifest.json').write_text(json.dumps({Path(n).name:h for n,h in hashes.items() if n.startswith('model/')}))
    shutil.copyfile(runtime/'market.json', ROOT/'prototype/vinfinx/local_app/assets/market.json')
    env = ROOT/'.venv'
    python = env/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    if not python.exists():
        venv.EnvBuilder(with_pip=True).create(env)
    subprocess.run([str(python),'-m','pip','install','-r',str(ROOT/'requirements.txt')],check=True)
    subprocess.run([str(python),'-m','pip','check'],check=True)
    subprocess.run([str(python),str(ROOT/'demo.py'),'init'],check=True)
    if args.with_browser:
        npm=shutil.which('npm.cmd' if os.name=='nt' else 'npm')
        if not npm:
            raise SystemExit('App setup succeeded. Install Node.js 24, then run npm ci and npm run browsers from this folder.')
        subprocess.run([npm,'ci','--ignore-scripts'],cwd=ROOT,check=True)
        subprocess.run([npm,'run','browsers'],cwd=ROOT,check=True)
    print('\nReady. Run: '+str(python)+' demo.py serve')

if __name__ == '__main__':
    main()
