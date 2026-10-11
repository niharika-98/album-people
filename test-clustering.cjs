const assert=require('assert');
const {clusterFaces}=require('./public/clustering.js');
const face=(id,value,photo=id)=>({id,photo,descriptor:new Float32Array([value]),crop:id,quality:1});
// Same identity varies from front view through intermediate angle to profile:
// the original every-descriptor rule split endpoints 0.7 apart.
const poses=[face('front',0),face('angle',0.35),face('profile',0.7)];
assert.equal(clusterFaces(poses,0.56).length,1);
assert.equal(clusterFaces(poses.slice().reverse(),0.56).length,1);
assert.equal(clusterFaces([...poses,face('other',1.6)],0.56).length,2);
assert.equal(clusterFaces([face('a',0,'photo'),face('b',0.1,'photo')],0.56).length,2);
assert.equal(clusterFaces([face('a',0),face('b',1)],0.56,[['a','b']]).length,1);
assert.equal(clusterFaces([face('a',0,'photo'),face('b',0.1,'photo')],0.56,[['a','b']]).length,2);
assert(clusterFaces([face('a',0),face('b',0.4),face('c',0.8),face('d',1.2)],0.56).length>1);
console.log('Clustering tests passed: pose variation, input order, distinct identities, co-occurrence, corrections, and chain limits.');
