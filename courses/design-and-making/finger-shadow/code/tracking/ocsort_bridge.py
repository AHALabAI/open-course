"""NDJSON bridge to the included OC-SORT modules; receives boxes, never camera pixels."""
import json
import os
from pathlib import Path
import sys
import time
import uuid

checkout=Path(os.environ.get('OCSORT_ROOT',Path(__file__).resolve().parents[1]/'vendor/ocsort')).resolve()
sys.path.insert(0,str(checkout))
import numpy as np
from scipy.optimize import linear_sum_assignment
from trackers.ocsort_tracker.ocsort import OCSort
from trackers.ocsort_tracker.association import iou_batch

run_id=uuid.uuid4().hex[:12]
sessions={}
print(json.dumps({'ready':True,'engine':'OC-SORT','run':run_id}),flush=True)
for line in sys.stdin:
    request={}
    try:
        request=json.loads(line)
        session=request['session'];boxes=request['boxes'];now=time.monotonic()
        if not isinstance(session,str) or not 1<=len(session)<=100 or not isinstance(boxes,list) or len(boxes)>10:
            raise ValueError('Invalid session or box count')
        raw=np.asarray(boxes,dtype=float).reshape((-1,4))
        if not np.isfinite(raw).all() or (raw<-.25).any() or (raw>1.25).any() or (raw[:,2:]<=raw[:,:2]).any():
            raise ValueError('Invalid normalized boxes')
        for key in list(sessions):
            if now-sessions[key]['last']>120:del sessions[key]
        if session not in sessions:
            if len(sessions)>=8:del sessions[min(sessions,key=lambda key:sessions[key]['last'])]
            sessions[session]={'tracker':OCSort(det_thresh=.5,max_age=90,min_hits=2,iou_threshold=.15,delta_t=3,inertia=.2,use_byte=False),'last':now}
        state=sessions[session];state['last']=now
        detections=np.column_stack((raw*1000,np.ones(len(raw))))
        result=state['tracker'].update(detections,(1000,1000),(1000,1000))
        ids=[None]*len(raw)
        if len(result) and len(raw):
            overlap=iou_batch(raw*1000,result[:,:4])
            rows,columns=linear_sum_assignment(1-overlap)
            for row,col in zip(rows,columns):
                if overlap[row,col]<.5:continue
                # Matching output back to detections must also be unambiguous.
                other=np.delete(overlap[row],col)
                if len(other) and np.max(other)>overlap[row,col]-.05:continue
                ids[int(row)]=f'{run_id}:{session}:{int(result[col,4])}'
        print(json.dumps({'id':request['id'],'engine':'OC-SORT','motionIds':ids}),flush=True)
    except Exception as error:
        print(json.dumps({'id':request.get('id'),'error':str(error)}),flush=True)
