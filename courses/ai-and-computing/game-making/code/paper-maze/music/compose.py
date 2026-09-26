"""Original score and procedural instruments: no downloaded samples or model quota."""
from pathlib import Path
import json, math, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'music'
OUT.mkdir(parents=True,exist_ok=True)
SR=44100; BPM=112; BEAT=60/BPM; BARS=32; SECONDS=BARS*4*BEAT
N=round(SECONDS*SR)
rng=np.random.default_rng(9252026)
mix=np.zeros((N,2),np.float64)
events=[]
def midi(note):
    if isinstance(note,(int,float)):return note
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    return (int(note[-1])+1)*12+names[note[0]]+(1 if '#' in note else -1 if 'b' in note else 0)
def pitch(note):return 440*2**((midi(note)-69)/12)
def synth(kind,note,duration):
    t=np.arange(round(duration*SR))/SR
    f=pitch(note)
    attack=1-np.exp(-t/.005)
    release=np.minimum(1,np.maximum(0,(duration-t)/.035))
    if kind=='wood':
        y=(np.sin(2*np.pi*f*t)*np.exp(-t/0.27)+.26*np.sin(2*np.pi*f*4*t)*np.exp(-t/.07)+.09*np.sin(2*np.pi*f*9.12*t)*np.exp(-t/.025))*attack
    elif kind=='pluck':
        y=sum(a*np.sin(2*np.pi*f*k*t+.012*k)*np.exp(-t/(.19+.18/k)) for k,a in [(1,1),(2,.28),(3,.12),(4,.05)])*attack
    elif kind=='bass':
        y=(np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*2*t)+.055*np.sin(2*np.pi*f*3*t))*attack*np.exp(-t/.42)
    elif kind=='bell':
        y=sum(a*np.sin(2*np.pi*f*k*t)*np.exp(-t/d) for k,a,d in [(1,1,.58),(2,.19,.24),(3,.055,.12)])*attack
    elif kind=='flute':
        y=(np.sin(2*np.pi*f*t+.012*np.sin(2*np.pi*5*t))+.07*np.sin(2*np.pi*f*2*t))*np.minimum(t/.065,1)*np.exp(-t/1.1)
    elif kind=='kick':
        y=np.sin(2*np.pi*(48*t+2.1*(1-np.exp(-t*35))))*np.exp(-t*21)*(1-np.exp(-t/.002))
    elif kind=='shake':
        noise=rng.standard_normal(len(t))
        y=sosfilt(butter(2,4800,fs=SR,btype='highpass',output='sos'),noise)*np.exp(-t*57)*attack*.34
    elif kind=='brush':
        noise=rng.standard_normal(len(t))
        y=(sosfilt(butter(2,[900,6500],fs=SR,btype='bandpass',output='sos'),noise)*.21+np.sin(2*np.pi*190*t)*.1)*np.exp(-t*30)*attack
    else:raise ValueError(kind)
    return y*release
def add(kind,note,beat,duration,volume,pan=0,echo=False):
    duration=max(.08,duration)
    y=synth(kind,note,duration)*volume
    start=round(beat*BEAT*SR)%N
    gains=np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])
    def place(offset,g,flip=False):
        idx=(start+offset+np.arange(len(y)))%N
        mix[idx]+=y[:,None]*g*(gains[::-1] if flip else gains)
    place(0,1)
    if echo:
        place(round(.105*SR),.12,True)
        place(round(.185*SR),.07)
    events.append({'instrument':kind,'note':note,'beat':round(beat,4),'duration':duration})
chords={
'C':(['C4','E4','G4','C5'],'C3','G3'),
'Am':(['A3','C4','E4','A4'],'A2','E3'),
'F':(['F3','A3','C4','F4'],'F2','C3'),
'G':(['G3','B3','D4','G4'],'G2','D3'),
'Dm':(['D4','F4','A4','D5'],'D3','A3'),
'Em':(['E4','G4','B4','E5'],'E3','B3'),
}
progression=['C','Am','F','G','C','Am','Dm','G']*2+['F','C','Dm','G','Em','Am','Dm','G']+['C','Am','F','G','C','F','G','G']
# Each bar is a phrase, not randomly chosen notes. Long notes and rests make room.
A=[
[(0,'C5',.5),(.75,'E5',.25),(1,'G5',.75),(2,'E5',.5),(2.75,'D5',.25),(3,'C5',.7)],
[(0,'E5',.5),(.75,'A5',.25),(1,'G5',.5),(2,'E5',1),(3.5,'C5',.25)],
[(0,'F5',.5),(.75,'A5',.25),(1,'C6',.5),(2,'A5',.5),(3,'G5',.5)],
[(0,'G5',.5),(.75,'D5',.25),(1,'B4',.7),(2.5,'D5',.5),(3.25,'G5',.5)],
[(0,'E5',.5),(.75,'G5',.25),(1,'C6',.75),(2,'G5',.5),(3,'E5',.5)],
[(0,'A5',.65),(1,'G5',.5),(2,'E5',.5),(2.75,'D5',.25),(3,'C5',.5)],
[(0,'D5',.5),(.75,'F5',.25),(1,'A5',.65),(2,'F5',.5),(3,'D5',.5)],
[(0,'B4',.5),(1,'D5',.5),(2,'G5',.75),(3.25,'D5',.25),(3.75,'B4',.18)]
]
B=[
[(0,'A5',1),(1.5,'G5',.5),(2.5,'F5',.5),(3.25,'A5',.25)],
[(0,'G5',1),(1.5,'E5',.5),(2.5,'C5',.6)],
[(0,'D5',.5),(.5,'F5',.5),(1.5,'A5',.5),(2.5,'C6',.7)],
[(0,'B5',.75),(1,'A5',.5),(2,'G5',1)],
[(0,'G5',.75),(1,'B5',.5),(2,'G5',.5),(3,'E5',.5)],
[(0,'A5',.75),(1,'C6',.5),(2,'B5',.5),(3,'A5',.5)],
[(0,'F5',.5),(.75,'A5',.25),(1.5,'F5',.5),(2.5,'D5',.65)],
[(0,'D5',.5),(1,'G5',.75),(2.25,'A5',.25),(2.75,'B5',.25),(3.25,'D6',.35)]
]
for bar,chord in enumerate(progression):
    notes,root,fifth=chords[chord];base=bar*4;section=bar//8
    add('bass',root,base,.75,.16,-.06)
    add('bass',fifth,base+2.5,.49,.11,-.06)
    for j,(off,idx) in enumerate([(0,0),(.5,2),(1,1),(1.75,3),(2.5,2),(3.5,1)]):
        add('pluck',notes[idx],base+off+(0.035 if off%1 else 0),.47,.051 if j%2 else .062,-.34,True)
    for off in [1,3]:
        for nidx,n in enumerate(notes[:3]):add('pluck',n,base+off+nidx*.018,.25,.019,-.5,True)
    for j in range(8):add('shake','C4',base+j/2+.018*(j%2),.115,.06 if j%2 else .035,.42)
    for off in [0,2.5]:add('kick','C2',base+off,.19,.085)
    for off in [1,3]:add('brush','C3',base+off,.16,.073,.12)
    phrase=B[bar%8] if section==2 else A[bar%8]
    if bar==29:phrase=[(0,'A5',.7),(1,'G5',.5),(2,'F5',.5),(3,'A5',.5)]
    if bar==30:phrase=[(0,'G5',.65),(1,'D5',.5),(2,'B4',.5),(3,'D5',.5)]
    if bar==31:phrase=[(0,'G5',.75),(1.5,'D5',.5),(2.5,'B4',.65)]
    for j,(off,n,d) in enumerate(phrase):
        timing=.02 if off%1 else 0
        add('wood',n,base+off+timing,min(.78,d*BEAT+.12),.165*(1 if j%3==0 else .85),.12,True)
        if section==2:add('flute',n,base+off+.025,max(.18,d*BEAT),.027,-.12,True)
    if bar%4==3:
        for off,n in [(2.5,notes[1]),(3.25,notes[2])]:
            add('bell',midi(n)+12,base+off,.82,.033,.48,True)
    if section==1 and bar%2==0:
        add('bell',midi(notes[2])+12,base+3.5,.6,.025,.35,True)
# Circular room reflections preserve the note tails across the loop seam.
dry=mix.copy()
for delay,gain in [(.041,.07),(.079,.05),(.131,.035)]:
    mix+=np.roll(dry,round(delay*SR),axis=0)[:,::-1]*gain
mix-=mix.mean(axis=0)
peak=float(np.max(np.abs(mix)))
mix*=.76/peak
pcm=np.rint(mix*32767).astype('<i2')
wav=OUT/'turn-a-corner-loop.wav'
with wave.open(str(wav),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
# Ogg preserves loop timing; MP3 is an easy-to-share listening copy.
for ext,args in [('ogg',['-c:a','libvorbis','-q:a','5']),('mp3',['-c:a','libmp3lame','-b:a','192k'])]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),*args,'-metadata','title=Turn a Corner, Find a Surprise','-metadata','artist=Paper Maze original procedural score',str(OUT/('turn-a-corner.'+ext))],check=True)
report={'title':'转个弯，发现惊喜','bpm':BPM,'bars':BARS,'duration_seconds':len(mix)/SR,'sample_rate':SR,'channels':2,'peak_dbfs':round(20*np.log10(np.max(np.abs(mix))),2),'rms_dbfs':round(20*np.log10(np.sqrt(np.mean(mix**2))),2),'loop_boundary_delta':float(np.max(np.abs(mix[0]-mix[-1]))),'notes_and_hits':len(events),'source':'Original hand-authored score; deterministic synthesized instruments, no external samples.'}
(OUT/'score.json').write_text(json.dumps({'metadata':report,'events':events},ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'tests'/'music-render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
