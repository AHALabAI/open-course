"""Validate the course catalog, local links, notices and distributable file boundary.

Copyright (c) 2026 AHALab contributors. SPDX-License-Identifier: MIT
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib,json,re,sys

ROOT=Path(__file__).resolve().parents[1]
SLUG=re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
errors=[]
def require(ok,message):
    if not ok:errors.append(message)
def read(p):
    try:return json.loads(p.read_text(encoding='utf-8'))
    except (OSError,ValueError) as e:errors.append(f'{p.relative_to(ROOT)}: {e}');return None
def local(base,relative):
    target=(base/unquote(urlsplit(relative).path)).resolve()
    if not target.is_relative_to(ROOT):errors.append('Path leaves repository: '+relative);return None
    require(target.exists(),'Missing local path: '+str(target.relative_to(ROOT)))
    return target

def main():
    catalog=read(ROOT/'catalog.json')
    if not isinstance(catalog,dict):return 1
    topics={x['id'] for x in catalog['topics']};ids=set();session_count=0
    for row in catalog['courses']:
        ident=row['id'];require(bool(SLUG.fullmatch(ident)),'Invalid course ID: '+ident)
        require(ident not in ids,'Duplicate course ID: '+ident);ids.add(ident)
        course=local(ROOT,row['path'])
        if course is None or not course.is_dir():continue
        meta=read(course/'course.json')
        if not isinstance(meta,dict):continue
        require(meta.get('id')==ident,'Catalog/course ID mismatch: '+ident)
        require(meta.get('primary_topic') in topics,'Unknown primary topic: '+ident)
        require(row['path']==f"courses/{meta.get('primary_topic')}/{ident}",'Noncanonical course path: '+ident)
        require(set(meta.get('topics',[]))<=topics,'Unknown course topic: '+ident)
        require(meta.get('primary_topic') in meta.get('topics',[]),'Primary topic missing from topics: '+ident)
        require(set(meta.get('connection_axes',[]))<= {'people','world'},'Unknown connection axis: '+ident)
        require(bool(meta.get('content_languages')),'Missing content languages: '+ident)
        require(isinstance(meta.get('planned_duration_minutes'),int) and meta['planned_duration_minutes']>0,'Invalid duration: '+ident)
        for n in ['README.md','syllabus.md','assessment.md','resources.json','assets.json','ATTRIBUTION.md','CHANGELOG.md']:local(course,n)
        seen=set();minutes=0
        for item in meta.get('available_sessions',[]):
            require(item['id'] not in seen,'Duplicate session: '+ident+'/'+item['id']);seen.add(item['id']);session_count+=1
            require(isinstance(item.get('planned_minutes'),int) and item['planned_minutes']>0,'Invalid session duration: '+ident)
            minutes+=item['planned_minutes'];local(course,item['entry'])
            require(item.get('delivery') in ['repository','external-website'],'Unknown delivery: '+ident)
            if item.get('delivery')=='external-website':require(urlsplit(item.get('url','')).scheme=='https','External session needs HTTPS: '+ident)
        require(minutes<=meta['planned_duration_minutes'],'Session total exceeds course plan: '+ident)
        for entry in meta.get('code_entries',[]):local(course,entry)
        resources=read(course/'resources.json')
        if isinstance(resources,list):
            rids=set()
            for r in resources:
                require(r['id'] not in rids,'Duplicate resource ID: '+ident+'/'+r['id']);rids.add(r['id'])
                require(bool(r.get('rights')),'Missing resource rights: '+ident+'/'+r['id'])
                if r.get('distribution')=='included':local(course,r['path'])
                elif r.get('distribution')=='external-link':require(urlsplit(r.get('url','')).scheme=='https','External resource needs HTTPS: '+ident+'/'+r['id'])
                else:errors.append('Unknown resource distribution: '+ident+'/'+r['id'])
    for row in catalog.get('tools',[]):
        tool=local(ROOT,row['path'])
        if tool:
            for n in ['README.md','LICENSE','ATTRIBUTION.md','CITATION.cff','PROVENANCE.md']:local(tool,n)
    for row in catalog.get('skills',[]):
        skill=local(ROOT,row['path'])
        if skill:
            for n in ['SKILL.md','ATTRIBUTION.md','PROVENANCE.md']:local(skill,n)
    # Check references without calling third-party sites during local validation.
    class Links(HTMLParser):
        def __init__(self):super().__init__();self.links=[]
        def handle_starttag(self,tag,attrs):
            self.links.extend(v for k,v in attrs if k in ['href','src'] and v)
    count=0
    for f in ROOT.rglob('*'):
        if not f.is_file() or {'.git','__pycache__','node_modules'}.intersection(f.parts):continue
        count+=1;rel=f.relative_to(ROOT)
        require(not f.is_symlink(),'Symlink requires separate review: '+str(rel))
        require(not f.name.startswith('.env'),'Environment file: '+str(rel))
        require(not {'.env','.env.local','id_rsa','id_ed25519'}.intersection(rel.parts),'Sensitive file: '+str(rel))
        require(not {'_ops','_backups','project-code-private','website-public-course','runtime'}.intersection(rel.parts),'Private directory: '+str(rel))
        require(f.suffix.lower() not in {'.pem','.key','.p12','.pfx','.blend','.splat','.mp4','.zip','.ply'},'Review binary separately: '+str(rel))
        if f.suffix not in {'.md','.json','.html','.js','.css','.py','.cff'}:continue
        s=f.read_text(encoding='utf-8')
        # This validator describes the patterns; do not match those descriptions as secrets.
        if f.resolve()!=Path(__file__).resolve():
            require(not re.search(r'(?i)(?:[A-Z]:[\\/](?:Users|Workspace|Projects)|file:///|https?://[^/\s]+\.(?:feishu\.cn|larksuite\.com)/(?:wiki|docx|base)/|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)',s),'Private path/document/key marker: '+str(rel))
            for host in re.findall(r'https?://(\d{1,3}(?:\.\d{1,3}){3})(?=[:/\s])',s):
                require(host.startswith('127.'),'Raw remote IP needs a named public endpoint: '+str(rel))
            require(not re.search(r'(?i)(?:api_key|api_secret|access_token|client_secret)\s*[:=]\s*["\x27][^"\x27]{12,}',s),'Credential assignment: '+str(rel))
        links=[]
        if f.suffix=='.md':
            clean=re.sub(r'```.*?```','',s,flags=re.S)
            links=re.findall(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)',clean)
            parser=Links();parser.feed(clean);links+=parser.links
        elif f.suffix=='.html':
            parser=Links();parser.feed(s);links=parser.links
        elif f.suffix=='.css':
            links=[next(x for x in groups if x) for groups in re.findall(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)''',s)]
        for link in links:
            u=urlsplit(link)
            if not u.scheme and not u.netloc and u.path:local(f.parent,link)
    # Illustrations/screenshots are allowed only when credited in the repository asset index.
    asset_list=read(ROOT/'assets/ASSETS.json')
    listed=set()
    if isinstance(asset_list,list):
        for asset in asset_list:
            p=local(ROOT,asset['path']);listed.add(asset['path'])
            for k in ['creator','source','rights','sha256']:require(bool(asset.get(k)),'Missing asset '+k+': '+asset['path'])
            if p and p.is_file():require(hashlib.sha256(p.read_bytes()).hexdigest()==asset['sha256'],'Asset hash mismatch: '+asset['path'])
    for f in ROOT.rglob('*'):
        if f.is_file() and '.git' not in f.parts and f.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.glb','.pdf'}:
            require(f.relative_to(ROOT).as_posix() in listed,'Missing asset attribution: '+f.relative_to(ROOT).as_posix())
    print(json.dumps({'courses':len(catalog['courses']),'sessions':session_count,'tools':len(catalog.get('tools',[])),'files_checked':count,'errors':errors,'passed':not errors},ensure_ascii=False,indent=2))
    return int(bool(errors))
if __name__=='__main__':sys.exit(main())
