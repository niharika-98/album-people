(function(root){
  const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  function buildZip(files){
    const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
    for(const file of files){
      const name=encoder.encode(file.name),bytes=file.bytes,crc=crc32(bytes);
      const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);
      parts.push(header,bytes);
      const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);
      e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,0x21,true);e.setUint32(16,crc,true);e.setUint32(20,bytes.length,true);e.setUint32(24,bytes.length,true);e.setUint16(28,name.length,true);e.setUint32(42,offset,true);entry.set(name,46);central.push(entry);offset+=header.length+bytes.length;
    }
    const size=central.reduce((sum,p)=>sum+p.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:'application/zip'});
  }
  if(typeof module!=='undefined')module.exports={buildZip,crc32};else root.PhotoZip={buildZip,crc32};
})(typeof window==='undefined'?globalThis:window);
