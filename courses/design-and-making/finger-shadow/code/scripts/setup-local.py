"""Install an optional local environment. SPDX-License-Identifier: MIT"""
from pathlib import Path
import hashlib,json,subprocess,sys,urllib.request,venv
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2 or sys.argv[1] not in ['tracking','speech','phones']:raise SystemExit('Usage: python scripts/setup-local.py tracking|speech|phones')
choice=sys.argv[1]
if choice=='phones':
    model=json.loads((ROOT/'speech/models.json').read_text(encoding='utf-8'))['phonemeModel']
    target=ROOT/'.models-speech/english-phones';target.mkdir(parents=True,exist_ok=True)
    for row in model['files']:
        dest=target/row['file']
        if dest.exists():
            if hashlib.sha256(dest.read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('Existing model file differs: '+str(dest))
            continue
        url='https://huggingface.co/'+model['repo']+'/resolve/'+model['revision']+'/'+row['file']
        # Bytes remain in memory until their digest matches, leaving no partial model.
        with urllib.request.urlopen(url,timeout=300) as r:data=r.read()
        if hashlib.sha256(data).hexdigest()!=row['sha256']:raise SystemExit('Model hash mismatch: '+row['file'])
        dest.write_bytes(data);print(row['file'])
else:
    if choice=='tracking':
        for row in json.loads((ROOT/'vendor/ocsort/manifest.json').read_text(encoding='utf-8')):
            dest=ROOT/row['path']
            if dest.exists():
                if hashlib.sha256(dest.read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('Existing dependency file differs: '+row['path'])
                continue
            with urllib.request.urlopen(row['url'],timeout=60) as r:data=r.read()
            if hashlib.sha256(data).hexdigest()!=row['sha256']:raise SystemExit('Dependency hash mismatch: '+row['path'])
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    target=ROOT/('.venv-'+choice)
    venv.EnvBuilder(with_pip=True).create(target)
    python=target/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
    args=['numpy==2.4.4','scipy==1.17.1','filterpy==1.4.5'] if choice=='tracking' else ['-r',str(ROOT/'speech/requirements.txt')]
    subprocess.run([str(python),'-m','pip','install',*args],check=True)
