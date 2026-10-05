(()=>{var ks=Object.defineProperty;var _m=(e,t,r)=>t in e?ks(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var At=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')});var ym=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports),bm=(e,t)=>{for(var r in t)ks(e,r,{get:t[r],enumerable:!0})};var Es=(e,t,r)=>_m(e,typeof t!="symbol"?t+"":t,r);var jf=ym((m_,lr)=>{var qg=(function(){"use strict";let s=Math.ceil(335.91796875),o=1024/2*3,u=4*2048*s,d=4,p=3,f=2048*s,m=4*f;function g(T){let E=new Uint16Array(T),I=new Float64Array(T/2),A=new Float64Array(T/2),U=0;for(;1<<U<T;)U++;for(let W=0;W<T;W++){let F=0;for(let H=0;H<U;H++)W&1<<H&&(F|=1<<U-1-H);E[W]=F}for(let W=0;W<T/2;W++){let F=-2*Math.PI*W/T;I[W]=Math.cos(F),A[W]=Math.sin(F)}return function(F,H,te){for(let X=0;X<T;X++){let Z=E[X];if(X<Z){let K=F[X];F[X]=F[Z],F[Z]=K,K=H[X],H[X]=H[Z],H[Z]=K}}let V=te?-1:1;for(let X=2;X<=T;X<<=1){let Z=X>>1,K=T/X;for(let re=0;re<T;re+=X)for(let j=0,le=0;j<Z;j++,le+=K){let N=re+j,M=N+Z,Y=I[le],pe=V*A[le],B=Y*F[M]-pe*H[M],Q=Y*H[M]+pe*F[M];F[M]=F[N]-B,H[M]=H[N]-Q,F[N]+=B,H[N]+=Q}}}}let b=g(4096),_=new Float64Array(4096);for(let T=0;T<4096;T++)_[T]=.5*(1-Math.cos(2*Math.PI*T/4096));let $=new Float64Array(343980);(function(){let T=new Float64Array(343980);for(let E=-2;E<s+2;E++){let I=E*1024-o;for(let A=0;A<4096;A++){let U=I+A;U>=0&&U<343980&&(T[U]+=_[A]*_[A])}}for(let E=0;E<343980;E++)$[E]=T[E]>1e-11?1/T[E]:0})();function x(){let T=new Float64Array(4096),E=new Float64Array(4096),I=new Float64Array(2048),A=new Float64Array(2048),U=new Float64Array(2048),W=new Float64Array(2048),F=[0,1,2,3].map(function(){return new Float64Array(343980)});function H(V,X){let Z=new Float32Array(u),K=1/Math.sqrt(4096),re=343980;for(let j=0;j<s;j++){let le=j*1024-o;for(let N=0;N<4096;N++){let M=le+N;M<0?M=-M:M>=re&&(M=2*(re-1)-M);let Y=_[N]*K;T[N]=V[M]*Y,E[N]=X[M]*Y}b(T,E,!1);for(let N=0;N<2048;N++){let M=4096-N&4095,Y=N*s+j;Z[Y]=(T[N]+T[M])*.5,Z[f+Y]=(E[N]-E[M])*.5,Z[2*f+Y]=(E[N]+E[M])*.5,Z[3*f+Y]=(T[M]-T[N])*.5}}return Z}function te(V,X,Z,K){let re=F[Z],j=F[K],le=343980,N=1/Math.sqrt(4096);re.fill(0),j.fill(0);for(let M=0;M<s;M++){for(let Q=0;Q<2048;Q++){let Se=Q*s+M,ce=0,fe=0,xe=0,ye=0;for(let Oe=0;Oe<X.length;Oe++){let ke=X[Oe]*m+Se;ce+=V[ke],fe+=V[ke+f],xe+=V[ke+2*f],ye+=V[ke+3*f]}I[Q]=ce,A[Q]=fe,U[Q]=xe,W[Q]=ye}A[0]=0,W[0]=0,T[0]=I[0],E[0]=U[0],T[2048]=0,E[2048]=0;for(let Q=1;Q<2048;Q++){T[Q]=I[Q]-W[Q],E[Q]=A[Q]+U[Q];let Se=4096-Q;T[Se]=I[Q]+W[Q],E[Se]=U[Q]-A[Q]}b(T,E,!0);let Y=M*1024-o,pe=Math.max(0,-Y),B=Math.min(4096,le-Y);for(let Q=pe;Q<B;Q++){let Se=_[Q]*N;re[Y+Q]+=T[Q]*Se,j[Y+Q]+=E[Q]*Se}}for(let M=0;M<le;M++)re[M]*=$[M],j[M]*=$[M]}return{forward:H,inverse:te,accum:F}}function v(){let T=new Float32Array(343980),E=Math.floor(343980/2)+1;for(let A=0;A<E;A++)T[A]=A+1;for(let A=E;A<343980;A++)T[A]=343980-A;let I=E;for(let A=0;A<343980;A++)T[A]/=I;return T}function w(){let T=new Error("Separation was cancelled");return T.name="AbortError",T}function k(){return new Promise(function(T){setTimeout(T,0)})}async function C(T,E,I,A){if(A=A||{},!I||!I.length||I.length>2)throw new Error("separate: expected 1 or 2 channels");let U=I[0],W=I.length>1?I[1]:I[0];if(!(U instanceof Float32Array)||!(W instanceof Float32Array)||U.length!==W.length)throw new Error("separate: channels must be Float32Arrays of the same length");let F=U.length,H=Math.min(.9,Math.max(0,A.overlap===void 0?.25:+A.overlap)),te=Math.max(1,Math.floor((1-H)*343980)),V=F?Math.ceil(F/te):0,X=typeof A.onProgress=="function"?A.onProgress:function(){},Z=typeof A.isAborted=="function"?A.isAborted:function(){return!1},K=typeof A.yieldFn=="function"?A.yieldFn:k,re=[new Float32Array(F),new Float32Array(F)],j=[new Float32Array(F),new Float32Array(F)];if(X(0),!V)return X(1),{vocals:re,inst:j};let le=x(),N=v(),M=new Float64Array(343980),Y=E.inputNames[0],pe=E.inputNames[1];function B(ce){let fe=ce*te,xe=Math.min(343980,F-fe),ye=Math.floor((343980-xe)/2),Oe=fe-ye,ke=Math.max(0,Oe),Ve=Math.min(F,Oe+343980),qe=new Float32Array(2*343980);qe.set(U.subarray(ke,Ve),ke-Oe),qe.set(W.subarray(ke,Ve),343980+ke-Oe);let jt=le.forward(qe.subarray(0,343980),qe.subarray(343980)),he={};return he[Y]=new T.Tensor("float32",qe,[1,2,343980]),he[pe]=new T.Tensor("float32",jt,[1,4,2048,s]),{offset:fe,len:xe,shift:ye,feeds:he}}function Q(ce,fe){let xe=null,ye=null;for(let he in ce){let Pe=ce[he];Pe.dims.length===5?xe=Pe.data:Pe.dims.length===4&&(ye=Pe.data)}if(!xe||!ye)throw new Error("the model returned unexpected outputs");le.inverse(xe,[p],0,1),le.inverse(xe,[0,1,2],2,3);let Oe=le.accum,ke=fe.offset,Ve=fe.len,qe=fe.shift;for(let he=0;he<2;he++){let Pe=Oe[he],ii=Oe[2+he],Ei=re[he],ri=j[he],Ii=(p*2+he)*343980,nt=(0+he)*343980,Te=(2+he)*343980,ai=(4+he)*343980;for(let dt=0;dt<Ve;dt++){let st=qe+dt,Ye=N[dt];Ei[ke+dt]+=Ye*(Pe[st]+ye[Ii+st]),ri[ke+dt]+=Ye*(ii[st]+ye[nt+st]+ye[Te+st]+ye[ai+st])}}for(let he=0;he<Ve;he++)M[he]+=N[he];let jt=fe.offset+te>=F?F-ke:Math.min(te,Ve);for(let he=0;he<jt;he++){let Pe=M[he]>0?1/M[he]:0;re[0][ke+he]*=Pe,re[1][ke+he]*=Pe,j[0][ke+he]*=Pe,j[1][ke+he]*=Pe}te<343980?(M.copyWithin(0,te),M.fill(0,343980-te)):M.fill(0)}let Se=null;try{if(Z())throw w();let ce=B(0),fe=E.run(ce.feeds);Se=fe;let xe=V>1?B(1):null;for(let ye=0;ye<V;ye++){let Oe=await fe,ke=ce;if(Se=null,ce=xe,ce){if(await K(),Z())throw w();fe=E.run(ce.feeds),Se=fe}Q(Oe,ke),X((ye+1)/V),xe=ye+2<V?B(ye+2):null}}catch(ce){throw Se&&Se.catch&&Se.catch(function(){}),ce}return{vocals:re,inst:j}}return{SAMPLE_RATE:44100,SEGMENT:343980,FRAMES:s,FREQS:2048,STEMS:d,NFFT:4096,HOP:1024,PAD:o,separate:C,createDsp:x,makeWeights:v,chunkCount:function(T,E){let I=Math.min(.9,Math.max(0,E===void 0?.25:+E));return T?Math.ceil(T/Math.max(1,Math.floor((1-I)*343980))):0},stride:function(T){let E=Math.min(.9,Math.max(0,T===void 0?.25:+T));return Math.max(1,Math.floor((1-E)*343980))}}})();typeof lr<"u"&&lr.exports&&(lr.exports=qg)});var bn={};bm(bn,{InferenceSession:()=>ei,TRACE:()=>Si,TRACE_EVENT_BEGIN:()=>xt,TRACE_EVENT_END:()=>Tt,TRACE_FUNC_BEGIN:()=>at,TRACE_FUNC_END:()=>Ke,Tensor:()=>Ue,default:()=>Ug,env:()=>_e,registerBackend:()=>Ut});var Ga=Object.defineProperty,wm=Object.getOwnPropertyDescriptor,$m=Object.getOwnPropertyNames,vm=Object.prototype.hasOwnProperty,xm=(e=>typeof At<"u"?At:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof At<"u"?At:t)[r]}):e)(function(e){if(typeof At<"u")return At.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),L=(e,t)=>()=>(e&&(t=e(e=0)),t),Jt=(e,t)=>{for(var r in t)Ga(e,r,{get:t[r],enumerable:!0})},Tm=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of $m(t))!vm.call(e,a)&&a!==r&&Ga(e,a,{get:()=>t[a],enumerable:!(i=wm(t,a))||i.enumerable});return e},Ti=e=>Tm(Ga({},"__esModule",{value:!0}),e),ui,wt,Ut,Is,ud,ld=L(()=>{"use strict";ui=new Map,wt=[],Ut=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=ui.get(e);if(i===void 0)ui.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let a=wt.indexOf(e);a!==-1&&wt.splice(a,1);for(let s=0;s<wt.length;s++)if(ui.get(wt[s]).priority<=r){wt.splice(s,0,e);return}wt.push(e)}return}throw new TypeError("not a valid backend")},Is=async e=>{let t=ui.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},ud=async e=>{let t=e.executionProviders||[],r=t.map(d=>typeof d=="string"?d:d.name),i=r.length===0?wt:r,a,s=[],o=new Set;for(let d of i){let p=await Is(d);typeof p=="string"?s.push({name:d,err:p}):(a||(a=p),a===p&&o.add(d))}if(!a)throw new Error(`no available backend found. ERR: ${s.map(d=>`[${d.name}] ${d.err}`).join(", ")}`);for(let{name:d,err:p}of s)r.includes(d)&&console.warn(`removing requested execution provider "${d}" from session options because it is not available: ${p}`);let u=t.filter(d=>o.has(typeof d=="string"?d:d.name));return[a,new Proxy(e,{get:(d,p)=>p==="executionProviders"?u:Reflect.get(d,p)})]}}),Sm=L(()=>{"use strict";ld()}),dd,Cm=L(()=>{"use strict";dd="1.23.0"}),Ar,Re,pd=L(()=>{"use strict";Cm(),Ar="warning",Re={wasm:{},webgl:{},webgpu:{},versions:{common:dd},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);Ar=e}},get logLevel(){return Ar}},Object.defineProperty(Re,"logLevel",{enumerable:!0})}),_e,km=L(()=>{"use strict";pd(),_e=Re}),cd,fd,Em=L(()=>{"use strict";cd=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let a,s;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],s=e.dims[3]):(a=e.dims[3],s=e.dims[2]);let o=t?.format!==void 0?t.format:"RGB",u=t?.norm,d,p;u===void 0||u.mean===void 0?d=[255,255,255,255]:typeof u.mean=="number"?d=[u.mean,u.mean,u.mean,u.mean]:(d=[u.mean[0],u.mean[1],u.mean[2],0],u.mean[3]!==void 0&&(d[3]=u.mean[3])),u===void 0||u.bias===void 0?p=[0,0,0,0]:typeof u.bias=="number"?p=[u.bias,u.bias,u.bias,u.bias]:(p=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(p[3]=u.bias[3]));let f=s*a,m=0,g=f,b=f*2,_=-1;o==="RGBA"?(m=0,g=f,b=f*2,_=f*3):o==="RGB"?(m=0,g=f,b=f*2):o==="RBG"&&(m=0,b=f,g=f*2);for(let $=0;$<s;$++)for(let x=0;x<a;x++){let v=(e.data[m++]-p[0])*d[0],w=(e.data[g++]-p[1])*d[1],k=(e.data[b++]-p[2])*d[2],C=_===-1?255:(e.data[_++]-p[3])*d[3];i.fillStyle="rgba("+v+","+w+","+k+","+C+")",i.fillRect(x,$,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},fd=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let a,s,o;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],s=e.dims[1],o=e.dims[3]):(a=e.dims[3],s=e.dims[2],o=e.dims[1]);let u=t!==void 0&&t.format!==void 0?t.format:"RGB",d=t?.norm,p,f;d===void 0||d.mean===void 0?p=[255,255,255,255]:typeof d.mean=="number"?p=[d.mean,d.mean,d.mean,d.mean]:(p=[d.mean[0],d.mean[1],d.mean[2],255],d.mean[3]!==void 0&&(p[3]=d.mean[3])),d===void 0||d.bias===void 0?f=[0,0,0,0]:typeof d.bias=="number"?f=[d.bias,d.bias,d.bias,d.bias]:(f=[d.bias[0],d.bias[1],d.bias[2],0],d.bias[3]!==void 0&&(f[3]=d.bias[3]));let m=s*a;if(t!==void 0&&(t.format!==void 0&&o===4&&t.format!=="RGBA"||o===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let g=4,b=0,_=1,$=2,x=3,v=0,w=m,k=m*2,C=-1;u==="RGBA"?(v=0,w=m,k=m*2,C=m*3):u==="RGB"?(v=0,w=m,k=m*2):u==="RBG"&&(v=0,k=m,w=m*2),i=r.createImageData(a,s);for(let T=0;T<s*a;b+=g,_+=g,$+=g,x+=g,T++)i.data[b]=(e.data[v++]-f[0])*p[0],i.data[_]=(e.data[w++]-f[1])*p[1],i.data[$]=(e.data[k++]-f[2])*p[2],i.data[x]=C===-1?255:(e.data[C++]-f[3])*p[3]}else throw new Error("Can not access image data");return i}}),qi,hd,md,gd,_d,yd,Im=L(()=>{"use strict";Va(),qi=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,a=t.norm??{mean:255,bias:0},s,o;typeof a.mean=="number"?s=[a.mean,a.mean,a.mean,a.mean]:s=[a.mean[0],a.mean[1],a.mean[2],a.mean[3]??255],typeof a.bias=="number"?o=[a.bias,a.bias,a.bias,a.bias]:o=[a.bias[0],a.bias[1],a.bias[2],a.bias[3]??0];let u=t.format!==void 0?t.format:"RGBA",d=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",p=r*i,f=d==="RGBA"?new Float32Array(p*4):new Float32Array(p*3),m=4,g=0,b=1,_=2,$=3,x=0,v=p,w=p*2,k=-1;u==="RGB"&&(m=3,g=0,b=1,_=2,$=-1),d==="RGBA"?k=p*3:d==="RBG"?(x=0,w=p,v=p*2):d==="BGR"&&(w=0,v=p,x=p*2);for(let C=0;C<p;C++,g+=m,_+=m,b+=m,$+=m)f[x++]=(e[g]+o[0])/s[0],f[v++]=(e[b]+o[1])/s[1],f[w++]=(e[_]+o[2])/s[2],k!==-1&&$!==-1&&(f[k++]=(e[$]+o[3])/s[3]);return d==="RGBA"?new Fe("float32",f,[1,4,r,i]):new Fe("float32",f,[1,3,r,i])},hd=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,a=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,s=typeof e=="string",o,u=t??{},d=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},p=f=>typeof HTMLCanvasElement<"u"&&f instanceof HTMLCanvasElement||f instanceof OffscreenCanvas?f.getContext("2d"):null;if(r){let f=d();f.width=e.width,f.height=e.height;let m=p(f);if(m!=null){let g=e.height,b=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(g=t.resizedHeight,b=t.resizedWidth),t!==void 0){if(u=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");u.tensorFormat="RGBA",u.height=g,u.width=b}else u.tensorFormat="RGBA",u.height=g,u.width=b;m.drawImage(e,0,0),o=m.getImageData(0,0,b,g).data}else throw new Error("Can not access image data")}else if(i){let f,m;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(f=t.resizedHeight,m=t.resizedWidth):(f=e.height,m=e.width),t!==void 0&&(u=t),u.format="RGBA",u.height=f,u.width=m,t!==void 0){let g=d();g.width=m,g.height=f;let b=p(g);if(b!=null)b.putImageData(e,0,0),o=b.getImageData(0,0,m,f).data;else throw new Error("Can not access image data")}else o=e.data}else if(a){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let f=d();f.width=e.width,f.height=e.height;let m=p(f);if(m!=null){let g=e.height,b=e.width;return m.drawImage(e,0,0,b,g),o=m.getImageData(0,0,b,g).data,u.height=g,u.width=b,qi(o,u)}else throw new Error("Can not access image data")}else{if(s)return new Promise((f,m)=>{let g=d(),b=p(g);if(!e||!b)return m();let _=new Image;_.crossOrigin="Anonymous",_.src=e,_.onload=()=>{g.width=_.width,g.height=_.height,b.drawImage(_,0,0,g.width,g.height);let $=b.getImageData(0,0,g.width,g.height);u.height=g.height,u.width=g.width,f(qi($.data,u))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(o!==void 0)return qi(o,u);throw new Error("Input data provided is not supported - aborted tensor creation")},md=(e,t)=>{let{width:r,height:i,download:a,dispose:s}=t,o=[1,i,r,4];return new Fe({location:"texture",type:"float32",texture:e,dims:o,download:a,dispose:s})},gd=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:s}=t;return new Fe({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:a,dispose:s})},_d=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:s}=t;return new Fe({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:a,dispose:s})},yd=(e,t,r)=>new Fe({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),Bt,bi,Or,bd,zm=L(()=>{"use strict";Bt=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),bi=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),Or=!1,bd=()=>{if(!Or){Or=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(Bt.set("int64",BigInt64Array),bi.set(BigInt64Array,"int64")),t&&(Bt.set("uint64",BigUint64Array),bi.set(BigUint64Array,"uint64")),i?(Bt.set("float16",r),bi.set(r,"float16")):Bt.set("float16",Uint16Array)}}}),wd,$d,Am=L(()=>{"use strict";Va(),wd=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},$d=(e,t)=>{switch(e.location){case"cpu":return new Fe(e.type,e.data,t);case"cpu-pinned":return new Fe({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Fe({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Fe({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Fe({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Fe,Va=L(()=>{"use strict";Em(),Im(),zm(),Am(),Fe=class{constructor(e,t,r){bd();let i,a;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,a=e.dims,e.location){case"cpu-pinned":{let o=Bt.get(i);if(!o)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof o))throw new TypeError(`buffer should be of type ${o.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let o,u;if(typeof e=="string")if(i=e,u=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");o=t}else{let d=Bt.get(e);if(d===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&d===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${d.name} as data.`);e==="uint64"||e==="int64"?o=d.from(t,BigInt):o=d.from(t)}else if(t instanceof d)o=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")o=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&d!==Uint16Array)o=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${d}`)}else if(u=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let d=typeof e[0];if(d==="string")i="string",o=e;else if(d==="boolean")i="bool",o=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${d}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",o=Uint8Array.from(e);else{let d=bi.get(e.constructor);if(d===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=d,o=e}if(u===void 0)u=[o.length];else if(!Array.isArray(u))throw new TypeError("A tensor's dims must be a number array");a=u,this.cpuData=o,this.dataLocation="cpu"}let s=wd(a);if(this.cpuData&&s!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(s/2)===this.cpuData.length))throw new Error(`Tensor's size(${s}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=a,this.size=s}static async fromImage(e,t){return hd(e,t)}static fromTexture(e,t){return md(e,t)}static fromGpuBuffer(e,t){return gd(e,t)}static fromMLTensor(e,t){return _d(e,t)}static fromPinnedBuffer(e,t,r){return yd(e,t,r)}toDataURL(e){return cd(this,e)}toImageData(e){return fd(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return $d(this,e)}}}),Ue,vd=L(()=>{"use strict";Va(),Ue=Fe}),Si,Rr,at,Ke,xt,Tt,xd=L(()=>{"use strict";pd(),Si=(e,t)=>{(typeof Re.trace>"u"?!Re.wasm.trace:!Re.trace)||console.timeStamp(`${e}::ORT::${t}`)},Rr=(e,t)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],i=!1;for(let a=0;a<r.length;a++){if(i&&!r[a].includes("TRACE_FUNC")){let s=`FUNC_${e}::${r[a].trim().split(" ")[1]}`;t&&(s+=`::${t}`),Si("CPU",s);return}r[a].includes("TRACE_FUNC")&&(i=!0)}},at=e=>{(typeof Re.trace>"u"?!Re.wasm.trace:!Re.trace)||Rr("BEGIN",e)},Ke=e=>{(typeof Re.trace>"u"?!Re.wasm.trace:!Re.trace)||Rr("END",e)},xt=e=>{(typeof Re.trace>"u"?!Re.wasm.trace:!Re.trace)||console.time(`ORT::${e}`)},Tt=e=>{(typeof Re.trace>"u"?!Re.wasm.trace:!Re.trace)||console.timeEnd(`ORT::${e}`)}}),Td,Om=L(()=>{"use strict";ld(),vd(),xd(),Td=class Sd{constructor(t){this.handler=t}async run(t,r,i){at(),xt("InferenceSession.run");let a={},s={};if(typeof t!="object"||t===null||t instanceof Ue||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let o=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof Ue)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");o=!1;for(let p of r){if(typeof p!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(p)===-1)throw new RangeError(`'fetches' contains invalid output name: ${p}.`);a[p]=null}if(typeof i=="object"&&i!==null)s=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let p=!1,f=Object.getOwnPropertyNames(r);for(let m of this.outputNames)if(f.indexOf(m)!==-1){let g=r[m];(g===null||g instanceof Ue)&&(p=!0,o=!1,a[m]=g)}if(p){if(typeof i=="object"&&i!==null)s=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else s=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let p of this.inputNames)if(typeof t[p]>"u")throw new Error(`input '${p}' is missing in 'feeds'.`);if(o)for(let p of this.outputNames)a[p]=null;let u=await this.handler.run(t,a,s),d={};for(let p in u)if(Object.hasOwnProperty.call(u,p)){let f=u[p];f instanceof Ue?d[p]=f:d[p]=new Ue(f.type,f.data,f.dims)}return Tt("InferenceSession.run"),Ke(),d}async release(){return this.handler.dispose()}static async create(t,r,i,a){at(),xt("InferenceSession.create");let s,o={};if(typeof t=="string"){if(s=t,typeof r=="object"&&r!==null)o=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(s=t,typeof r=="object"&&r!==null)o=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let f=t,m=0,g=t.byteLength;if(typeof r=="object"&&r!==null)o=r;else if(typeof r=="number"){if(m=r,!Number.isSafeInteger(m))throw new RangeError("'byteOffset' must be an integer.");if(m<0||m>=f.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${f.byteLength}).`);if(g=t.byteLength-m,typeof i=="number"){if(g=i,!Number.isSafeInteger(g))throw new RangeError("'byteLength' must be an integer.");if(g<=0||m+g>f.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${f.byteLength-m}].`);if(typeof a=="object"&&a!==null)o=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");s=new Uint8Array(f,m,g)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[u,d]=await ud(o),p=await u.createInferenceSessionHandler(s,d);return Tt("InferenceSession.create"),Ke(),new Sd(p)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),ei,Rm=L(()=>{"use strict";Om(),ei=Td}),Nm=L(()=>{"use strict"}),Mm=L(()=>{"use strict"}),Bm=L(()=>{"use strict"}),Dm=L(()=>{"use strict"}),Cd={};Jt(Cd,{InferenceSession:()=>ei,TRACE:()=>Si,TRACE_EVENT_BEGIN:()=>xt,TRACE_EVENT_END:()=>Tt,TRACE_FUNC_BEGIN:()=>at,TRACE_FUNC_END:()=>Ke,Tensor:()=>Ue,env:()=>_e,registerBackend:()=>Ut});var Ze=L(()=>{"use strict";Sm(),km(),Rm(),vd(),Nm(),Mm(),xd(),Bm(),Dm()}),ja=L(()=>{"use strict"}),kd={};Jt(kd,{default:()=>Ed});var Nr,Mr,Ed,Pm=L(()=>{"use strict";Nf(),Ft(),Ha(),Nr="ort-wasm-proxy-worker",Mr=globalThis.self?.name===Nr,Mr&&(self.onmessage=e=>{let{type:t,in:r}=e.data;try{switch(t){case"init-wasm":Ka(r.wasm).then(()=>{cn(r).then(()=>{postMessage({type:t})},i=>{postMessage({type:t,err:i})})},i=>{postMessage({type:t,err:i})});break;case"init-ep":{let{epName:i,env:a}=r;fn(a,i).then(()=>{postMessage({type:t})},s=>{postMessage({type:t,err:s})});break}case"copy-from":{let{buffer:i}=r,a=or(i);postMessage({type:t,out:a});break}case"create":{let{model:i,options:a}=r;hn(i,a).then(s=>{postMessage({type:t,out:s})},s=>{postMessage({type:t,err:s})});break}case"release":mn(r),postMessage({type:t});break;case"run":{let{sessionId:i,inputIndices:a,inputs:s,outputIndices:o,options:u}=r;gn(i,a,s,o,new Array(o.length).fill(null),u).then(d=>{d.some(p=>p[3]!=="cpu")?postMessage({type:t,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:t,out:d},yn([...s,...d]))},d=>{postMessage({type:t,err:d})});break}case"end-profiling":_n(r),postMessage({type:t});break;default:}}catch(i){postMessage({type:t,err:i})}}),Ed=Mr?null:e=>new Worker(e??Le,{type:"module",name:Nr})}),Id={};Jt(Id,{default:()=>zd});var Br,zd,zs,Um=L(()=>{"use strict";Br=async function(e={}){var t,r,i=e,a=new Promise((n,l)=>{t=n,r=l}),s=typeof window=="object",o=typeof WorkerGlobalScope<"u",u=o&&self.name?.startsWith("em-pthread");i.mountExternalData=(n,l)=>{n.startsWith("./")&&(n=n.substring(2)),(i.Fb||(i.Fb=new Map)).set(n,l)},i.unmountExternalData=()=>{delete i.Fb};var d=globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,qc:!0}).buffer.constructor;let p=n=>async(...l)=>{try{if(i.Gb)throw Error("Session already started");let c=i.Gb={ec:l[0],errors:[]},h=await n(...l);if(i.Gb!==c)throw Error("Session mismatch");i.Kb?.flush();let y=c.errors;if(0<y.length){let S=await Promise.all(y);if(S=S.filter(z=>z),0<S.length)throw Error(S.join(`
`))}return h}finally{i.Gb=null}};i.jsepInit=(n,l)=>{if(n==="webgpu"){[i.Kb,i.Vb,i.Zb,i.Lb,i.Yb,i.Ab,i.$b,i.bc,i.Wb,i.Xb,i.ac]=l;let c=i.Kb;i.jsepRegisterBuffer=(h,y,S,z)=>c.registerBuffer(h,y,S,z),i.jsepGetBuffer=h=>c.getBuffer(h),i.jsepCreateDownloader=(h,y,S)=>c.createDownloader(h,y,S),i.jsepOnCreateSession=h=>{c.onCreateSession(h)},i.jsepOnReleaseSession=h=>{c.onReleaseSession(h)},i.jsepOnRunStart=h=>c.onRunStart(h),i.cc=(h,y)=>{c.upload(h,y)}}else if(n==="webnn"){let c=l[0];[i.oc,i.Ob,i.webnnEnsureTensor,i.Pb,i.webnnDownloadTensor,i.nc,i.webnnEnableTraceEvent]=l.slice(1),i.webnnReleaseTensorId=i.Ob,i.webnnUploadTensor=i.Pb,i.webnnRegisterMLContext=i.nc,i.webnnOnRunStart=h=>c.onRunStart(h),i.webnnOnRunEnd=c.onRunEnd.bind(c),i.webnnOnReleaseSession=h=>{c.onReleaseSession(h)},i.webnnCreateMLTensorDownloader=(h,y)=>c.createMLTensorDownloader(h,y),i.webnnRegisterMLTensor=(h,y,S,z)=>c.registerMLTensor(h,y,S,z),i.webnnCreateMLContext=h=>c.createMLContext(h),i.webnnRegisterMLConstant=(h,y,S,z,R,q)=>c.registerMLConstant(h,y,S,z,R,i.Fb,q),i.webnnRegisterGraphInput=c.registerGraphInput.bind(c),i.webnnIsGraphInput=c.isGraphInput.bind(c),i.webnnRegisterGraphOutput=c.registerGraphOutput.bind(c),i.webnnIsGraphOutput=c.isGraphOutput.bind(c),i.webnnCreateTemporaryTensor=c.createTemporaryTensor.bind(c),i.webnnIsGraphInputOutputTypeSupported=c.isGraphInputOutputTypeSupported.bind(c)}};let f=()=>{let n=(l,c,h)=>(...y)=>{let S=ut,z=c?.();y=l(...y);let R=c?.();return z!==R&&(l=R,h(z),c=h=null),ut!=S?new Promise((q,G)=>{wr={resolve:q,reject:G}}):y};(()=>{for(let l of["_OrtAppendExecutionProvider","_OrtCreateSession","_OrtRun","_OrtRunWithBinding","_OrtBindInput"])i[l]=n(i[l],()=>i[l],c=>i[l]=c)})(),p!==void 0&&(i._OrtRun=p(i._OrtRun),i._OrtRunWithBinding=p(i._OrtRunWithBinding)),f=void 0};i.asyncInit=()=>{f?.()};var m,g,b=(n,l)=>{throw l},_=void 0,$="";if(s||o){try{$=new URL(".",_).href}catch{}o&&(g=n=>{var l=new XMLHttpRequest;return l.open("GET",n,!1),l.responseType="arraybuffer",l.send(null),new Uint8Array(l.response)}),m=async n=>{if(le(n))return new Promise((c,h)=>{var y=new XMLHttpRequest;y.open("GET",n,!0),y.responseType="arraybuffer",y.onload=()=>{y.status==200||y.status==0&&y.response?c(y.response):h(y.status)},y.onerror=h,y.send(null)});var l=await fetch(n,{credentials:"same-origin"});if(l.ok)return l.arrayBuffer();throw Error(l.status+" : "+l.url)}}var x,v,w,k,C,T,E,I,A,U,W,F,H,te,V,X=console.log.bind(console),Z=console.error.bind(console),K=X,re=Z,j=!1,le=n=>n.startsWith("file://");function N(){return v.buffer!=C.buffer&&ye(),C}function M(){return v.buffer!=C.buffer&&ye(),T}function Y(){return v.buffer!=C.buffer&&ye(),E}function pe(){return v.buffer!=C.buffer&&ye(),I}function B(){return v.buffer!=C.buffer&&ye(),A}function Q(){return v.buffer!=C.buffer&&ye(),U}function Se(){return v.buffer!=C.buffer&&ye(),W}function ce(){return v.buffer!=C.buffer&&ye(),te}if(u){let n=function(l){try{var c=l.data,h=c.Db;if(h==="load"){let y=[];self.onmessage=S=>y.push(S),self.startWorker=()=>{postMessage({Db:"loaded"});for(let S of y)n(S);self.onmessage=n};for(let S of c.Sb)i[S]&&!i[S].proxy||(i[S]=(...z)=>{postMessage({Db:"callHandler",Rb:S,args:z})},S=="print"&&(K=i[S]),S=="printErr"&&(re=i[S]));v=c.kc,ye(),V(c.lc)}else if(h==="run"){Zf(c.Bb),Cr(c.Bb,0,0,1,0,0),xn(),yr(c.Bb),xe||(ms(),xe=!0);try{Qf(c.hc,c.Jb)}catch(y){if(y!="unwind")throw y}}else c.target!=="setimmediate"&&(h==="checkMailbox"?xe&&zi():h&&(re(`worker: received unknown command ${h}`),re(c)))}catch(y){throw gs(),y}};var fe=n,xe=!1;self.onunhandledrejection=l=>{throw l.reason||l},self.onmessage=n}function ye(){var n=v.buffer;i.HEAP8=C=new Int8Array(n),E=new Int16Array(n),i.HEAPU8=T=new Uint8Array(n),I=new Uint16Array(n),i.HEAP32=A=new Int32Array(n),i.HEAPU32=U=new Uint32Array(n),W=new Float32Array(n),te=new Float64Array(n),F=new BigInt64Array(n),H=new BigUint64Array(n)}function Oe(){u?startWorker(i):D.Da()}var ke,Ve=0,qe=null;function jt(){if(--Ve==0&&qe){var n=qe;qe=null,n()}}function he(n){throw re(n="Aborted("+n+")"),j=!0,n=new WebAssembly.RuntimeError(n+". Build with -sASSERTIONS for more info."),r(n),n}function Pe(){return{a:{L:mm,Aa:hm,b:Xf,$:kn,A:zn,pa:An,X:On,Z:Rn,qa:Nn,na:Mn,ga:Bn,ma:Dn,J:Pn,Y:Un,V:qn,oa:Wn,W:Ln,va:Jf,E:th,Q:ih,O:ah,D:sh,v:oh,s:uh,P:lh,z:gh,R:_h,ja:yh,T:bh,aa:wh,M:$h,F:vh,ia:yr,sa:xh,r:Th,Ca:Sh,w:Eh,o:Ih,m:Ah,c:hr,Ba:Oh,n:Rh,j:Bh,u:Dh,p:Ph,f:Uh,t:qh,l:Wh,e:Lh,k:Fh,h:Gh,g:Vh,d:jh,da:Hh,ea:Kh,fa:Zh,ba:ts,ca:is,N:rs,xa:Yh,ua:em,i:tm,C:im,G:rm,ta:Xh,x:am,ra:nm,U:sm,q:Qh,y:om,K:um,S:lm,za:dm,ya:pm,ka:os,la:us,_:st,B:ls,I:ds,ha:ps,H:cs,a:v,wa:ai}}}class ii{constructor(l){Es(this,"name","ExitStatus");this.message=`Program terminated with exit(${l})`,this.status=l}}var Ei=n=>{n.terminate(),n.onmessage=()=>{}},ri=[],Ii=n=>{Ye.length==0&&(Sn(),Tn(Ye[0]));var l=Ye.pop();if(!l)return 6;ni.push(l),Et[n.Bb]=l,l.Bb=n.Bb;var c={Db:"run",hc:n.fc,Jb:n.Jb,Bb:n.Bb};return l.postMessage(c,n.Nb),0},nt=0,Te=(n,l,...c)=>{for(var h=2*c.length,y=Ir(),S=Er(8*h),z=S>>>3,R=0;R<c.length;R++){var q=c[R];typeof q=="bigint"?(F[z+2*R]=1n,F[z+2*R+1]=q):(F[z+2*R]=0n,ce()[z+2*R+1>>>0]=q)}return n=_s(n,0,h,S,l),Ui(y),n};function ai(n){if(u)return Te(0,1,n);if(k=n,!(0<nt)){for(var l of ni)Ei(l);for(l of Ye)Ei(l);Ye=[],ni=[],Et={},j=!0}b(0,new ii(n))}function dt(n){if(u)return Te(1,0,n);st(n)}var st=n=>{if(k=n,u)throw dt(n),"unwind";ai(n)},Ye=[],ni=[],$n=[],Et={},vn=n=>{var l=n.Bb;delete Et[l],Ye.push(n),ni.splice(ni.indexOf(n),1),n.Bb=0,ys(l)};function xn(){$n.forEach(n=>n())}var Tn=n=>new Promise(l=>{n.onmessage=y=>{var S=(y=y.data).Db;if(y.Hb&&y.Hb!=Sr()){var z=Et[y.Hb];z?z.postMessage(y,y.Nb):re(`Internal error! Worker sent a message "${S}" to target pthread ${y.Hb}, but that thread no longer exists!`)}else S==="checkMailbox"?zi():S==="spawnThread"?Ii(y):S==="cleanupThread"?vn(Et[y.ic]):S==="loaded"?(n.loaded=!0,l(n)):y.target==="setimmediate"?n.postMessage(y):S==="callHandler"?i[y.Rb](...y.args):S&&re(`worker sent an unknown command ${S}`)},n.onerror=y=>{throw re(`worker sent an error! ${y.filename}:${y.lineno}: ${y.message}`),y};var c,h=[];for(c of[])i.propertyIsEnumerable(c)&&h.push(c);n.postMessage({Db:"load",Sb:h,kc:v,lc:w})});function Sn(){var n=new Worker((()=>{let l=URL;return void 0>"file:"&&void 0<"file;"?new l("ort.bundle.min.mjs",void 0):new URL(void 0)})(),{type:"module",workerData:"em-pthread",name:"em-pthread"});Ye.push(n)}var Zf=n=>{ye();var l=Q()[n+52>>>2>>>0];n=Q()[n+56>>>2>>>0],$s(l,l-n),Ui(l)},Qf=(n,l)=>{nt=0,n=vs(n,l),0<nt?k=n:kr(n)};class Yf{constructor(l){this.Ib=l-24}}function Xf(n,l,c){var h=new Yf(n>>>=0);throw l>>>=0,c>>>=0,Q()[h.Ib+16>>>2>>>0]=0,Q()[h.Ib+4>>>2>>>0]=l,Q()[h.Ib+8>>>2>>>0]=c,n}function Cn(n,l,c,h){return u?Te(2,1,n,l,c,h):kn(n,l,c,h)}function kn(n,l,c,h){if(n>>>=0,c>>>=0,h>>>=0,d===void 0)return 6;var y=[];return u&&y.length===0?Cn(n,l>>>=0,c,h):(n={fc:c,Bb:n,Jb:h,Nb:y},u?(n.Db="spawnThread",postMessage(n,y),0):Ii(n))}var En=typeof TextDecoder<"u"?new TextDecoder:void 0,In=(n,l=0,c=NaN)=>{var h=(l>>>=0)+c;for(c=l;n[c]&&!(c>=h);)++c;if(16<c-l&&n.buffer&&En)return En.decode(n.buffer instanceof ArrayBuffer?n.subarray(l,c):n.slice(l,c));for(h="";l<c;){var y=n[l++];if(128&y){var S=63&n[l++];if((224&y)==192)h+=String.fromCharCode((31&y)<<6|S);else{var z=63&n[l++];65536>(y=(240&y)==224?(15&y)<<12|S<<6|z:(7&y)<<18|S<<12|z<<6|63&n[l++])?h+=String.fromCharCode(y):(y-=65536,h+=String.fromCharCode(55296|y>>10,56320|1023&y))}}else h+=String.fromCharCode(y)}return h},Ie=(n,l)=>(n>>>=0)?In(M(),n,l):"";function zn(n,l,c){return u?Te(3,1,n,l,c):0}function An(n,l){if(u)return Te(4,1,n,l)}function On(n,l){if(u)return Te(5,1,n,l)}function Rn(n,l,c){if(u)return Te(6,1,n,l,c)}function Nn(n,l,c){return u?Te(7,1,n,l,c):0}function Mn(n,l){if(u)return Te(8,1,n,l)}function Bn(n,l,c){if(u)return Te(9,1,n,l,c)}function Dn(n,l,c,h){if(u)return Te(10,1,n,l,c,h)}function Pn(n,l,c,h){if(u)return Te(11,1,n,l,c,h)}function Un(n,l,c,h){if(u)return Te(12,1,n,l,c,h)}function qn(n){if(u)return Te(13,1,n)}function Wn(n,l){if(u)return Te(14,1,n,l)}function Ln(n,l,c){if(u)return Te(15,1,n,l,c)}var Fn,Jf=()=>he(""),ot=n=>{for(var l="";M()[n>>>0];)l+=Fn[M()[n++>>>0]];return l},pr={},cr={},eh={},Ht=i.BindingError=class extends Error{constructor(n){super(n),this.name="BindingError"}};function pt(n,l,c={}){return(function(h,y,S={}){var z=y.name;if(!h)throw new Ht(`type "${z}" must have a positive integer typeid pointer`);if(cr.hasOwnProperty(h)){if(S.Tb)return;throw new Ht(`Cannot register type '${z}' twice`)}cr[h]=y,delete eh[h],pr.hasOwnProperty(h)&&(y=pr[h],delete pr[h],y.forEach(R=>R()))})(n,l,c)}var Gn=(n,l,c)=>{switch(l){case 1:return c?h=>N()[h>>>0]:h=>M()[h>>>0];case 2:return c?h=>Y()[h>>>1>>>0]:h=>pe()[h>>>1>>>0];case 4:return c?h=>B()[h>>>2>>>0]:h=>Q()[h>>>2>>>0];case 8:return c?h=>F[h>>>3]:h=>H[h>>>3];default:throw new TypeError(`invalid integer width (${l}): ${n}`)}};function th(n,l,c){c>>>=0,pt(n>>>=0,{name:l=ot(l>>>0),fromWireType:h=>h,toWireType:function(h,y){if(typeof y!="bigint"&&typeof y!="number")throw y=y===null?"null":(h=typeof y)=="object"||h==="array"||h==="function"?y.toString():""+y,new TypeError(`Cannot convert "${y}" to ${this.name}`);return typeof y=="number"&&(y=BigInt(y)),y},Cb:yt,readValueFromPointer:Gn(l,c,l.indexOf("u")==-1),Eb:null})}var yt=8;function ih(n,l,c,h){pt(n>>>=0,{name:l=ot(l>>>0),fromWireType:function(y){return!!y},toWireType:function(y,S){return S?c:h},Cb:yt,readValueFromPointer:function(y){return this.fromWireType(M()[y>>>0])},Eb:null})}var fr=[],ct=[];function hr(n){9<(n>>>=0)&&--ct[n+1]==0&&(ct[n]=void 0,fr.push(n))}var Be=n=>{if(!n)throw new Ht(`Cannot use deleted val. handle = ${n}`);return ct[n]},je=n=>{switch(n){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let l=fr.pop()||ct.length;return ct[l]=n,ct[l+1]=1,l}};function mr(n){return this.fromWireType(Q()[n>>>2>>>0])}var rh={name:"emscripten::val",fromWireType:n=>{var l=Be(n);return hr(n),l},toWireType:(n,l)=>je(l),Cb:yt,readValueFromPointer:mr,Eb:null};function ah(n){return pt(n>>>0,rh)}var nh=(n,l)=>{switch(l){case 4:return function(c){return this.fromWireType(Se()[c>>>2>>>0])};case 8:return function(c){return this.fromWireType(ce()[c>>>3>>>0])};default:throw new TypeError(`invalid float width (${l}): ${n}`)}};function sh(n,l,c){c>>>=0,pt(n>>>=0,{name:l=ot(l>>>0),fromWireType:h=>h,toWireType:(h,y)=>y,Cb:yt,readValueFromPointer:nh(l,c),Eb:null})}function oh(n,l,c,h,y){if(n>>>=0,c>>>=0,l=ot(l>>>0),y===-1&&(y=4294967295),y=R=>R,h===0){var S=32-8*c;y=R=>R<<S>>>S}var z=l.includes("unsigned")?function(R,q){return q>>>0}:function(R,q){return q};pt(n,{name:l,fromWireType:y,toWireType:z,Cb:yt,readValueFromPointer:Gn(l,c,h!==0),Eb:null})}function uh(n,l,c){function h(S){var z=Q()[S>>>2>>>0];return S=Q()[S+4>>>2>>>0],new y(N().buffer,S,z)}var y=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][l];pt(n>>>=0,{name:c=ot(c>>>0),fromWireType:h,Cb:yt,readValueFromPointer:h},{Tb:!0})}var It=(n,l,c)=>{var h=M();if(l>>>=0,0<c){var y=l;c=l+c-1;for(var S=0;S<n.length;++S){var z=n.charCodeAt(S);if(55296<=z&&57343>=z&&(z=65536+((1023&z)<<10)|1023&n.charCodeAt(++S)),127>=z){if(l>=c)break;h[l++>>>0]=z}else{if(2047>=z){if(l+1>=c)break;h[l++>>>0]=192|z>>6}else{if(65535>=z){if(l+2>=c)break;h[l++>>>0]=224|z>>12}else{if(l+3>=c)break;h[l++>>>0]=240|z>>18,h[l++>>>0]=128|z>>12&63}h[l++>>>0]=128|z>>6&63}h[l++>>>0]=128|63&z}}h[l>>>0]=0,n=l-y}else n=0;return n},gr=n=>{for(var l=0,c=0;c<n.length;++c){var h=n.charCodeAt(c);127>=h?l++:2047>=h?l+=2:55296<=h&&57343>=h?(l+=4,++c):l+=3}return l};function lh(n,l){pt(n>>>=0,{name:l=ot(l>>>0),fromWireType:function(c){for(var h,y=Q()[c>>>2>>>0],S=c+4,z=S,R=0;R<=y;++R){var q=S+R;R!=y&&M()[q>>>0]!=0||(z=Ie(z,q-z),h===void 0?h=z:(h+="\0",h+=z),z=q+1)}return ft(c),h},toWireType:function(c,h){h instanceof ArrayBuffer&&(h=new Uint8Array(h));var y=typeof h=="string";if(!(y||ArrayBuffer.isView(h)&&h.BYTES_PER_ELEMENT==1))throw new Ht("Cannot pass non-string to std::string");var S=y?gr(h):h.length,z=Pi(4+S+1),R=z+4;return Q()[z>>>2>>>0]=S,y?It(h,R,S+1):M().set(h,R>>>0),c!==null&&c.push(ft,z),z},Cb:yt,readValueFromPointer:mr,Eb(c){ft(c)}})}var Vn=typeof TextDecoder<"u"?new TextDecoder("utf-16le"):void 0,dh=(n,l)=>{for(var c=n>>1,h=c+l/2;!(c>=h)&&pe()[c>>>0];)++c;if(32<(c<<=1)-n&&Vn)return Vn.decode(M().slice(n,c));for(c="",h=0;!(h>=l/2);++h){var y=Y()[n+2*h>>>1>>>0];if(y==0)break;c+=String.fromCharCode(y)}return c},ph=(n,l,c)=>{if(c??(c=2147483647),2>c)return 0;var h=l;c=(c-=2)<2*n.length?c/2:n.length;for(var y=0;y<c;++y){var S=n.charCodeAt(y);Y()[l>>>1>>>0]=S,l+=2}return Y()[l>>>1>>>0]=0,l-h},ch=n=>2*n.length,fh=(n,l)=>{for(var c=0,h="";!(c>=l/4);){var y=B()[n+4*c>>>2>>>0];if(y==0)break;++c,65536<=y?(y-=65536,h+=String.fromCharCode(55296|y>>10,56320|1023&y)):h+=String.fromCharCode(y)}return h},hh=(n,l,c)=>{if(l>>>=0,c??(c=2147483647),4>c)return 0;var h=l;c=h+c-4;for(var y=0;y<n.length;++y){var S=n.charCodeAt(y);if(55296<=S&&57343>=S&&(S=65536+((1023&S)<<10)|1023&n.charCodeAt(++y)),B()[l>>>2>>>0]=S,(l+=4)+4>c)break}return B()[l>>>2>>>0]=0,l-h},mh=n=>{for(var l=0,c=0;c<n.length;++c){var h=n.charCodeAt(c);55296<=h&&57343>=h&&++c,l+=4}return l};function gh(n,l,c){if(n>>>=0,l>>>=0,c=ot(c>>>=0),l===2)var h=dh,y=ph,S=ch,z=R=>pe()[R>>>1>>>0];else l===4&&(h=fh,y=hh,S=mh,z=R=>Q()[R>>>2>>>0]);pt(n,{name:c,fromWireType:R=>{for(var q,G=Q()[R>>>2>>>0],J=R+4,ne=0;ne<=G;++ne){var de=R+4+ne*l;ne!=G&&z(de)!=0||(J=h(J,de-J),q===void 0?q=J:(q+="\0",q+=J),J=de+l)}return ft(R),q},toWireType:(R,q)=>{if(typeof q!="string")throw new Ht(`Cannot pass non-string to C++ string type ${c}`);var G=S(q),J=Pi(4+G+l);return Q()[J>>>2>>>0]=G/l,y(q,J+4,G+l),R!==null&&R.push(ft,J),J},Cb:yt,readValueFromPointer:mr,Eb(R){ft(R)}})}function _h(n,l){pt(n>>>=0,{Ub:!0,name:l=ot(l>>>0),Cb:0,fromWireType:()=>{},toWireType:()=>{}})}function yh(n){Cr(n>>>0,!o,1,!s,131072,!1),xn()}var _r=n=>{if(!j)try{if(n(),!(0<nt))try{u?kr(k):st(k)}catch(l){l instanceof ii||l=="unwind"||b(0,l)}}catch(l){l instanceof ii||l=="unwind"||b(0,l)}};function yr(n){n>>>=0,typeof Atomics.jc=="function"&&(Atomics.jc(B(),n>>>2,n).value.then(zi),n+=128,Atomics.store(B(),n>>>2,1))}var zi=()=>{var n=Sr();n&&(yr(n),_r(ws))};function bh(n,l){(n>>>=0)==l>>>0?setTimeout(zi):u?postMessage({Hb:n,Db:"checkMailbox"}):(n=Et[n])&&n.postMessage({Db:"checkMailbox"})}var br=[];function wh(n,l,c,h,y){for(l>>>=0,h/=2,br.length=h,c=y>>>0>>>3,y=0;y<h;y++)br[y]=F[c+2*y]?F[c+2*y+1]:ce()[c+2*y+1>>>0];return(l?Tr[l]:fm[n])(...br)}var $h=()=>{nt=0};function vh(n){n>>>=0,u?postMessage({Db:"cleanupThread",ic:n}):vn(Et[n])}function xh(n){}var Ai=(n,l)=>{var c=cr[n];if(c===void 0)throw n=hs(n),c=ot(n),ft(n),new Ht(`${l} has unknown type ${c}`);return c},jn=(n,l,c)=>{var h=[];return n=n.toWireType(h,c),h.length&&(Q()[l>>>2>>>0]=je(h)),n};function Th(n,l,c){return l>>>=0,c>>>=0,n=Be(n>>>0),l=Ai(l,"emval::as"),jn(l,c,n)}function Sh(n,l){return l>>>=0,n=Be(n>>>0),(l=Ai(l,"emval::as")).toWireType(null,n)}var Oi=n=>{try{n()}catch(l){he(l)}},bt=0,ut=null,Hn=0,Ri=[],Kn={},Zn={},Ch=0,wr=null,kh=[];function Qn(n){return(function(l){if(!j){if(bt===0){var c=!1,h=!1;l((y=0)=>{if(!j&&(Hn=y,c=!0,h)){bt=2,Oi(()=>Ss(ut)),typeof MainLoop<"u"&&MainLoop.Qb&&MainLoop.resume(),y=!1;try{var S=(function(){var q=B()[ut+8>>>2>>>0];return q=D[Zn[q]],--nt,q()})()}catch(q){S=q,y=!0}var z=!1;if(!ut){var R=wr;R&&(wr=null,(y?R.reject:R.resolve)(S),z=!0)}if(y&&!z)throw S}}),h=!0,c||(bt=1,ut=(function(){var y=Pi(65548),S=y+12;Q()[y>>>2>>>0]=S,Q()[y+4>>>2>>>0]=S+65536,S=Ri[0];var z=Kn[S];return z===void 0&&(z=Ch++,Kn[S]=z,Zn[z]=S),S=z,B()[y+8>>>2>>>0]=S,y})(),typeof MainLoop<"u"&&MainLoop.Qb&&MainLoop.pause(),Oi(()=>xs(ut)))}else bt===2?(bt=0,Oi(Cs),ft(ut),ut=null,kh.forEach(_r)):he(`invalid state: ${bt}`);return Hn}})(l=>{n().then(l)})}function Eh(n){return n>>>=0,Qn(async()=>{var l=await Be(n);return je(l)})}var Ni=[];function Ih(n,l,c,h){return c>>>=0,h>>>=0,(n=Ni[n>>>0])(null,l=Be(l>>>0),c,h)}var zh={},Mi=n=>{var l=zh[n];return l===void 0?ot(n):l};function Ah(n,l,c,h,y){return c>>>=0,h>>>=0,y>>>=0,(n=Ni[n>>>0])(l=Be(l>>>0),l[c=Mi(c)],h,y)}function Oh(n,l){return l>>>=0,(n=Be(n>>>0))==Be(l)}var Yn=()=>typeof globalThis=="object"?globalThis:Function("return this")();function Rh(n){return(n>>>=0)==0?je(Yn()):(n=Mi(n),je(Yn()[n]))}var Nh=n=>{var l=Ni.length;return Ni.push(n),l},Mh=(n,l)=>{for(var c=Array(n),h=0;h<n;++h)c[h]=Ai(Q()[l+4*h>>>2>>>0],`parameter ${h}`);return c};function Bh(n,l,c){var h=(l=Mh(n,l>>>0)).shift();n--;var y=`return function (obj, func, destructorsRef, args) {
`,S=0,z=[];c===0&&z.push("obj");for(var R=["retType"],q=[h],G=0;G<n;++G)z.push(`arg${G}`),R.push(`argType${G}`),q.push(l[G]),y+=`  var arg${G} = argType${G}.readValueFromPointer(args${S?"+"+S:""});
`,S+=l[G].Cb;return y+=`  var rv = ${c===1?"new func":"func.call"}(${z.join(", ")});
`,h.Ub||(R.push("emval_returnValue"),q.push(jn),y+=`  return emval_returnValue(retType, destructorsRef, rv);
`),n=new Function(...R,y+`};
`)(...q),c=`methodCaller<(${l.map(J=>J.name).join(", ")}) => ${h.name}>`,Nh(Object.defineProperty(n,"name",{value:c}))}function Dh(n){return n=Mi(n>>>0),je(i[n])}function Ph(n,l){return l>>>=0,n=Be(n>>>0),l=Be(l),je(n[l])}function Uh(n){9<(n>>>=0)&&(ct[n+1]+=1)}function qh(){return je([])}function Wh(n){n=Be(n>>>0);for(var l=Array(n.length),c=0;c<n.length;c++)l[c]=n[c];return je(l)}function Lh(n){return je(Mi(n>>>0))}function Fh(){return je({})}function Gh(n){for(var l=Be(n>>>=0);l.length;){var c=l.pop();l.pop()(c)}hr(n)}function Vh(n,l,c){l>>>=0,c>>>=0,n=Be(n>>>0),l=Be(l),c=Be(c),n[l]=c}function jh(n,l){return l>>>=0,n=(n=Ai(n>>>0,"_emval_take_value")).readValueFromPointer(l),je(n)}function Hh(n,l){n=-9007199254740992>n||9007199254740992<n?NaN:Number(n),l>>>=0,n=new Date(1e3*n),B()[l>>>2>>>0]=n.getUTCSeconds(),B()[l+4>>>2>>>0]=n.getUTCMinutes(),B()[l+8>>>2>>>0]=n.getUTCHours(),B()[l+12>>>2>>>0]=n.getUTCDate(),B()[l+16>>>2>>>0]=n.getUTCMonth(),B()[l+20>>>2>>>0]=n.getUTCFullYear()-1900,B()[l+24>>>2>>>0]=n.getUTCDay(),n=(n.getTime()-Date.UTC(n.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,B()[l+28>>>2>>>0]=n}var Xn=n=>n%4==0&&(n%100!=0||n%400==0),Jn=[0,31,60,91,121,152,182,213,244,274,305,335],es=[0,31,59,90,120,151,181,212,243,273,304,334];function Kh(n,l){n=-9007199254740992>n||9007199254740992<n?NaN:Number(n),l>>>=0,n=new Date(1e3*n),B()[l>>>2>>>0]=n.getSeconds(),B()[l+4>>>2>>>0]=n.getMinutes(),B()[l+8>>>2>>>0]=n.getHours(),B()[l+12>>>2>>>0]=n.getDate(),B()[l+16>>>2>>>0]=n.getMonth(),B()[l+20>>>2>>>0]=n.getFullYear()-1900,B()[l+24>>>2>>>0]=n.getDay();var c=(Xn(n.getFullYear())?Jn:es)[n.getMonth()]+n.getDate()-1|0;B()[l+28>>>2>>>0]=c,B()[l+36>>>2>>>0]=-60*n.getTimezoneOffset(),c=new Date(n.getFullYear(),6,1).getTimezoneOffset();var h=new Date(n.getFullYear(),0,1).getTimezoneOffset();n=0|(c!=h&&n.getTimezoneOffset()==Math.min(h,c)),B()[l+32>>>2>>>0]=n}function Zh(n){n>>>=0;var l=new Date(B()[n+20>>>2>>>0]+1900,B()[n+16>>>2>>>0],B()[n+12>>>2>>>0],B()[n+8>>>2>>>0],B()[n+4>>>2>>>0],B()[n>>>2>>>0],0),c=B()[n+32>>>2>>>0],h=l.getTimezoneOffset(),y=new Date(l.getFullYear(),6,1).getTimezoneOffset(),S=new Date(l.getFullYear(),0,1).getTimezoneOffset(),z=Math.min(S,y);return 0>c?B()[n+32>>>2>>>0]=+(y!=S&&z==h):0<c!=(z==h)&&(y=Math.max(S,y),l.setTime(l.getTime()+6e4*((0<c?z:y)-h))),B()[n+24>>>2>>>0]=l.getDay(),c=(Xn(l.getFullYear())?Jn:es)[l.getMonth()]+l.getDate()-1|0,B()[n+28>>>2>>>0]=c,B()[n>>>2>>>0]=l.getSeconds(),B()[n+4>>>2>>>0]=l.getMinutes(),B()[n+8>>>2>>>0]=l.getHours(),B()[n+12>>>2>>>0]=l.getDate(),B()[n+16>>>2>>>0]=l.getMonth(),B()[n+20>>>2>>>0]=l.getYear(),n=l.getTime(),BigInt(isNaN(n)?-1:n/1e3)}function ts(n,l,c,h,y,S,z){return u?Te(16,1,n,l,c,h,y,S,z):-52}function is(n,l,c,h,y,S){if(u)return Te(17,1,n,l,c,h,y,S)}var si={},Qh=()=>performance.timeOrigin+performance.now();function rs(n,l){if(u)return Te(18,1,n,l);if(si[n]&&(clearTimeout(si[n].id),delete si[n]),!l)return 0;var c=setTimeout(()=>{delete si[n],_r(()=>bs(n,performance.timeOrigin+performance.now()))},l);return si[n]={id:c,rc:l},0}function Yh(n,l,c,h){n>>>=0,l>>>=0,c>>>=0,h>>>=0;var y=new Date().getFullYear(),S=new Date(y,0,1).getTimezoneOffset();y=new Date(y,6,1).getTimezoneOffset();var z=Math.max(S,y);Q()[n>>>2>>>0]=60*z,B()[l>>>2>>>0]=+(S!=y),n=(l=R=>{var q=Math.abs(R);return`UTC${0<=R?"-":"+"}${String(Math.floor(q/60)).padStart(2,"0")}${String(q%60).padStart(2,"0")}`})(S),l=l(y),y<S?(It(n,c,17),It(l,h,17)):(It(n,h,17),It(l,c,17))}var Xh=()=>Date.now(),Jh=1;function em(n,l,c){if(!(0<=n&&3>=n))return 28;if(n===0)n=Date.now();else{if(!Jh)return 52;n=performance.timeOrigin+performance.now()}return F[c>>>0>>>3]=BigInt(Math.round(1e6*n)),0}var $r=[],as=(n,l)=>{$r.length=0;for(var c;c=M()[n++>>>0];){var h=c!=105;l+=(h&=c!=112)&&l%8?4:0,$r.push(c==112?Q()[l>>>2>>>0]:c==106?F[l>>>3]:c==105?B()[l>>>2>>>0]:ce()[l>>>3>>>0]),l+=h?8:4}return $r};function tm(n,l,c){return n>>>=0,l=as(l>>>0,c>>>0),Tr[n](...l)}function im(n,l,c){return n>>>=0,l=as(l>>>0,c>>>0),Tr[n](...l)}var rm=()=>{};function am(n,l){return re(Ie(n>>>0,l>>>0))}var nm=()=>{throw nt+=1,"unwind"};function sm(){return 4294901760}var om=()=>navigator.hardwareConcurrency;function um(){return he("Cannot use emscripten_pc_get_function without -sUSE_OFFSET_CONVERTER"),0}function lm(n){n>>>=0;var l=M().length;if(n<=l||4294901760<n)return!1;for(var c=1;4>=c;c*=2){var h=l*(1+.2/c);h=Math.min(h,n+100663296);e:{h=(Math.min(4294901760,65536*Math.ceil(Math.max(n,h)/65536))-v.buffer.byteLength+65535)/65536|0;try{v.grow(h),ye();var y=1;break e}catch{}y=void 0}if(y)return!0}return!1}var Bi=()=>(he("Cannot use convertFrameToPC (needed by __builtin_return_address) without -sUSE_OFFSET_CONVERTER"),0),Kt={},ns=n=>{n.forEach(l=>{var c=Bi();c&&(Kt[c]=l)})};function dm(){var n=Error().stack.toString().split(`
`);return n[0]=="Error"&&n.shift(),ns(n),Kt.Mb=Bi(),Kt.dc=n,Kt.Mb}function pm(n,l,c){if(n>>>=0,l>>>=0,Kt.Mb==n)var h=Kt.dc;else(h=Error().stack.toString().split(`
`))[0]=="Error"&&h.shift(),ns(h);for(var y=3;h[y]&&Bi()!=n;)++y;for(n=0;n<c&&h[n+y];++n)B()[l+4*n>>>2>>>0]=Bi();return n}var vr,xr={},ss=()=>{if(!vr){var n,l={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(typeof navigator=="object"&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:"./this.program"};for(n in xr)xr[n]===void 0?delete l[n]:l[n]=xr[n];var c=[];for(n in l)c.push(`${n}=${l[n]}`);vr=c}return vr};function os(n,l){if(u)return Te(19,1,n,l);n>>>=0,l>>>=0;var c,h=0,y=0;for(c of ss()){var S=l+h;Q()[n+y>>>2>>>0]=S,h+=It(c,S,1/0)+1,y+=4}return 0}function us(n,l){if(u)return Te(20,1,n,l);n>>>=0,l>>>=0;var c=ss();for(var h of(Q()[n>>>2>>>0]=c.length,n=0,c))n+=gr(h)+1;return Q()[l>>>2>>>0]=n,0}function ls(n){return u?Te(21,1,n):52}function ds(n,l,c,h){return u?Te(22,1,n,l,c,h):52}function ps(n,l,c,h){return u?Te(23,1,n,l,c,h):70}var cm=[null,[],[]];function cs(n,l,c,h){if(u)return Te(24,1,n,l,c,h);l>>>=0,c>>>=0,h>>>=0;for(var y=0,S=0;S<c;S++){var z=Q()[l>>>2>>>0],R=Q()[l+4>>>2>>>0];l+=8;for(var q=0;q<R;q++){var G=n,J=M()[z+q>>>0],ne=cm[G];J===0||J===10?((G===1?K:re)(In(ne)),ne.length=0):ne.push(J)}y+=R}return Q()[h>>>2>>>0]=y,0}u||(function(){for(var n=i.numThreads-1;n--;)Sn();ri.push(()=>{Ve++,(function(l){u?l():Promise.all(Ye.map(Tn)).then(l)})(()=>jt())})})();for(var fs=Array(256),Di=0;256>Di;++Di)fs[Di]=String.fromCharCode(Di);Fn=fs,ct.push(0,1,void 0,1,null,1,!0,1,!1,1),i.count_emval_handles=()=>ct.length/2-5-fr.length,u||(v=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),ye()),i.wasmBinary&&(x=i.wasmBinary),i.stackSave=()=>Ir(),i.stackRestore=n=>Ui(n),i.stackAlloc=n=>Er(n),i.setValue=function(n,l,c="i8"){switch(c.endsWith("*")&&(c="*"),c){case"i1":case"i8":N()[n>>>0]=l;break;case"i16":Y()[n>>>1>>>0]=l;break;case"i32":B()[n>>>2>>>0]=l;break;case"i64":F[n>>>3]=BigInt(l);break;case"float":Se()[n>>>2>>>0]=l;break;case"double":ce()[n>>>3>>>0]=l;break;case"*":Q()[n>>>2>>>0]=l;break;default:he(`invalid type for setValue: ${c}`)}},i.getValue=function(n,l="i8"){switch(l.endsWith("*")&&(l="*"),l){case"i1":case"i8":return N()[n>>>0];case"i16":return Y()[n>>>1>>>0];case"i32":return B()[n>>>2>>>0];case"i64":return F[n>>>3];case"float":return Se()[n>>>2>>>0];case"double":return ce()[n>>>3>>>0];case"*":return Q()[n>>>2>>>0];default:he(`invalid type for getValue: ${l}`)}},i.UTF8ToString=Ie,i.stringToUTF8=It,i.lengthBytesUTF8=gr;var fm=[ai,dt,Cn,zn,An,On,Rn,Nn,Mn,Bn,Dn,Pn,Un,qn,Wn,Ln,ts,is,rs,os,us,ls,ds,ps,cs],Tr={892060:(n,l,c,h,y)=>{if(i===void 0||!i.Fb)return 1;if((n=Ie(Number(n>>>0))).startsWith("./")&&(n=n.substring(2)),!(n=i.Fb.get(n)))return 2;if(l=Number(l>>>0),c=Number(c>>>0),h=Number(h>>>0),l+c>n.byteLength)return 3;try{let S=n.subarray(l,l+c);switch(y){case 0:M().set(S,h>>>0);break;case 1:i.mc?i.mc(h,S):i.cc(h,S);break;default:return 4}return 0}catch{return 4}},892884:(n,l,c)=>{i.Pb(n,M().subarray(l>>>0,l+c>>>0))},892948:()=>i.oc(),892990:n=>{i.Ob(n)},893027:()=>{i.Wb()},893058:()=>{i.Xb()},893087:()=>{i.ac()},893112:n=>i.Vb(n),893145:n=>i.Zb(n),893177:(n,l,c)=>{i.Lb(Number(n),Number(l),Number(c),!0)},893240:(n,l,c)=>{i.Lb(Number(n),Number(l),Number(c))},893297:()=>typeof wasmOffsetConverter<"u",893354:n=>{i.Ab("Abs",n,void 0)},893405:n=>{i.Ab("Neg",n,void 0)},893456:n=>{i.Ab("Floor",n,void 0)},893509:n=>{i.Ab("Ceil",n,void 0)},893561:n=>{i.Ab("Reciprocal",n,void 0)},893619:n=>{i.Ab("Sqrt",n,void 0)},893671:n=>{i.Ab("Exp",n,void 0)},893722:n=>{i.Ab("Erf",n,void 0)},893773:n=>{i.Ab("Sigmoid",n,void 0)},893828:(n,l,c)=>{i.Ab("HardSigmoid",n,{alpha:l,beta:c})},893907:n=>{i.Ab("Log",n,void 0)},893958:n=>{i.Ab("Sin",n,void 0)},894009:n=>{i.Ab("Cos",n,void 0)},894060:n=>{i.Ab("Tan",n,void 0)},894111:n=>{i.Ab("Asin",n,void 0)},894163:n=>{i.Ab("Acos",n,void 0)},894215:n=>{i.Ab("Atan",n,void 0)},894267:n=>{i.Ab("Sinh",n,void 0)},894319:n=>{i.Ab("Cosh",n,void 0)},894371:n=>{i.Ab("Asinh",n,void 0)},894424:n=>{i.Ab("Acosh",n,void 0)},894477:n=>{i.Ab("Atanh",n,void 0)},894530:n=>{i.Ab("Tanh",n,void 0)},894582:n=>{i.Ab("Not",n,void 0)},894633:(n,l,c)=>{i.Ab("Clip",n,{min:l,max:c})},894702:n=>{i.Ab("Clip",n,void 0)},894754:(n,l)=>{i.Ab("Elu",n,{alpha:l})},894812:n=>{i.Ab("Gelu",n,void 0)},894864:n=>{i.Ab("Relu",n,void 0)},894916:(n,l)=>{i.Ab("LeakyRelu",n,{alpha:l})},894980:(n,l)=>{i.Ab("ThresholdedRelu",n,{alpha:l})},895050:(n,l)=>{i.Ab("Cast",n,{to:l})},895108:n=>{i.Ab("Add",n,void 0)},895159:n=>{i.Ab("Sub",n,void 0)},895210:n=>{i.Ab("Mul",n,void 0)},895261:n=>{i.Ab("Div",n,void 0)},895312:n=>{i.Ab("Pow",n,void 0)},895363:n=>{i.Ab("Equal",n,void 0)},895416:n=>{i.Ab("Greater",n,void 0)},895471:n=>{i.Ab("GreaterOrEqual",n,void 0)},895533:n=>{i.Ab("Less",n,void 0)},895585:n=>{i.Ab("LessOrEqual",n,void 0)},895644:(n,l,c,h,y)=>{i.Ab("ReduceMean",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},895819:(n,l,c,h,y)=>{i.Ab("ReduceMax",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},895993:(n,l,c,h,y)=>{i.Ab("ReduceMin",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},896167:(n,l,c,h,y)=>{i.Ab("ReduceProd",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},896342:(n,l,c,h,y)=>{i.Ab("ReduceSum",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},896516:(n,l,c,h,y)=>{i.Ab("ReduceL1",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},896689:(n,l,c,h,y)=>{i.Ab("ReduceL2",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},896862:(n,l,c,h,y)=>{i.Ab("ReduceLogSum",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},897039:(n,l,c,h,y)=>{i.Ab("ReduceSumSquare",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},897219:(n,l,c,h,y)=>{i.Ab("ReduceLogSumExp",n,{keepDims:!!l,noopWithEmptyAxes:!!c,axes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},897399:n=>{i.Ab("Where",n,void 0)},897452:(n,l,c)=>{i.Ab("Transpose",n,{perm:l?Array.from(B().subarray(Number(l)>>>0,Number(c)>>>0)):[]})},897576:(n,l,c,h)=>{i.Ab("DepthToSpace",n,{blocksize:l,mode:Ie(c),format:h?"NHWC":"NCHW"})},897709:(n,l,c,h)=>{i.Ab("DepthToSpace",n,{blocksize:l,mode:Ie(c),format:h?"NHWC":"NCHW"})},897842:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze)=>{i.Ab("ConvTranspose",n,{format:q?"NHWC":"NCHW",autoPad:l,dilations:[c],group:h,kernelShape:[y],pads:[S,z],strides:[R],wIsConst:()=>!!N()[G>>>0],outputPadding:J?Array.from(B().subarray(Number(J)>>>0,Number(ne)>>>0)):[],outputShape:de?Array.from(B().subarray(Number(de)>>>0,Number(be)>>>0)):[],activation:Ie(ze)})},898275:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("ConvTranspose",n,{format:R?"NHWC":"NCHW",autoPad:l,dilations:Array.from(B().subarray(Number(c)>>>0,2+(Number(c)>>>0)>>>0)),group:h,kernelShape:Array.from(B().subarray(Number(y)>>>0,2+(Number(y)>>>0)>>>0)),pads:Array.from(B().subarray(Number(S)>>>0,4+(Number(S)>>>0)>>>0)),strides:Array.from(B().subarray(Number(z)>>>0,2+(Number(z)>>>0)>>>0)),wIsConst:()=>!!N()[q>>>0],outputPadding:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],outputShape:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[],activation:Ie(be)})},898936:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze)=>{i.Ab("ConvTranspose",n,{format:q?"NHWC":"NCHW",autoPad:l,dilations:[c],group:h,kernelShape:[y],pads:[S,z],strides:[R],wIsConst:()=>!!N()[G>>>0],outputPadding:J?Array.from(B().subarray(Number(J)>>>0,Number(ne)>>>0)):[],outputShape:de?Array.from(B().subarray(Number(de)>>>0,Number(be)>>>0)):[],activation:Ie(ze)})},899369:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("ConvTranspose",n,{format:R?"NHWC":"NCHW",autoPad:l,dilations:Array.from(B().subarray(Number(c)>>>0,2+(Number(c)>>>0)>>>0)),group:h,kernelShape:Array.from(B().subarray(Number(y)>>>0,2+(Number(y)>>>0)>>>0)),pads:Array.from(B().subarray(Number(S)>>>0,4+(Number(S)>>>0)>>>0)),strides:Array.from(B().subarray(Number(z)>>>0,2+(Number(z)>>>0)>>>0)),wIsConst:()=>!!N()[q>>>0],outputPadding:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],outputShape:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[],activation:Ie(be)})},900030:(n,l)=>{i.Ab("GlobalAveragePool",n,{format:l?"NHWC":"NCHW"})},900121:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("AveragePool",n,{format:be?"NHWC":"NCHW",auto_pad:l,ceil_mode:c,count_include_pad:h,storage_order:y,dilations:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[],kernel_shape:R?Array.from(B().subarray(Number(R)>>>0,Number(q)>>>0)):[],pads:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],strides:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[]})},900600:(n,l)=>{i.Ab("GlobalAveragePool",n,{format:l?"NHWC":"NCHW"})},900691:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("AveragePool",n,{format:be?"NHWC":"NCHW",auto_pad:l,ceil_mode:c,count_include_pad:h,storage_order:y,dilations:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[],kernel_shape:R?Array.from(B().subarray(Number(R)>>>0,Number(q)>>>0)):[],pads:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],strides:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[]})},901170:(n,l)=>{i.Ab("GlobalMaxPool",n,{format:l?"NHWC":"NCHW"})},901257:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("MaxPool",n,{format:be?"NHWC":"NCHW",auto_pad:l,ceil_mode:c,count_include_pad:h,storage_order:y,dilations:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[],kernel_shape:R?Array.from(B().subarray(Number(R)>>>0,Number(q)>>>0)):[],pads:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],strides:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[]})},901732:(n,l)=>{i.Ab("GlobalMaxPool",n,{format:l?"NHWC":"NCHW"})},901819:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>{i.Ab("MaxPool",n,{format:be?"NHWC":"NCHW",auto_pad:l,ceil_mode:c,count_include_pad:h,storage_order:y,dilations:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[],kernel_shape:R?Array.from(B().subarray(Number(R)>>>0,Number(q)>>>0)):[],pads:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],strides:ne?Array.from(B().subarray(Number(ne)>>>0,Number(de)>>>0)):[]})},902294:(n,l,c,h,y)=>{i.Ab("Gemm",n,{alpha:l,beta:c,transA:h,transB:y})},902398:n=>{i.Ab("MatMul",n,void 0)},902452:(n,l,c,h)=>{i.Ab("ArgMax",n,{keepDims:!!l,selectLastIndex:!!c,axis:h})},902560:(n,l,c,h)=>{i.Ab("ArgMin",n,{keepDims:!!l,selectLastIndex:!!c,axis:h})},902668:(n,l)=>{i.Ab("Softmax",n,{axis:l})},902731:(n,l)=>{i.Ab("Concat",n,{axis:l})},902791:(n,l,c,h,y)=>{i.Ab("Split",n,{axis:l,numOutputs:c,splitSizes:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},902947:n=>{i.Ab("Expand",n,void 0)},903001:(n,l)=>{i.Ab("Gather",n,{axis:Number(l)})},903072:(n,l)=>{i.Ab("GatherElements",n,{axis:Number(l)})},903151:(n,l)=>{i.Ab("GatherND",n,{batch_dims:Number(l)})},903230:(n,l,c,h,y,S,z,R,q,G,J)=>{i.Ab("Resize",n,{antialias:l,axes:c?Array.from(B().subarray(Number(c)>>>0,Number(h)>>>0)):[],coordinateTransformMode:Ie(y),cubicCoeffA:S,excludeOutside:z,extrapolationValue:R,keepAspectRatioPolicy:Ie(q),mode:Ie(G),nearestMode:Ie(J)})},903592:(n,l,c,h,y,S,z)=>{i.Ab("Slice",n,{starts:l?Array.from(B().subarray(Number(l)>>>0,Number(c)>>>0)):[],ends:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[],axes:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[]})},903856:n=>{i.Ab("Tile",n,void 0)},903908:(n,l,c)=>{i.Ab("InstanceNormalization",n,{epsilon:l,format:c?"NHWC":"NCHW"})},904022:(n,l,c)=>{i.Ab("InstanceNormalization",n,{epsilon:l,format:c?"NHWC":"NCHW"})},904136:n=>{i.Ab("Range",n,void 0)},904189:(n,l)=>{i.Ab("Einsum",n,{equation:Ie(l)})},904270:(n,l,c,h,y)=>{i.Ab("Pad",n,{mode:l,value:c,pads:h?Array.from(B().subarray(Number(h)>>>0,Number(y)>>>0)):[]})},904413:(n,l,c,h,y,S)=>{i.Ab("BatchNormalization",n,{epsilon:l,momentum:c,spatial:!!y,trainingMode:!!h,format:S?"NHWC":"NCHW"})},904582:(n,l,c,h,y,S)=>{i.Ab("BatchNormalization",n,{epsilon:l,momentum:c,spatial:!!y,trainingMode:!!h,format:S?"NHWC":"NCHW"})},904751:(n,l,c)=>{i.Ab("CumSum",n,{exclusive:Number(l),reverse:Number(c)})},904848:(n,l,c)=>{i.Ab("DequantizeLinear",n,{axis:l,blockSize:c})},904938:(n,l,c,h,y)=>{i.Ab("GridSample",n,{align_corners:l,mode:Ie(c),padding_mode:Ie(h),format:y?"NHWC":"NCHW"})},905108:(n,l,c,h,y)=>{i.Ab("GridSample",n,{align_corners:l,mode:Ie(c),padding_mode:Ie(h),format:y?"NHWC":"NCHW"})},905278:(n,l)=>{i.Ab("ScatterND",n,{reduction:Ie(l)})},905363:(n,l,c,h,y,S,z,R,q)=>{i.Ab("Attention",n,{numHeads:l,isUnidirectional:c,maskFilterValue:h,scale:y,doRotary:S,qkvHiddenSizes:z?Array.from(B().subarray(Number(R)>>>0,Number(R)+z>>>0)):[],pastPresentShareBuffer:!!q})},905635:n=>{i.Ab("BiasAdd",n,void 0)},905690:n=>{i.Ab("BiasSplitGelu",n,void 0)},905751:n=>{i.Ab("FastGelu",n,void 0)},905807:(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We)=>{i.Ab("Conv",n,{format:ne?"NHWC":"NCHW",auto_pad:l,dilations:c?Array.from(B().subarray(Number(c)>>>0,Number(h)>>>0)):[],group:y,kernel_shape:S?Array.from(B().subarray(Number(S)>>>0,Number(z)>>>0)):[],pads:R?Array.from(B().subarray(Number(R)>>>0,Number(q)>>>0)):[],strides:G?Array.from(B().subarray(Number(G)>>>0,Number(J)>>>0)):[],w_is_const:()=>!!N()[Number(de)>>>0],activation:Ie(be),activation_params:ze?Array.from(Se().subarray(Number(ze)>>>0,Number(We)>>>0)):[]})},906391:n=>{i.Ab("Gelu",n,void 0)},906443:(n,l,c,h,y,S,z,R,q)=>{i.Ab("GroupQueryAttention",n,{numHeads:l,kvNumHeads:c,scale:h,softcap:y,doRotary:S,rotaryInterleaved:z,smoothSoftmax:R,localWindowSize:q})},906660:(n,l,c,h)=>{i.Ab("LayerNormalization",n,{axis:l,epsilon:c,simplified:!!h})},906771:(n,l,c,h)=>{i.Ab("LayerNormalization",n,{axis:l,epsilon:c,simplified:!!h})},906882:(n,l,c,h,y,S)=>{i.Ab("MatMulNBits",n,{k:l,n:c,accuracyLevel:h,bits:y,blockSize:S})},907009:(n,l,c,h,y,S)=>{i.Ab("MultiHeadAttention",n,{numHeads:l,isUnidirectional:c,maskFilterValue:h,scale:y,doRotary:S})},907168:(n,l)=>{i.Ab("QuickGelu",n,{alpha:l})},907232:(n,l,c,h,y)=>{i.Ab("RotaryEmbedding",n,{interleaved:!!l,numHeads:c,rotaryEmbeddingDim:h,scale:y})},907371:(n,l,c)=>{i.Ab("SkipLayerNormalization",n,{epsilon:l,simplified:!!c})},907473:(n,l,c)=>{i.Ab("SkipLayerNormalization",n,{epsilon:l,simplified:!!c})},907575:(n,l,c,h)=>{i.Ab("GatherBlockQuantized",n,{gatherAxis:l,quantizeAxis:c,blockSize:h})},907696:n=>{i.$b(n)},907730:(n,l)=>i.bc(Number(n),Number(l),i.Gb.ec,i.Gb.errors)};function hm(n,l,c){return Qn(async()=>{await i.Yb(Number(n),Number(l),Number(c))})}function mm(){return typeof wasmOffsetConverter<"u"}var D=await(async function(){function n(h,y){return D=h.exports,D=(function(){var S=D,z={};for(let[R,q]of Object.entries(S))z[R]=typeof q=="function"?(...G)=>{Ri.push(R);try{return q(...G)}finally{j||(Ri.pop(),ut&&bt===1&&Ri.length===0&&(bt=0,nt+=1,Oi(Ts),typeof Fibers<"u"&&Fibers.sc()))}}:q;return z})(),D=(function(){var S=D,z=q=>G=>q(G)>>>0,R=q=>()=>q()>>>0;return(S=Object.assign({},S)).Ea=z(S.Ea),S.gb=R(S.gb),S.ib=z(S.ib),S.tb=z(S.tb),S.ub=R(S.ub),S.__cxa_get_exception_ptr=z(S.__cxa_get_exception_ptr),S})(),$n.push(D.jb),w=y,jt(),D}Ve++;var l=Pe();if(i.instantiateWasm)return new Promise(h=>{i.instantiateWasm(l,(y,S)=>{h(n(y,S))})});if(u)return new Promise(h=>{V=y=>{var S=new WebAssembly.Instance(y,Pe());h(n(S,y))}});ke??(ke=i.locateFile?i.locateFile?i.locateFile("ort-wasm-simd-threaded.jsep.wasm",$):$+"ort-wasm-simd-threaded.jsep.wasm":new URL("ort-wasm-simd-threaded.jsep.wasm",void 0).href);try{var c=await(async function(h){var y=ke;if(!x&&typeof WebAssembly.instantiateStreaming=="function"&&!le(y))try{var S=fetch(y,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(S,h)}catch(z){re(`wasm streaming compile failed: ${z}`),re("falling back to ArrayBuffer instantiation")}return(async function(z,R){try{var q=await(async function(G){if(!x)try{var J=await m(G);return new Uint8Array(J)}catch{}if(G==ke&&x)G=new Uint8Array(x);else{if(!g)throw"both async and sync fetching of the wasm failed";G=g(G)}return G})(z);return await WebAssembly.instantiate(q,R)}catch(G){re(`failed to asynchronously prepare wasm: ${G}`),he(G)}})(y,h)})(l);return n(c.instance,c.module)}catch(h){return r(h),Promise.reject(h)}})(),hs=n=>(hs=D.Ea)(n),ms=()=>(ms=D.Fa)();i._OrtInit=(n,l)=>(i._OrtInit=D.Ga)(n,l),i._OrtGetLastError=(n,l)=>(i._OrtGetLastError=D.Ha)(n,l),i._OrtCreateSessionOptions=(n,l,c,h,y,S,z,R,q,G)=>(i._OrtCreateSessionOptions=D.Ia)(n,l,c,h,y,S,z,R,q,G),i._OrtAppendExecutionProvider=(n,l,c,h,y)=>(i._OrtAppendExecutionProvider=D.Ja)(n,l,c,h,y),i._OrtAddFreeDimensionOverride=(n,l,c)=>(i._OrtAddFreeDimensionOverride=D.Ka)(n,l,c),i._OrtAddSessionConfigEntry=(n,l,c)=>(i._OrtAddSessionConfigEntry=D.La)(n,l,c),i._OrtReleaseSessionOptions=n=>(i._OrtReleaseSessionOptions=D.Ma)(n),i._OrtCreateSession=(n,l,c)=>(i._OrtCreateSession=D.Na)(n,l,c),i._OrtReleaseSession=n=>(i._OrtReleaseSession=D.Oa)(n),i._OrtGetInputOutputCount=(n,l,c)=>(i._OrtGetInputOutputCount=D.Pa)(n,l,c),i._OrtGetInputOutputMetadata=(n,l,c,h)=>(i._OrtGetInputOutputMetadata=D.Qa)(n,l,c,h),i._OrtFree=n=>(i._OrtFree=D.Ra)(n),i._OrtCreateTensor=(n,l,c,h,y,S)=>(i._OrtCreateTensor=D.Sa)(n,l,c,h,y,S),i._OrtGetTensorData=(n,l,c,h,y)=>(i._OrtGetTensorData=D.Ta)(n,l,c,h,y),i._OrtReleaseTensor=n=>(i._OrtReleaseTensor=D.Ua)(n),i._OrtCreateRunOptions=(n,l,c,h)=>(i._OrtCreateRunOptions=D.Va)(n,l,c,h),i._OrtAddRunConfigEntry=(n,l,c)=>(i._OrtAddRunConfigEntry=D.Wa)(n,l,c),i._OrtReleaseRunOptions=n=>(i._OrtReleaseRunOptions=D.Xa)(n),i._OrtCreateBinding=n=>(i._OrtCreateBinding=D.Ya)(n),i._OrtBindInput=(n,l,c)=>(i._OrtBindInput=D.Za)(n,l,c),i._OrtBindOutput=(n,l,c,h)=>(i._OrtBindOutput=D._a)(n,l,c,h),i._OrtClearBoundOutputs=n=>(i._OrtClearBoundOutputs=D.$a)(n),i._OrtReleaseBinding=n=>(i._OrtReleaseBinding=D.ab)(n),i._OrtRunWithBinding=(n,l,c,h,y)=>(i._OrtRunWithBinding=D.bb)(n,l,c,h,y),i._OrtRun=(n,l,c,h,y,S,z,R)=>(i._OrtRun=D.cb)(n,l,c,h,y,S,z,R),i._OrtEndProfiling=n=>(i._OrtEndProfiling=D.db)(n),i._JsepOutput=(n,l,c)=>(i._JsepOutput=D.eb)(n,l,c),i._JsepGetNodeName=n=>(i._JsepGetNodeName=D.fb)(n);var Sr=()=>(Sr=D.gb)(),ft=i._free=n=>(ft=i._free=D.hb)(n),Pi=i._malloc=n=>(Pi=i._malloc=D.ib)(n),Cr=(n,l,c,h,y,S)=>(Cr=D.kb)(n,l,c,h,y,S),gs=()=>(gs=D.lb)(),_s=(n,l,c,h,y)=>(_s=D.mb)(n,l,c,h,y),ys=n=>(ys=D.nb)(n),kr=n=>(kr=D.ob)(n),bs=(n,l)=>(bs=D.pb)(n,l),ws=()=>(ws=D.qb)(),$s=(n,l)=>($s=D.rb)(n,l),Ui=n=>(Ui=D.sb)(n),Er=n=>(Er=D.tb)(n),Ir=()=>(Ir=D.ub)(),vs=i.dynCall_ii=(n,l)=>(vs=i.dynCall_ii=D.vb)(n,l);i.dynCall_vii=(n,l,c)=>(i.dynCall_vii=D.dynCall_vii)(n,l,c),i.dynCall_iiiii=(n,l,c,h,y)=>(i.dynCall_iiiii=D.dynCall_iiiii)(n,l,c,h,y),i.dynCall_iii=(n,l,c)=>(i.dynCall_iii=D.dynCall_iii)(n,l,c),i.dynCall_iiiiii=(n,l,c,h,y,S)=>(i.dynCall_iiiiii=D.dynCall_iiiiii)(n,l,c,h,y,S),i.dynCall_iiiiiiii=(n,l,c,h,y,S,z,R)=>(i.dynCall_iiiiiiii=D.dynCall_iiiiiiii)(n,l,c,h,y,S,z,R),i.dynCall_iiiiiii=(n,l,c,h,y,S,z)=>(i.dynCall_iiiiiii=D.dynCall_iiiiiii)(n,l,c,h,y,S,z),i.dynCall_vi=(n,l)=>(i.dynCall_vi=D.dynCall_vi)(n,l),i.dynCall_iiii=(n,l,c,h)=>(i.dynCall_iiii=D.dynCall_iiii)(n,l,c,h),i.dynCall_i=n=>(i.dynCall_i=D.dynCall_i)(n),i.dynCall_viiiiiiii=(n,l,c,h,y,S,z,R,q)=>(i.dynCall_viiiiiiii=D.dynCall_viiiiiiii)(n,l,c,h,y,S,z,R,q),i.dynCall_viii=(n,l,c,h)=>(i.dynCall_viii=D.dynCall_viii)(n,l,c,h),i.dynCall_viijj=(n,l,c,h,y)=>(i.dynCall_viijj=D.dynCall_viijj)(n,l,c,h,y),i.dynCall_viiiiii=(n,l,c,h,y,S,z)=>(i.dynCall_viiiiii=D.dynCall_viiiiii)(n,l,c,h,y,S,z),i.dynCall_viiii=(n,l,c,h,y)=>(i.dynCall_viiii=D.dynCall_viiii)(n,l,c,h,y),i.dynCall_viiiii=(n,l,c,h,y,S)=>(i.dynCall_viiiii=D.dynCall_viiiii)(n,l,c,h,y,S),i.dynCall_vfiii=(n,l,c,h,y)=>(i.dynCall_vfiii=D.dynCall_vfiii)(n,l,c,h,y),i.dynCall_viiiiff=(n,l,c,h,y,S,z)=>(i.dynCall_viiiiff=D.dynCall_viiiiff)(n,l,c,h,y,S,z),i.dynCall_viiiiiff=(n,l,c,h,y,S,z,R)=>(i.dynCall_viiiiiff=D.dynCall_viiiiiff)(n,l,c,h,y,S,z,R),i.dynCall_ffff=(n,l,c,h)=>(i.dynCall_ffff=D.dynCall_ffff)(n,l,c,h),i.dynCall_viiff=(n,l,c,h,y)=>(i.dynCall_viiff=D.dynCall_viiff)(n,l,c,h,y),i.dynCall_fffffff=(n,l,c,h,y,S,z)=>(i.dynCall_fffffff=D.dynCall_fffffff)(n,l,c,h,y,S,z),i.dynCall_jjjjjjj=(n,l,c,h,y,S,z)=>(i.dynCall_jjjjjjj=D.dynCall_jjjjjjj)(n,l,c,h,y,S,z),i.dynCall_jjjjjj=(n,l,c,h,y,S)=>(i.dynCall_jjjjjj=D.dynCall_jjjjjj)(n,l,c,h,y,S),i.dynCall_iijjii=(n,l,c,h,y,S)=>(i.dynCall_iijjii=D.dynCall_iijjii)(n,l,c,h,y,S),i.dynCall_viiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be)=>(i.dynCall_viiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be),i.dynCall_viiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J)=>(i.dynCall_viiiiiiiiii=D.dynCall_viiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J),i.dynCall_viiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne)=>(i.dynCall_viiiiiiiiiii=D.dynCall_viiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne),i.dynCall_viiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de)=>(i.dynCall_viiiiiiiiiiii=D.dynCall_viiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de),i.dynCall_viiiiiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi)=>(i.dynCall_viiiiiiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi),i.dynCall_viiiiiiiii=(n,l,c,h,y,S,z,R,q,G)=>(i.dynCall_viiiiiiiii=D.dynCall_viiiiiiiii)(n,l,c,h,y,S,z,R,q,G),i.dynCall_viiiiiiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi,zr)=>(i.dynCall_viiiiiiiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi,zr),i.dynCall_viiiiiii=(n,l,c,h,y,S,z,R)=>(i.dynCall_viiiiiii=D.dynCall_viiiiiii)(n,l,c,h,y,S,z,R),i.dynCall_viiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We)=>(i.dynCall_viiiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We),i.dynCall_jiji=(n,l,c,h)=>(i.dynCall_jiji=D.dynCall_jiji)(n,l,c,h),i.dynCall_v=n=>(i.dynCall_v=D.dynCall_v)(n),i.dynCall_iidiiii=(n,l,c,h,y,S,z)=>(i.dynCall_iidiiii=D.dynCall_iidiiii)(n,l,c,h,y,S,z),i.dynCall_iiiiiiiii=(n,l,c,h,y,S,z,R,q)=>(i.dynCall_iiiiiiiii=D.dynCall_iiiiiiiii)(n,l,c,h,y,S,z,R,q),i.dynCall_iiij=(n,l,c,h)=>(i.dynCall_iiij=D.dynCall_iiij)(n,l,c,h),i.dynCall_iiiiiiiiii=(n,l,c,h,y,S,z,R,q,G)=>(i.dynCall_iiiiiiiiii=D.dynCall_iiiiiiiiii)(n,l,c,h,y,S,z,R,q,G),i.dynCall_iiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de)=>(i.dynCall_iiiiiiiiiiiii=D.dynCall_iiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de),i.dynCall_iiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J)=>(i.dynCall_iiiiiiiiiii=D.dynCall_iiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J),i.dynCall_ji=(n,l)=>(i.dynCall_ji=D.dynCall_ji)(n,l),i.dynCall_iijii=(n,l,c,h,y)=>(i.dynCall_iijii=D.dynCall_iijii)(n,l,c,h,y),i.dynCall_vij=(n,l,c)=>(i.dynCall_vij=D.dynCall_vij)(n,l,c),i.dynCall_viiijii=(n,l,c,h,y,S,z)=>(i.dynCall_viiijii=D.dynCall_viiijii)(n,l,c,h,y,S,z),i.dynCall_viijiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt)=>(i.dynCall_viijiiiiiiiiiiiiii=D.dynCall_viijiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt),i.dynCall_viiiji=(n,l,c,h,y,S)=>(i.dynCall_viiiji=D.dynCall_viiiji)(n,l,c,h,y,S),i.dynCall_fiii=(n,l,c,h)=>(i.dynCall_fiii=D.dynCall_fiii)(n,l,c,h),i.dynCall_viijii=(n,l,c,h,y,S)=>(i.dynCall_viijii=D.dynCall_viijii)(n,l,c,h,y,S),i.dynCall_viij=(n,l,c,h)=>(i.dynCall_viij=D.dynCall_viij)(n,l,c,h),i.dynCall_jiij=(n,l,c,h)=>(i.dynCall_jiij=D.dynCall_jiij)(n,l,c,h),i.dynCall_fi=(n,l)=>(i.dynCall_fi=D.dynCall_fi)(n,l),i.dynCall_fii=(n,l,c)=>(i.dynCall_fii=D.dynCall_fii)(n,l,c),i.dynCall_jii=(n,l,c)=>(i.dynCall_jii=D.dynCall_jii)(n,l,c),i.dynCall_dii=(n,l,c)=>(i.dynCall_dii=D.dynCall_dii)(n,l,c),i.dynCall_fiiii=(n,l,c,h,y)=>(i.dynCall_fiiii=D.dynCall_fiiii)(n,l,c,h,y),i.dynCall_fif=(n,l,c)=>(i.dynCall_fif=D.dynCall_fif)(n,l,c),i.dynCall_jfi=(n,l,c)=>(i.dynCall_jfi=D.dynCall_jfi)(n,l,c),i.dynCall_viiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze)=>(i.dynCall_viiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze),i.dynCall_viiiiiiiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi,zr,gm)=>(i.dynCall_viiiiiiiiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht,zt,oi,zr,gm),i.dynCall_viiiiiiiiiiiiiiii=(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht)=>(i.dynCall_viiiiiiiiiiiiiiii=D.dynCall_viiiiiiiiiiiiiiii)(n,l,c,h,y,S,z,R,q,G,J,ne,de,be,ze,We,ht),i.dynCall_iif=(n,l,c)=>(i.dynCall_iif=D.dynCall_iif)(n,l,c),i.dynCall_jiiii=(n,l,c,h,y)=>(i.dynCall_jiiii=D.dynCall_jiiii)(n,l,c,h,y),i.dynCall_jiii=(n,l,c,h)=>(i.dynCall_jiii=D.dynCall_jiii)(n,l,c,h),i.dynCall_viif=(n,l,c,h)=>(i.dynCall_viif=D.dynCall_viif)(n,l,c,h),i.dynCall_viiij=(n,l,c,h,y)=>(i.dynCall_viiij=D.dynCall_viiij)(n,l,c,h,y),i.dynCall_viiiijii=(n,l,c,h,y,S,z,R)=>(i.dynCall_viiiijii=D.dynCall_viiiijii)(n,l,c,h,y,S,z,R),i.dynCall_iiiiij=(n,l,c,h,y,S)=>(i.dynCall_iiiiij=D.dynCall_iiiiij)(n,l,c,h,y,S),i.dynCall_iiiiid=(n,l,c,h,y,S)=>(i.dynCall_iiiiid=D.dynCall_iiiiid)(n,l,c,h,y,S),i.dynCall_iiiiijj=(n,l,c,h,y,S,z)=>(i.dynCall_iiiiijj=D.dynCall_iiiiijj)(n,l,c,h,y,S,z),i.dynCall_iiiiiijj=(n,l,c,h,y,S,z,R)=>(i.dynCall_iiiiiijj=D.dynCall_iiiiiijj)(n,l,c,h,y,S,z,R);var xs=n=>(xs=D.wb)(n),Ts=()=>(Ts=D.xb)(),Ss=n=>(Ss=D.yb)(n),Cs=()=>(Cs=D.zb)();return(function n(){if(0<Ve)qe=n;else if(u)t(i),Oe();else{for(;0<ri.length;)ri.shift()(i);0<Ve?qe=n:(i.calledRun=!0,j||(Oe(),t(i)))}})(),i.PTR_SIZE=4,a},zd=Br,zs=globalThis.self?.name?.startsWith("em-pthread"),zs&&Br()}),Dr,Ea,As,Le,Ad,Wi,Os,Rs,Pr,Ns,Ur,Od,qr,Rd,Ha=L(()=>{"use strict";ja(),Dr=typeof location>"u"?void 0:location.origin,Ea=void 0>"file:"&&void 0<"file;",As=()=>{if(Ea){let e=URL;return new URL(new e("ort.bundle.min.mjs",void 0).href,Dr).href}},Le=As(),Ad=()=>{if(Le&&!Le.startsWith("blob:"))return Le.substring(0,Le.lastIndexOf("/")+1)},Wi=(e,t)=>{try{let r=t??Le;return(r?new URL(e,r):new URL(e)).origin===Dr}catch{return!1}},Os=(e,t)=>{let r=t??Le;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},Rs=(e,t)=>`${t??"./"}${e}`,Pr=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},Ns=async e=>(await import(e)).default,Ur=(Pm(),Ti(kd)).default,Od=async()=>{if(!Le)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(Wi(Le))return[void 0,Ur()];let e=await Pr(Le);return[e,Ur(e)]},qr=(Um(),Ti(Id)).default,Rd=async(e,t,r,i)=>{let a=qr&&!(e||t);if(a)if(Le)a=Wi(Le);else if(i&&!r)a=!0;else throw new Error("cannot determine the script source URL.");if(a)return[void 0,qr];{let s="ort-wasm-simd-threaded.jsep.mjs",o=e??Os(s,t),u=r&&o&&!Wi(o,t),d=u?await Pr(o):o??Rs(s,t);return[u?d:void 0,await Ns(d)]}}}),Wr,Li,li,Lr,Ms,Bs,Ds,Ka,ve,Ft=L(()=>{"use strict";Ha(),Li=!1,li=!1,Lr=!1,Ms=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Bs=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Ds=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Ka=async e=>{if(Li)return Promise.resolve();if(li)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Lr)throw new Error("previous call to 'initializeWebAssembly()' failed.");li=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!Ds())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Bs())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=Ms();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let a=e.wasmPaths,s=typeof a=="string"?a:void 0,o=a?.mjs,u=o?.href??o,d=a?.wasm,p=d?.href??d,f=e.wasmBinary,[m,g]=await Rd(u,s,r>1,!!f||!!p),b=!1,_=[];if(t>0&&_.push(new Promise($=>{setTimeout(()=>{b=!0,$()},t)})),_.push(new Promise(($,x)=>{let v={numThreads:r};if(f)v.wasmBinary=f;else if(p||s)v.locateFile=w=>p??s+w;else if(u&&u.indexOf("blob:")!==0)v.locateFile=w=>new URL(w,u).href;else if(m){let w=Ad();w&&(v.locateFile=k=>w+k)}g(v).then(w=>{li=!1,Li=!0,Wr=w,$(),m&&URL.revokeObjectURL(m)},w=>{li=!1,Lr=!0,x(w)})})),await Promise.race(_),b)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},ve=()=>{if(Li&&Wr)return Wr;throw new Error("WebAssembly is not initialized yet.")}}),rt,tr,$e,Za=L(()=>{"use strict";Ft(),rt=(e,t)=>{let r=ve(),i=r.lengthBytesUTF8(e)+1,a=r._malloc(i);return r.stringToUTF8(e,a,i),t.push(a),a},tr=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([a,s])=>{let o=t?t+a:a;if(typeof s=="object")tr(s,o+".",r,i);else if(typeof s=="string"||typeof s=="number")i(o,s.toString());else if(typeof s=="boolean")i(o,s?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof s}`)})},$e=e=>{let t=ve(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetLastError(a,a+i);let s=Number(t.getValue(a,i===4?"i32":"i64")),o=t.getValue(a+i,"*"),u=o?t.UTF8ToString(o):"";throw new Error(`${e} ERROR_CODE: ${s}, ERROR_MESSAGE: ${u}`)}finally{t.stackRestore(r)}}}),Nd,qm=L(()=>{"use strict";Ft(),Za(),Nd=e=>{let t=ve(),r=0,i=[],a=e||{};try{if(e?.logSeverityLevel===void 0)a.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if(e?.logVerbosityLevel===void 0)a.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);e?.terminate===void 0&&(a.terminate=!1);let s=0;return e?.tag!==void 0&&(s=rt(e.tag,i)),r=t._OrtCreateRunOptions(a.logSeverityLevel,a.logVerbosityLevel,!!a.terminate,s),r===0&&$e("Can't create run options."),e?.extra!==void 0&&tr(e.extra,"",new WeakSet,(o,u)=>{let d=rt(o,i),p=rt(u,i);t._OrtAddRunConfigEntry(r,d,p)!==0&&$e(`Can't set a run config entry: ${o} - ${u}.`)}),[r,i]}catch(s){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(o=>t._free(o)),s}}}),Ps,Us,qs,di,Ws,Md,Wm=L(()=>{"use strict";Ft(),Za(),Ps=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},Us=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},qs=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},di=(e,t,r,i)=>{let a=rt(t,i),s=rt(r,i);ve()._OrtAddSessionConfigEntry(e,a,s)!==0&&$e(`Can't set a session config entry: ${t} - ${r}.`)},Ws=async(e,t,r)=>{for(let i of t){let a=typeof i=="string"?i:i.name,s=[];switch(a){case"webnn":if(a="WEBNN",typeof i!="string"){let f=i?.deviceType;f&&di(e,"deviceType",f,r)}break;case"webgpu":if(a="JS",typeof i!="string"){let f=i;if(f?.preferredLayout){if(f.preferredLayout!=="NCHW"&&f.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${f.preferredLayout}`);di(e,"preferredLayout",f.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${a}`)}let o=rt(a,r),u=s.length,d=0,p=0;if(u>0){d=ve()._malloc(u*ve().PTR_SIZE),r.push(d),p=ve()._malloc(u*ve().PTR_SIZE),r.push(p);for(let f=0;f<u;f++)ve().setValue(d+f*ve().PTR_SIZE,s[f][0],"*"),ve().setValue(p+f*ve().PTR_SIZE,s[f][1],"*")}await ve()._OrtAppendExecutionProvider(e,o,d,p,u)!==0&&$e(`Can't append execution provider: ${a}.`)}},Md=async e=>{let t=ve(),r=0,i=[],a=e||{};qs(a);try{let s=Ps(a.graphOptimizationLevel??"all"),o=Us(a.executionMode??"sequential"),u=typeof a.logId=="string"?rt(a.logId,i):0,d=a.logSeverityLevel??2;if(!Number.isInteger(d)||d<0||d>4)throw new Error(`log severity level is not valid: ${d}`);let p=a.logVerbosityLevel??0;if(!Number.isInteger(p)||p<0||p>4)throw new Error(`log verbosity level is not valid: ${p}`);let f=typeof a.optimizedModelFilePath=="string"?rt(a.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(s,!!a.enableCpuMemArena,!!a.enableMemPattern,o,!!a.enableProfiling,0,u,d,p,f),r===0&&$e("Can't create session options."),a.executionProviders&&await Ws(r,a.executionProviders,i),a.enableGraphCapture!==void 0){if(typeof a.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${a.enableGraphCapture}`);di(r,"enableGraphCapture",a.enableGraphCapture.toString(),i)}if(a.freeDimensionOverrides)for(let[m,g]of Object.entries(a.freeDimensionOverrides)){if(typeof m!="string")throw new Error(`free dimension override name must be a string: ${m}`);if(typeof g!="number"||!Number.isInteger(g)||g<0)throw new Error(`free dimension override value must be a non-negative integer: ${g}`);let b=rt(m,i);t._OrtAddFreeDimensionOverride(r,b,g)!==0&&$e(`Can't set a free dimension override: ${m} - ${g}.`)}return a.extra!==void 0&&tr(a.extra,"",new WeakSet,(m,g)=>{di(r,m,g,i)}),[r,i]}catch(s){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&$e("Can't release session options."),i.forEach(o=>t._free(o)),s}}}),Dt,gt,Pt,ur,ir,Qa,Ya,Ia,se=L(()=>{"use strict";Dt=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},gt=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},Pt=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((a,s)=>a*s,1);return r>0?Math.ceil(i*r):void 0},ur=e=>{switch(e){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},ir=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},Qa=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Ya=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Ia=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Xa,Bd=L(()=>{"use strict";ja(),Xa=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let a=t.body.getReader(),s;try{s=new ArrayBuffer(i)}catch(u){if(u instanceof RangeError){let d=Math.ceil(i/65536);s=new WebAssembly.Memory({initial:d,maximum:d}).buffer}else throw u}let o=0;for(;;){let{done:u,value:d}=await a.read();if(u)break;let p=d.byteLength;new Uint8Array(s,o,p).set(d),o+=p}return new Uint8Array(s,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Ls,Fs,Gs,Vs,Ja,js,me,_t=L(()=>{"use strict";se(),Ls=["V","I","W","E","F"],Fs=(e,t)=>{console.log(`[${Ls[e]},${new Date().toISOString()}]${t}`)},Ja=(e,t)=>{Gs=e,Vs=t},js=(e,t)=>{let r=ir(e),i=ir(Gs);r>=i&&Fs(r,typeof t=="function"?t():t)},me=(...e)=>{Vs&&js(...e)}}),Hs,Yt,O,rr,Dd,Pd,Ud,oe=L(()=>{"use strict";Hs=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Yt=class{static calcShape(e,t,r=!1){let i=e.length,a=t.length;if(i===0)return t;if(a===0)return e;let s=Math.max(e.length,t.length),o=new Array(s);if(r){if(i<2||a<2)return;let u=Hs.calcMatMulShape([e[i-2],e[i-1]],[t[a-2],t[a-1]]);if(u===void 0)return;[o[s-2],o[s-1]]=u}for(let u=r?3:1;u<=s;u++){let d=i-u<0?1:e[i-u],p=a-u<0?1:t[a-u];if(d!==p&&d>1&&p>1)return;let f=Math.max(d,p);if(d&&p)o[s-u]=Math.max(d,p);else{if(f>1)return;o[s-u]=0}}return o}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let a=1;a<=r;a++)if(e[r-a]!==1&&e[r-a]!==t[i-a])return!1;return!0}},O=class Ji{static size(t){return Ji.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let a=new Array(i),s=i-1;for(;s>=0;){if(t[s]%r===0){a[s]=t[s]/r;break}if(r%t[s]!==0)throw new Error("cannot convert shape");a[s]=1,r/=t[s],s--}for(s--;s>=0;s--)a[s]=t[s];return a}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return Ji.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return Ji.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let a=1;for(let s=r;s<i;s++){if(t[s]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");a*=Number(t[s])}return a}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let a=r-3;a>=0;--a)i[a]=i[a+1]*t[a+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((a,s)=>a+r[s]+r[s+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,a)=>i===r[a])}},rr=class wi{static adjustPoolAttributes(t,r,i,a,s,o){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let u=0;u<r.length-2;u++)u>=i.length?i.push(r[u+2]):i[u]=r[u+2];for(let u=0;u<i.length;u++)if(u<a.length){if(a[u]<0)throw new Error("strides should be greater than or equal to 1")}else a.push(1);for(let u=0;u<i.length;u++)if(u<s.length){if(s[u]<0)throw new Error("dilations should be greater than or equal to 1")}else s.push(1);for(let u=0;u<i.length*2;u++)if(u<o.length){if(o[u]<0)throw new Error("pad should be greater than or equal to 1")}else o.push(0);for(let u=0;u<i.length;u++){if(i[u]<=0)throw new Error("kernel shapes need to be greater than 0");if(o[u]>=i[u]||o[u+i.length]>=i[u])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,a,s,o,u){if(u){if(s.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(a.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let d=0;d<t.length-2;d++)wi.adjustPadAndReturnShape(t[d+(o?1:2)],r[d],i[d],a[d],s,d,d+t.length-2,u)}}static computePoolOutputShape(t,r,i,a,s,o,u){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let d=[r[0],r[1]];return wi.computeShapeHelper(t,r,d,i,a,s,o,u),d}static computeConvOutputShape(t,r,i,a,s,o,u){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let d=[t[0],r[0]];return wi.computeShapeHelper(!1,t,d,i,a,s,o,u),d}static computeShapeHelper(t,r,i,a,s,o,u,d){if(t)for(let p=0;p<r.length-2;p++)i.push(1);else for(let p=0;p<r.length-2;p++)i.push(wi.adjustPadAndReturnShape(r[p+2],a[p],s[p],o[p],u,p,p+r.length-2,d))}static adjustPadAndReturnShape(t,r,i,a,s,o,u,d){let p=i*(a-1)+1;if(d&&d!=="NOTSET")switch(d){case"VALID":return s[o]=0,s[u]=0,Math.floor((t-p)/r+1);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let f=((t+r-1)/r-1)*r+a-t;return s[o]=Math.floor(d==="SAME_LOWER"?(f+1)/2:f/2),s[u]=f-s[o],Math.floor((t+f-a)/r+1)}default:throw new Error("Unsupported AutoPad type")}else return Math.floor((t+s[o]+s[u]-p)/r+1)}},Dd=class{static getShapeOfGemmResult(e,t,r,i,a){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let s,o,u;t?(s=e[1],o=e[0]):(s=e[0],o=e[1]);let d=-1;if(i?(u=r[0],d=1):(u=r[1],d=0),r[d]!==o)throw new Error("dimension mismatch");if(s<=0||u<=0||o<=0)throw new Error("invalid shape specified");if(a&&!Yt.isValidBroadcast(a,[s,u]))throw new Error("gemm: invalid bias shape for broadcast");return[s,u,o]}},Pd=-34028234663852886e22,Ud=34028234663852886e22}),en,qd=L(()=>{"use strict";se(),en=(e,t)=>new(ur(t))(e)}),Fr,za,Gr,Ks,Vr,Zs,jr,Hr,Kr,Qs,Wd,Lm=L(()=>{"use strict";se(),_t(),Fr=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),za=(e,t)=>{if(t==="int32")return e;let r=Fr.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let a=e.byteLength/i,s=new(ur(t))(e.buffer,e.byteOffset,a);switch(t){case"int64":case"uint64":{let o=new Int32Array(a);for(let u=0;u<a;u++){let d=s[u];if(d>2147483647n||d<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");o[u]=Number(d)}return new Uint8Array(o.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&s.some(u=>u>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let o=Int32Array.from(s,Number);return new Uint8Array(o.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},Gr=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let a=BigInt64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"uint64":{if(i.some(s=>s<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let a=BigUint64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"int8":{if(i.some(s=>s<-128||s>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let a=Int8Array.from(i,Number);return new Uint8Array(a.buffer)}case"uint8":{if(i.some(a=>a<0||a>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(s=>s<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let a=Uint32Array.from(i,Number);return new Uint8Array(a.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},Ks=1,Vr=()=>Ks++,Zs=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),jr=(e,t)=>{let r=Fr.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,a)=>i*a)*r/8):0},Hr=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:a,shape:s,fallbackDataType:o}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=a,this.tensorShape=s,this.fallbackDataType=o}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return jr(this.dataType,this.tensorShape)}destroy(){me("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=Gr(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return r.buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,a)=>i===r[a])}setIsDataConverted(e){this.isDataConverted=e}},Kr=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let a=this.tensorManager.getMLContext(e),s;if(!a.opSupportLimits().input.dataTypes.includes(t)){if(s=Zs.get(t),!s||!a.opSupportLimits().input.dataTypes.includes(s))throw new Error(`WebNN backend does not support data type: ${t}`);me("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(a,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==jr(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let o=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,o,!0,!0,s),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=za(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else me("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){if(this.activeUpload){let t=this.wrapper?.isDataConverted?Gr(this.activeUpload,this.wrapper?.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(t):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(t);return}else return t.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Qs=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}reserveTensorId(){let e=Vr();return this.tensorTrackersById.set(e,new Kr(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,a){me("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${a}}`);let s=this.tensorTrackersById.get(t);if(!s)throw new Error("Tensor not found.");return s.ensureTensor(e,r,i,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){me("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t?.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let a=this.getMLContext(e),s=Vr(),o=new Hr({sessionId:e,context:a,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(s,new Kr(this,o)),this.externalTensors.add(o),s}async getCachedTensor(e,t,r,i,a,s,o){let u=this.getMLContext(e);for(let[p,f]of this.freeTensors.entries())if(f.canReuseTensor(u,t,r)){me("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${o?`fallbackDataType: ${o},`:""} shape: ${r}`);let m=this.freeTensors.splice(p,1)[0];return m.sessionId=e,m}me("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${o?`fallbackDataType: ${o},`:""} shape: ${r}}`);let d=await u.createTensor({dataType:o??t,shape:r,dimensions:r,usage:i,writable:a,readable:s});return new Hr({sessionId:e,context:u,tensor:d,dataType:t,shape:r,fallbackDataType:o})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Wd=(...e)=>new Qs(...e)}),pi,Ys,Ld,Fm=L(()=>{"use strict";se(),Ft(),qd(),Lm(),_t(),pi=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),Ys=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((a,s)=>a===i[s]&&e[a]===t[a])},Ld=class{constructor(e){this.tensorManager=Wd(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,Ja(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){me("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){me("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)me("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>Ys(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(a=>a.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){me("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,a){let s=pi.get(r);if(!s)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,s,i,a)}async createTemporaryTensor(e,t,r){me("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=pi.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let a=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,a,i,r,!1);let s=this.temporarySessionTensorIds.get(e);return s?s.push(a):this.temporarySessionTensorIds.set(e,[a]),a}uploadTensor(e,t){if(!ve().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");me("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return en(r,t)}}registerMLTensor(e,t,r,i){let a=pi.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);let s=this.tensorManager.registerTensor(e,t,a,i);return me("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${a}, dimensions: ${i}} -> {tensorId: ${s}}`),s}registerMLConstant(e,t,r,i,a,s,o=!1){if(!s)throw new Error("External mounted files are not available.");let u=e;e.startsWith("./")&&(u=e.substring(2));let d=s.get(u);if(!d)throw new Error(`File with name ${u} not found in preloaded files.`);if(t+r>d.byteLength)throw new Error("Out of bounds: data offset and length exceed the external file data size.");let p=d.slice(t,t+r).buffer,f;switch(a.dataType){case"float32":f=new Float32Array(p);break;case"float16":f=typeof Float16Array<"u"&&Float16Array.from?new Float16Array(p):new Uint16Array(p);break;case"int32":f=new Int32Array(p);break;case"uint32":f=new Uint32Array(p);break;case"int64":if(o){let m=za(new Uint8Array(p),"int64");f=new Int32Array(m.buffer),a.dataType="int32"}else f=new BigInt64Array(p);break;case"uint64":f=new BigUint64Array(p);break;case"int8":f=new Int8Array(p);break;case"int4":case"uint4":case"uint8":f=new Uint8Array(p);break;default:throw new Error(`Unsupported data type: ${a.dataType} in creating WebNN Constant from external data.`)}return me("verbose",()=>`[WebNN] registerMLConstant {dataType: ${a.dataType}, shape: ${a.shape}}} ${o?"(Note: it was int64 data type and registered to int32 as workaround)":""}`),i.constant(a,f)}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=this.mlContextBySessionId.get(e),a=pi.get(Dt(t));return typeof a>"u"?!1:r?!!i?.opSupportLimits().input.dataTypes.includes(a):!!i?.opSupportLimits().output.dataTypes.includes(a)}flush(){}}}),tn=L(()=>{"use strict"}),Zr,Fi,Gi,Xs,Js,Qr,Aa,eo,Fd,Gm=L(()=>{"use strict";_t(),tn(),Zr=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),Fi=[],Gi=e=>Math.ceil(Number(e)/16)*16,Xs=e=>{for(let t=0;t<Fi.length;t++){let r=Fi[t];if(e<=r)return r}return Math.ceil(e/16)*16},Js=1,Qr=()=>Js++,Aa=async(e,t,r,i)=>{let a=Gi(r),s=e.device.createBuffer({size:a,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let o=e.getCommandEncoder();e.endComputePass(),o.copyBufferToBuffer(t,0,s,0,a),e.flush(),await s.mapAsync(GPUMapMode.READ);let u=s.getMappedRange();if(i){let d=i();return d.set(new Uint8Array(u,0,r)),d}else return new Uint8Array(u.slice(0,r))}finally{s.destroy()}},eo=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of Zr)Fi.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,a=t.byteLength,s=Gi(a),o=this.storageCache.get(e);if(!o)throw new Error("gpu data for uploading does not exist");if(Number(o.originalSize)!==a)throw new Error(`inconsistent data size. gpu data size=${o.originalSize}, data size=${a}`);let u=this.backend.device.createBuffer({mappedAtCreation:!0,size:s,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),d=u.getMappedRange();new Uint8Array(d).set(new Uint8Array(r,i,a)),u.unmap();let p=this.backend.device.createCommandEncoder();p.copyBufferToBuffer(u,0,o.gpuData.buffer,0,s),this.backend.device.queue.submit([p.finish()]),u.destroy(),me("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let a=Gi(r.originalSize),s=this.backend.getCommandEncoder();this.backend.endComputePass(),s.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,a)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return me("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=Qr();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),me("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),me("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=Xs(e),i,a=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,s=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(a||s){let u=(a?this.freeBuffers:this.freeUniformBuffers).get(r);u?u.length>0?i=u.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let o={id:Qr(),type:0,buffer:i};return this.storageCache.set(o.id,{gpuData:o,originalSize:Number(e)}),me("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${o.id}`),o}get(e){return this.storageCache.get(e)?.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return me("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await Aa(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=Zr.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(me("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},Fd=(...e)=>new eo(...e)}),to,we,Ee=L(()=>{"use strict";to=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},we=e=>new to(e)}),Xt,Vi,Ae,Me,ae,Ce,Oa,Qt,St,ie,ci,P,ee,Gd,rn,io,Vd,ue=L(()=>{"use strict";se(),oe(),Xt=64,Vi=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},Ae=(e,t=1)=>{let r=Vi(e,t);return typeof r=="string"?r:r[0]},Me=(e,t=1)=>{let r=Vi(e,t);return typeof r=="string"?r:r[1]},ae=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:O.computeStrides(r)})}),t},Ce=e=>e%4===0?4:e%2===0?2:1,Oa=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,Qt=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,St=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,ie=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,ci=(e,t,r,i,a)=>{let s=typeof r=="number",o=s?r:r.length,u=[...new Array(o).keys()],d=o<2?"u32":o<=4?`vec${o}<u32>`:`array<u32, ${o}>`,p=Vi(t,a),f=typeof p=="string"?p:p[1],m=typeof p=="string"?p:p[0],g={indices:d,value:f,storage:m,tensor:t},b=N=>typeof N=="string"?N:`${N}u`,_={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},$=s?"uniforms.":"",x=`${$}${e}_shape`,v=`${$}${e}_strides`,w="";for(let N=0;N<o-1;N++)w+=`
    let dim${N} = current / ${ie(v,N,o)};
    let rest${N} = current % ${ie(v,N,o)};
    indices[${N}] = dim${N};
    current = rest${N};
    `;w+=`indices[${o-1}] = current;`;let k=o<2?"":`
  fn o2i_${e}(offset: u32) -> ${g.indices} {
    var indices: ${g.indices};
    var current = offset;
    ${w}
    return indices;
  }`,C=N=>(_.offsetToIndices=!0,o<2?N:`o2i_${e}(${N})`),T=[];if(o>=2)for(let N=o-1;N>=0;N--)T.push(`${ie(v,N,o)} * (indices[${N}])`);let E=o<2?"":`
  fn i2o_${e}(indices: ${g.indices}) -> u32 {
    return ${T.join("+")};
  }`,I=N=>(_.indicesToOffset=!0,o<2?N:`i2o_${e}(${N})`),A=(...N)=>o===0?"0u":`${g.indices}(${N.map(b).join(",")})`,U=(N,M)=>o<2?`${N}`:`${ie(N,M,o)}`,W=(N,M,Y)=>o<2?`${N}=${Y};`:`${ie(N,M,o)}=${Y};`,F={},H=(N,M)=>{_.broadcastedIndicesToOffset=!0;let Y=`${M.name}broadcastedIndicesTo${e}Offset`;if(Y in F)return`${Y}(${N})`;let pe=[];for(let B=o-1;B>=0;B--){let Q=M.indicesGet("outputIndices",B+M.rank-o);pe.push(`${U(v,B)} * (${Q} % ${U(x,B)})`)}return F[Y]=`fn ${Y}(outputIndices: ${M.type.indices}) -> u32 {
             return ${pe.length>0?pe.join("+"):"0u"};
           }`,`${Y}(${N})`},te=(N,M)=>(()=>{if(g.storage===g.value)return`${e}[${N}]=${M};`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`${e}[${N}]=vec2<u32>(u32(${M}), select(0u, 0xFFFFFFFFu, ${M} < 0));`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`${e}[${N}]=vec2<u32>(u32(${M}), 0u);`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`${e}[${N}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${M}));`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),V=N=>(()=>{if(g.storage===g.value)return`${e}[${N}]`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`i32(${e}[${N}].x)`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`u32(${e}[${N}].x)`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${N}] & 0xFFu), bool(${e}[${N}] & 0xFF00u), bool(${e}[${N}] & 0xFF0000u), bool(${e}[${N}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),X=o<2?"":`
  fn get_${e}ByIndices(indices: ${g.indices}) -> ${f} {
    return ${V(`i2o_${e}(indices)`)};
  }`,Z=o<2?"":(()=>{let N=u.map(Y=>`d${Y}: u32`).join(", "),M=u.map(Y=>`d${Y}`).join(", ");return`
  fn get_${e}(${N}) -> ${f} {
    return get_${e}ByIndices(${A(M)});
  }`})(),K=(...N)=>{if(N.length!==o)throw new Error(`indices length must be ${o}`);let M=N.map(b).join(",");return o===0?V("0u"):o===1?V(M[0]):(_.get=!0,_.getByIndices=!0,_.indicesToOffset=!0,`get_${e}(${M})`)},re=N=>o<2?V(N):(_.getByIndices=!0,_.indicesToOffset=!0,`get_${e}ByIndices(${N})`),j=o<2?"":`
  fn set_${e}ByIndices(indices: ${g.indices}, value: ${f}) {
    ${te(`i2o_${e}(indices)`,"value")}
  }`,le=o<2?"":(()=>{let N=u.map(Y=>`d${Y}: u32`).join(", "),M=u.map(Y=>`d${Y}`).join(", ");return`
  fn set_${e}(${N}, value: ${f}) {
    set_${e}ByIndices(${A(M)}, value);
  }`})();return{impl:()=>{let N=[],M=!1;return _.offsetToIndices&&(N.push(k),M=!0),_.indicesToOffset&&(N.push(E),M=!0),_.broadcastedIndicesToOffset&&(Object.values(F).forEach(Y=>N.push(Y)),M=!0),_.set&&(N.push(le),M=!0),_.setByIndices&&(N.push(j),M=!0),_.get&&(N.push(Z),M=!0),_.getByIndices&&(N.push(X),M=!0),!s&&M&&N.unshift(`const ${x} = ${g.indices}(${r.join(",")});`,`const ${v} = ${g.indices}(${O.computeStrides(r).join(",")});`),N.join(`
`)},type:g,offsetToIndices:C,indicesToOffset:I,broadcastedIndicesToOffset:H,indices:A,indicesGet:U,indicesSet:W,set:(...N)=>{if(N.length!==o+1)throw new Error(`indices length must be ${o}`);let M=N[o];if(typeof M!="string")throw new Error("value must be string");let Y=N.slice(0,o).map(b).join(",");return o===0?te("0u",M):o===1?te(Y[0],M):(_.set=!0,_.setByIndices=!0,_.indicesToOffset=!0,`set_${e}(${Y}, ${M})`)},setByOffset:te,setByIndices:(N,M)=>o<2?te(N,M):(_.setByIndices=!0,_.indicesToOffset=!0,`set_${e}ByIndices(${N}, ${M});`),get:K,getByOffset:V,getByIndices:re,usage:i,name:e,strides:v,shape:x,rank:o}},P=(e,t,r,i=1)=>ci(e,t,r,"input",i),ee=(e,t,r,i=1)=>ci(e,t,r,"output",i),Gd=(e,t,r)=>ci(e,t,r,"atomicOutput",1),rn=(e,t,r,i=1)=>ci(e,t,r,"internal",i),io=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=Xt){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let a=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,s=a?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,o=a?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${s}) {
    ${o}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let a=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${a}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Vd=(e,t)=>new io(e,t)}),ro,Yr,ao,no,so,oo,Ge,jd,Hd,Ct=L(()=>{"use strict";se(),oe(),Ee(),ue(),ro=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Yr=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),ao=(e,t)=>O.sortBasedOnPerm(e,Yr(e.length,t)),no=(e,t,r,i)=>{let a=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let s=0;s<t;++s)a+=`a[${e[s]}]=i[${s}];`;return a+="return a;}"},so=(e,t)=>{let r=[],i=[];for(let a=0;a<e.length;++a)e[a]!==1&&r.push(e[a]),e[t[a]]!==1&&i.push(t[a]);return{newShape:r,newPerm:i}},oo=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},Ge=(e,t)=>{let r=e.dataType,i=e.dims.length,a=Yr(i,t),s=ao(e.dims,a),o=e.dims,u=s,d=i<2||oo(a,e.dims),p;if(d)return p=_=>{let $=P("input",r,o,4),x=ee("output",r,u,4);return`
  ${_.registerUniform("output_size","u32").declareVariables($,x)}
  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let _=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(_/64/4)},programUniforms:[{type:12,data:Math.ceil(_/4)}]}},getShaderSource:p};let{newShape:f,newPerm:m}=so(e.dims,a),g=O.areEqual(m,[2,3,1]),b=O.areEqual(m,[3,1,2]);if(f.length===2||g||b){o=g?[f[0],f[1]*f[2]]:b?[f[0]*f[1],f[2]]:f,u=[o[1],o[0]];let _=16;return p=$=>{let x=P("a",r,o.length),v=ee("output",r,u.length);return`
  ${$.registerUniform("output_size","u32").declareVariables(x,v)}
  var<workgroup> tile : array<array<${v.type.value}, ${_+1}>, ${_}>;
  ${$.mainStart([_,_,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${_} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${_}u + local_id.x;
    let input_row = workgroup_id_x * ${_}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${x.getByIndices(`${x.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${_}u + local_id.x;
    let output_row = workgroup_id_y * ${_}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${v.setByIndices(`${v.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let $=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(u[1]/_),y:Math.ceil(u[0]/_)},programUniforms:[{type:12,data:$},...ae(o,u)]}},getShaderSource:p}}return p=_=>{let $=P("a",r,o.length),x=ee("output",r,u.length);return`
  ${_.registerUniform("output_size","u32").declareVariables($,x)}

  ${no(a,i,$,x)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${x.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${x.setByOffset("global_idx",$.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let _=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:[{type:12,data:_},...ae(o,u)]}},getShaderSource:p}},jd=(e,t)=>{ro(e.inputs,t.perm),e.compute(Ge(e.inputs[0],t.perm))},Hd=e=>we({perm:e.perm})}),uo,lo,po,co,fo,ho,mo,go,_o,yo,Xe,Kd,Zd,Qd,Yd,Xd,Jd,ep,tp,ip,rp,Vm=L(()=>{"use strict";se(),oe(),ue(),an(),Ct(),uo={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},lo={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},po={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},co={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},fo=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},ho=(e,t)=>{let r=[],i=e.length;for(let s=0;s<i;s++)t.indexOf(s)===-1&&r.push(e[s]);let a=t.map(s=>e[s]);return[r,a]},mo=(e,t)=>{let r=e.length+t.length,i=[],a=0;for(let s=0;s<r;s++)t.indexOf(s)===-1?i.push(e[a++]):i.push(1);return i},go=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},_o=(e,t)=>{let r=[];if(!go(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},yo=(e,t,r,i,a,s,o)=>{let u=r[0].dims,d=O.size(s),p=O.size(o),f=P("_A",r[0].dataType,u),m=ee("output",a,s),g=64;d===1&&(g=256);let b=`
          var<workgroup> aBestValues : array<f32, ${g}>;
       `,_=$=>`
        ${$.registerUniform("reduceSize","u32").declareVariables(f,m)}
        ${b}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${$.mainStart(g)}

          let outputIndex = global_idx / ${g};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${po[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${g}) {
           let candidate = f32(${f.getByOffset("offset + k")});
           bestValue = ${uo[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${g}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${lo[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${m.setByOffset("outputIndex",`${i==="mean"?`${m.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${m.type.storage}(${co[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${g}`,inputDependencies:["type"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:d},programUniforms:[{type:12,data:p}]})}},Xe=(e,t,r,i)=>{let a=e.inputs.length===1?r:Ra(e.inputs,r),s=a.axes;s.length===0&&!a.noopWithEmptyAxes&&(s=e.inputs[0].dims.map((b,_)=>_));let o=O.normalizeAxes(s,e.inputs[0].dims.length),u=o,d=e.inputs[0],p=_o(u,e.inputs[0].dims.length);p.length>0&&(d=e.compute(Ge(e.inputs[0],p),{inputs:[0],outputs:[-1]})[0],u=fo(u.length,d.dims.length));let[f,m]=ho(d.dims,u),g=f;a.keepDims&&(g=mo(f,o)),e.compute(yo(t,a.cacheKey,[d],i,e.inputs[0].dataType,g,m),{inputs:[d]})},Kd=(e,t)=>{Xe(e,"ReduceMeanShared",t,"mean")},Zd=(e,t)=>{Xe(e,"ReduceL1Shared",t,"l1")},Qd=(e,t)=>{Xe(e,"ReduceL2Shared",t,"l2")},Yd=(e,t)=>{Xe(e,"ReduceLogSumExpShared",t,"logSumExp")},Xd=(e,t)=>{Xe(e,"ReduceMaxShared",t,"max")},Jd=(e,t)=>{Xe(e,"ReduceMinShared",t,"min")},ep=(e,t)=>{Xe(e,"ReduceProdShared",t,"prod")},tp=(e,t)=>{Xe(e,"ReduceSumShared",t,"sum")},ip=(e,t)=>{Xe(e,"ReduceSumSquareShared",t,"sumSquare")},rp=(e,t)=>{Xe(e,"ReduceLogSumShared",t,"logSum")}}),Je,bo,ar,Ra,et,wo,$o,vo,xo,To,So,Co,ko,Eo,Io,tt,ap,np,sp,op,up,lp,dp,pp,cp,fp,an=L(()=>{"use strict";se(),oe(),Ee(),ue(),Vm(),Je=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},bo=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],ar=(e,t,r,i,a,s,o=!1,u=!1)=>{let d=[],p=r[0].dims,f=p.length,m=O.normalizeAxes(a,f),g=!u&&m.length===0;p.forEach(($,x)=>{g||m.indexOf(x)>=0?o&&d.push(1):d.push($)});let b=d.length,_=O.size(d);return{name:e,shaderCache:t,getShaderSource:$=>{let x=[],v=P("_A",r[0].dataType,f),w=ee("output",s,b),k=i(v,w,m),C=k[2];for(let T=0,E=0;T<f;T++)g||m.indexOf(T)>=0?(o&&E++,C=`for(var j${T}: u32 = 0; j${T} < ${p[T]}; j${T}++) {
                  ${k[2].includes("last_index")?`let last_index = j${T};`:""}
                  ${v.indicesSet("input_indices",T,`j${T}`)}
                  ${C}
                }`):(x.push(`${v.indicesSet("input_indices",T,w.indicesGet("output_indices",E))};`),E++);return`

        ${$.registerUniform("output_size","u32").declareVariables(v,w)}

        ${$.mainStart()}
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${v.type.indices};
          let output_indices = ${w.offsetToIndices("global_idx")};

          ${x.join(`
`)}
          ${k[0]}       // init ops for reduce max/min
          ${k[1]}
          ${C}
          ${k[3]}
          ${k.length===4?w.setByOffset("global_idx","value"):k.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:d,dataType:s}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:[{type:12,data:_},...ae(p,d)]})}},Ra=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),we({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},et=(e,t,r,i)=>{let a=e.inputs,s=a.length===1?r:Ra(a,r);e.compute(ar(t,{hint:s.cacheKey,inputDependencies:["rank"]},[a[0]],s.noopWithEmptyAxes&&s.axes.length===0?bo:i,s.axes,a[0].dataType,s.keepDims,s.noopWithEmptyAxes),{inputs:[0]})},wo=(e,t)=>{Je(e.inputs),et(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},$o=(e,t)=>{Je(e.inputs),et(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},vo=(e,t)=>{Je(e.inputs),et(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},xo=(e,t)=>{Je(e.inputs),et(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},To=(e,t)=>{Je(e.inputs),et(e,"ReduceMax",t,(r,i,a)=>{let s=[];for(let o=0;o<r.rank;o++)(a.indexOf(o)>=0||a.length===0)&&s.push(r.indicesSet("input_indices",o,0));return[`${s.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},So=(e,t)=>{Je(e.inputs),et(e,"ReduceMean",t,(r,i,a)=>{let s=1;for(let o=0;o<r.rank;o++)(a.indexOf(o)>=0||a.length===0)&&(s*=e.inputs[0].dims[o]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${s});`]})},Co=(e,t)=>{Je(e.inputs),et(e,"ReduceMin",t,(r,i,a)=>{let s=[];for(let o=0;o<r.rank;o++)(a.indexOf(o)>=0||a.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},ko=(e,t)=>{Je(e.inputs),et(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},Eo=(e,t)=>{Je(e.inputs),et(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},Io=(e,t)=>{Je(e.inputs),et(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},tt=(e,t,r)=>{if(t.length===0)return r;let i=1,a=1;for(let s=0;s<t.length;s++)t.indexOf(s)===-1?i*=e[s]:a*=e[s];return a<32&&i>1024},ap=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?So(e,t):Kd(e,t)},np=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?$o(e,t):Zd(e,t)},sp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?vo(e,t):Qd(e,t)},op=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?xo(e,t):Yd(e,t)},up=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?To(e,t):Xd(e,t)},lp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Co(e,t):Jd(e,t)},dp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ko(e,t):ep(e,t)},pp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Eo(e,t):tp(e,t)},cp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Io(e,t):ip(e,t)},fp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?wo(e,t):rp(e,t)}}),Xr,hp,mp,Na,jm=L(()=>{"use strict";se(),Ee(),an(),Xr=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},hp=(e,t)=>{Xr(e.inputs);let r=(i,a,s)=>{let o=[];for(let u=0;u<i.rank;u++)(s.indexOf(u)>=0||s.length===0)&&o.push(`input_indices[${u}] = 0;`);return[`${o.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(ar("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},mp=(e,t)=>{Xr(e.inputs);let r=(i,a,s)=>{let o=[];for(let u=0;u<i.rank;u++)(s.indexOf(u)>=0||s.length===0)&&o.push(`input_indices[${u}] = 0;`);return[`${o.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(ar("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Na=e=>we(e)}),zo,ji,Ao,Oo,Ro,Ci,No,gp,nn=L(()=>{"use strict";se(),oe(),tn(),ue(),zo=(e,t)=>{let r=e[0],i=e[1],a=e[2],s=e[3],o=e[4],u=e[5];if(o&&u)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let d=r.dims[0],p=r.dims[1],f=r.dims[2];if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==f)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(a.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let m=a.dims[0]/3,g=m,b=g;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let k of t.qkvHiddenSizes)if(k%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");m=t.qkvHiddenSizes[0],g=t.qkvHiddenSizes[1],b=t.qkvHiddenSizes[2]}let _=p;if(m!==g)throw new Error("qkv_hidden_sizes first element should be same as the second");if(a.dims[0]!==m+g+b)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let $=0;if(o){if(g!==b)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(o.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(o.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(o.dims[1]!==d)throw new Error('Input "past" second dimension must be batch_size');if(o.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(o.dims[4]!==g/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||($=o.dims[3])}let x=_+$,v=-1,w=0;if(s)throw new Error("Mask not supported");if(o)throw new Error("past is not supported");if(u){if(u.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(u.dims[0]!==d||u.dims[1]!==t.numHeads||u.dims[2]!==p||u.dims[3]!==x)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:d,sequenceLength:p,pastSequenceLength:$,kvSequenceLength:_,totalSequenceLength:x,maxSequenceLength:v,inputHiddenSize:f,hiddenSize:m,vHiddenSize:b,headSize:Math.floor(m/t.numHeads),vHeadSize:Math.floor(b/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:w,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},ji=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Ao=(e,t,r,i,a,s,o,u)=>{let d=Ce(o?1:s),p=64,f=s/d;f<p&&(p=32);let m=Math.ceil(s/d/p),g=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:f},{type:12,data:m}],b=Ae(e.dataType,d),_=Me(1,d),$=["type"];o&&$.push("type"),u&&$.push("type");let x=v=>{let w=ee("x",e.dataType,e.dims,d),k=[w],C=o?P("seq_lens",o.dataType,o.dims):void 0;C&&k.push(C);let T=u?P("total_sequence_length_input",u.dataType,u.dims):void 0;T&&k.push(T);let E=Me(e.dataType),I=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${p}>;
  var<workgroup> thread_sum: array<f32, ${p}>;
  ${v.registerUniforms(I).declareVariables(...k)}
  ${v.mainStart([p,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${ji(C,T,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${p}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${o?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${_}(-3.402823e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${_}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(d){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.402823e+38f);
    for (var i = 0u; i < ${p}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${_}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${_}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(d){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${p}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${w.type.value}(${E}(1.0) / ${E}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${_}(x[offset + i]);
        x[offset + i] = ${w.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${o?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${w.type.value}(${E}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${p};${b};${d}`,inputDependencies:$},getShaderSource:x,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:a,z:t*r},programUniforms:g})}},Oo=(e,t,r,i,a,s,o,u,d)=>{let p=o+s.kvSequenceLength,f=[s.batchSize,s.numHeads,s.sequenceLength,p],m=e>1&&i,g=s.kvNumHeads?s.kvNumHeads:s.numHeads,b=m?[s.batchSize,g,p,s.headSize]:void 0,_=s.nReps?s.nReps:1,$=s.scale===0?1/Math.sqrt(s.headSize):s.scale,x=Ce(s.headSize),v=s.headSize/x,w=12,k={x:Math.ceil(p/w),y:Math.ceil(s.sequenceLength/w),z:s.batchSize*s.numHeads},C=[{type:12,data:s.sequenceLength},{type:12,data:v},{type:12,data:p},{type:12,data:s.numHeads},{type:12,data:s.headSize},{type:1,data:$},{type:12,data:o},{type:12,data:s.kvSequenceLength},{type:12,data:_}],T=m&&i&&O.size(i.dims)>0,E=["type","type"];T&&E.push("type"),a&&E.push("type"),u&&E.push("type"),d&&E.push("type");let I=[{dims:f,dataType:t.dataType,gpuDataType:0}];m&&I.push({dims:b,dataType:t.dataType,gpuDataType:0});let A=U=>{let W=P("q",t.dataType,t.dims,x),F=P("key",r.dataType,r.dims,x),H=[W,F];if(T){let j=P("past_key",i.dataType,i.dims,x);H.push(j)}a&&H.push(P("attention_bias",a.dataType,a.dims));let te=u?P("seq_lens",u.dataType,u.dims):void 0;te&&H.push(te);let V=d?P("total_sequence_length_input",d.dataType,d.dims):void 0;V&&H.push(V);let X=ee("output",t.dataType,f),Z=[X];m&&Z.push(ee("present_key",t.dataType,b,x));let K=Me(1,x),re=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${w}u;

  var<workgroup> tileQ: array<${W.type.storage}, ${w*w}>;
  var<workgroup> tileK: array<${W.type.storage}, ${w*w}>;
  ${U.registerUniforms(re).declareVariables(...H,...Z)}
  ${U.mainStart([w,w,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${_===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${_===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${ji(te,V,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${T&&m?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${m?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${K}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${T&&m?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${m?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${K}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(x){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${x}`)}})()};
        output[outputIdx] = ${X.type.value} (sum * uniforms.alpha) + ${a?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${x};${a!==void 0};${i!==void 0};${e}`,inputDependencies:E},getRunData:()=>({outputs:I,dispatchGroup:k,programUniforms:C}),getShaderSource:A}},Ro=(e,t,r,i,a,s,o=void 0,u=void 0)=>{let d=s+a.kvSequenceLength,p=a.nReps?a.nReps:1,f=a.vHiddenSize*p,m=e>1&&i,g=a.kvNumHeads?a.kvNumHeads:a.numHeads,b=m?[a.batchSize,g,d,a.headSize]:void 0,_=[a.batchSize,a.sequenceLength,f],$=12,x={x:Math.ceil(a.vHeadSize/$),y:Math.ceil(a.sequenceLength/$),z:a.batchSize*a.numHeads},v=[{type:12,data:a.sequenceLength},{type:12,data:d},{type:12,data:a.vHeadSize},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:12,data:f},{type:12,data:s},{type:12,data:a.kvSequenceLength},{type:12,data:p}],w=m&&i&&O.size(i.dims)>0,k=["type","type"];w&&k.push("type"),o&&k.push("type"),u&&k.push("type");let C=[{dims:_,dataType:t.dataType,gpuDataType:0}];m&&C.push({dims:b,dataType:t.dataType,gpuDataType:0});let T=E=>{let I=P("probs",t.dataType,t.dims),A=P("v",r.dataType,r.dims),U=[I,A];w&&U.push(P("past_value",i.dataType,i.dims));let W=o?P("seq_lens",o.dataType,o.dims):void 0;o&&U.push(W);let F=u?P("total_sequence_length_input",u.dataType,u.dims):void 0;u&&U.push(F);let H=[ee("output",t.dataType,_)];m&&H.push(ee("present_value",t.dataType,b));let te=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${$}u;
  var<workgroup> tileQ: array<${I.type.value}, ${$*$}>;
  var<workgroup> tileV: array<${I.type.value}, ${$*$}>;
  ${E.registerUniforms(te).declareVariables(...U,...H)}
  ${E.mainStart([$,$,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${p===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${p===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${ji(W,F,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${w&&m?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${m?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${I.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${w&&m?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${m?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:k},getRunData:()=>({outputs:C,dispatchGroup:x,programUniforms:v}),getShaderSource:T}},Ci=(e,t,r,i,a,s,o,u,d,p,f=void 0,m=void 0)=>{let g=Math.min(e.outputCount,1+(o?1:0)+(u?1:0)),b=g>1?p.pastSequenceLength:0,_=b+p.kvSequenceLength,$=d&&O.size(d.dims)>0?d:void 0,x=[t,r];g>1&&o&&O.size(o.dims)>0&&x.push(o),$&&x.push($),f&&x.push(f),m&&x.push(m);let v=e.compute(Oo(g,t,r,o,$,p,b,f,m),{inputs:x,outputs:g>1?[-1,1]:[-1]})[0];e.compute(Ao(v,p.batchSize,p.numHeads,b,p.sequenceLength,_,f,m),{inputs:f&&m?[v,f,m]:[v],outputs:[]});let w=[v,i];g>1&&u&&O.size(u.dims)>0&&w.push(u),f&&w.push(f),m&&w.push(m),e.compute(Ro(g,v,i,u,p,b,f,m),{inputs:w,outputs:g>1?[0,2]:[0]})},No=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,a=t.inputHiddenSize,s=t.headSize,o=12,u={x:Math.ceil(t.headSize/o),y:Math.ceil(t.sequenceLength/o),z:t.batchSize*t.numHeads},d=[e.inputs[0],e.inputs[1],e.inputs[2]],p=[{type:12,data:i},{type:12,data:a},{type:12,data:s},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],f=m=>{let g=ee("output_q",d[0].dataType,r),b=ee("output_k",d[0].dataType,r),_=ee("output_v",d[0].dataType,r),$=P("input",d[0].dataType,d[0].dims),x=P("weight",d[1].dataType,d[1].dims),v=P("bias",d[2].dataType,d[2].dims),w=$.type.storage,k=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${o}u;
  var<workgroup> tileInput: array<${w}, ${o*o}>;
  var<workgroup> tileWeightQ: array<${w}, ${o*o}>;
  var<workgroup> tileWeightK: array<${w}, ${o*o}>;
  var<workgroup> tileWeightV: array<${w}, ${o*o}>;
  ${m.registerUniforms(k).declareVariables($,x,v,g,b,_)}
  ${m.mainStart([o,o,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${w}(0);
    var valueK = ${w}(0);
    var valueV = ${w}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:u,programUniforms:p}),getShaderSource:f},{inputs:d,outputs:[-1,-1,-1]})},gp=(e,t)=>{let r=zo(e.inputs,t),[i,a,s]=No(e,r);return Ci(e,i,a,s,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),Mo,Bo,Do,_p,Hm=L(()=>{"use strict";Ze(),se(),oe(),Ee(),ue(),Mo=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,a,s)=>{let o=a.length;if(o!==i.length)throw new Error(`${s}: num dimensions != ${o}`);a.forEach((u,d)=>{if(u!==i[d])throw new Error(`${s}: dim[${d}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},Bo=(e,t)=>{let{epsilon:r,spatial:i,format:a}=t,s=e[0].dims,o=i?Ce(s[s.length-1]):1,u=a==="NHWC"&&s.length>1?o:1,d=O.size(s)/o,p=i,f=p?s.length:s,m=P("x",e[0].dataType,e[0].dims,o),g=P("scale",e[1].dataType,e[1].dims,u),b=P("bias",e[2].dataType,e[2].dims,u),_=P("inputMean",e[3].dataType,e[3].dims,u),$=P("inputVar",e[4].dataType,e[4].dims,u),x=ee("y",e[0].dataType,f,o),v=()=>{let k="";if(i)k=`let cOffset = ${s.length===1?"0u":a==="NHWC"?`outputIndices[${s.length-1}] / ${o}`:"outputIndices[1]"};`;else if(a==="NCHW")k=`
            ${x.indicesSet("outputIndices","0","0")}
            let cOffset = ${x.indicesToOffset("outputIndices")};`;else{k=`var cIndices = ${g.type.indices}(0);
                       cIndices[0] = outputIndices[${s.length-1}];`;for(let C=1;C<g.rank;C++)k+=`cIndices[${C}] = outputIndices[${C}];`;k+=`let cOffset = ${g.indicesToOffset("cIndices")};`}return k},w=k=>`
  const epsilon = ${r};
  ${k.registerUniform("outputSize","u32").declareVariables(m,g,b,_,$,x)}
  ${k.mainStart()}
  ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${x.offsetToIndices(`global_idx * ${o}`)};
    ${v()}
    let scale = ${g.getByOffset("cOffset")};
    let bias = ${b.getByOffset("cOffset")};
    let inputMean = ${_.getByOffset("cOffset")};
    let inputVar = ${$.getByOffset("cOffset")};
    let x = ${m.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${x.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${o}`,inputDependencies:p?["rank","type","type","type","type"]:void 0},getShaderSource:w,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:p?[{type:12,data:d},...ae(s)]:[{type:12,data:d}]})}},Do=e=>we(e),_p=(e,t)=>{let{inputs:r,outputCount:i}=e,a=Do({...t,outputCount:i});if(_e.webgpu.validateInputContent&&Mo(r,a),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(Bo(r,a))}}),Po,Uo,yp,Km=L(()=>{"use strict";oe(),ue(),Po=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Uo=e=>{let t=e[0].dims,r=e[0].dims[2],i=O.size(t)/4,a=e[0].dataType,s=P("input",a,t,4),o=P("bias",a,[r],4),u=P("residual",a,t,4),d=ee("output",a,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:p=>`
  const channels = ${r}u / 4;
  ${p.declareVariables(s,o,u,d)}

  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${s.getByOffset("global_idx")}
      + ${o.getByOffset("global_idx % channels")} + ${u.getByOffset("global_idx")};
    ${d.setByOffset("global_idx","value")}
  }`}},yp=e=>{Po(e.inputs),e.compute(Uo(e.inputs))}}),qo,ge,bp,wp,$p,vp,xp,Tp,Sp,Cp,kp,Wo,Ep,Ip,zp,Ap,$i,Op,er,Rp,Np,Mp,Bp,Dp,Pp,Up,qp,Wp,Lp,Fp,Gp,Vp,jp,Hp,Kp,Jr,Zp,Ma,Ba,Qp,Yp,Xp,Lo,Fo,Jp,sn=L(()=>{"use strict";se(),oe(),Ee(),ue(),qo=(e,t,r,i,a,s,o)=>{let u=Math.ceil(t/4),d="";typeof a=="string"?d=`${a}(a)`:d=a("a");let p=P("inputData",r,[u],4),f=ee("outputData",i,[u],4),m=[{name:"vec_size",type:"u32"}];return o&&m.push(...o),`
      ${e.registerUniforms(m).declareVariables(p,f)}

  ${s??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${p.getByOffset("global_idx")};
    ${f.setByOffset("global_idx",d)}
  }`},ge=(e,t,r,i,a,s=e.dataType,o,u)=>{let d=[{type:12,data:Math.ceil(O.size(e.dims)/4)}];return o&&d.push(...o),{name:t,shaderCache:{hint:a,inputDependencies:["type"]},getShaderSource:p=>qo(p,O.size(e.dims),e.dataType,s,r,i,u),getRunData:p=>({outputs:[{dims:e.dims,dataType:s}],dispatchGroup:{x:Math.ceil(O.size(p[0].dims)/64/4)},programUniforms:d})}},bp=e=>{e.compute(ge(e.inputs[0],"Abs","abs"))},wp=e=>{e.compute(ge(e.inputs[0],"Acos","acos"))},$p=e=>{e.compute(ge(e.inputs[0],"Acosh","acosh"))},vp=e=>{e.compute(ge(e.inputs[0],"Asin","asin"))},xp=e=>{e.compute(ge(e.inputs[0],"Asinh","asinh"))},Tp=e=>{e.compute(ge(e.inputs[0],"Atan","atan"))},Sp=e=>{e.compute(ge(e.inputs[0],"Atanh","atanh"))},Cp=e=>we(e),kp=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(ge(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},Wo=e=>{let t,r,i=e.length>=2&&e[1].data!==0,a=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=a?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=a?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return we({min:t,max:r})},Ep=(e,t)=>{let r=t||Wo(e.inputs),i=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"Clip",a=>`clamp(${a}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},Ip=e=>{e.compute(ge(e.inputs[0],"Ceil","ceil"))},zp=e=>{e.compute(ge(e.inputs[0],"Cos","cos"))},Ap=e=>{e.compute(ge(e.inputs[0],"Cosh","cosh"))},$i=e=>we(e),Op=(e,t)=>{let r=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},er=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,Rp=e=>{let t=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,er(t)))},Np=e=>{e.compute(ge(e.inputs[0],"Exp","exp"))},Mp=e=>{e.compute(ge(e.inputs[0],"Floor","floor"))},Bp=e=>{let t=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,er(t)))},Dp=(e,t)=>{let r=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},Pp=e=>{e.compute(ge(e.inputs[0],"Not",t=>`!${t}`))},Up=e=>{e.compute(ge(e.inputs[0],"Neg",t=>`-${t}`))},qp=e=>{e.compute(ge(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},Wp=e=>{let t=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},Lp=e=>{e.compute(ge(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},Fp=e=>we(e),Gp=(e,t)=>{let r=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},Vp=e=>{e.compute(ge(e.inputs[0],"Sin","sin"))},jp=e=>{e.compute(ge(e.inputs[0],"Sinh","sinh"))},Hp=e=>{e.compute(ge(e.inputs[0],"Sqrt","sqrt"))},Kp=e=>{e.compute(ge(e.inputs[0],"Tan","tan"))},Jr=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Zp=e=>{e.compute(ge(e.inputs[0],"Tanh",Jr))},Ma=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${Jr("v")};
}
`,Ba=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,Qp=e=>{let t=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"FastGelu",Ba,Ma(t),void 0,e.inputs[0].dataType))},Yp=(e,t)=>{let r=Me(e.inputs[0].dataType);return e.compute(ge(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},Xp=e=>{e.compute(ge(e.inputs[0],"Log","log"))},Lo=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,Fo=e=>`quick_gelu_impl(${e})`,Jp=(e,t)=>{let r=Me(e.inputs[0].dataType);e.compute(ge(e.inputs[0],"QuickGelu",Fo,Lo(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Go,Vo,ec,Zm=L(()=>{"use strict";oe(),ue(),sn(),Go=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Vo=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=P("input",e[0].dataType,e[0].dims,4),i=P("bias",e[0].dataType,[e[0].dims[2]],4),a=ee("output",e[0].dataType,t,4),s=O.size(t)/4,o=Ae(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)}}),getShaderSource:u=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${u.declareVariables(r,i,a)}

  ${er(o)}

  ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes(s)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${a.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},ec=e=>{Go(e.inputs),e.compute(Vo(e.inputs))}}),jo,Ho,it,tc,ic,rc,ac,nc,sc,oc,uc,lc,dc,Qm=L(()=>{"use strict";se(),oe(),ue(),jo=(e,t,r,i,a,s,o,u,d,p,f,m)=>{let g,b;typeof u=="string"?g=b=(w,k)=>`${u}((${w}),(${k}))`:typeof u=="function"?g=b=u:(g=u.scalar,b=u.vector);let _=ee("outputData",f,i.length,4),$=P("aData",d,t.length,4),x=P("bData",p,r.length,4),v;if(a)if(s){let w=O.size(t)===1,k=O.size(r)===1,C=t.length>0&&t[t.length-1]%4===0,T=r.length>0&&r[r.length-1]%4===0;w||k?v=_.setByOffset("global_idx",b(w?`${$.type.value}(${$.getByOffset("0")}.x)`:$.getByOffset("global_idx"),k?`${x.type.value}(${x.getByOffset("0")}.x)`:x.getByOffset("global_idx"))):v=`
            let outputIndices = ${_.offsetToIndices("global_idx * 4u")};
            let offsetA = ${$.broadcastedIndicesToOffset("outputIndices",_)};
            let offsetB = ${x.broadcastedIndicesToOffset("outputIndices",_)};
            ${_.setByOffset("global_idx",b(o||C?$.getByOffset("offsetA / 4u"):`${$.type.value}(${$.getByOffset("offsetA / 4u")}[offsetA % 4u])`,o||T?x.getByOffset("offsetB / 4u"):`${x.type.value}(${x.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else v=_.setByOffset("global_idx",b($.getByOffset("global_idx"),x.getByOffset("global_idx")));else{if(!s)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let w=(k,C,T="")=>{let E=`aData[indexA${C}][componentA${C}]`,I=`bData[indexB${C}][componentB${C}]`;return`
            let outputIndices${C} = ${_.offsetToIndices(`global_idx * 4u + ${C}u`)};
            let offsetA${C} = ${$.broadcastedIndicesToOffset(`outputIndices${C}`,_)};
            let offsetB${C} = ${x.broadcastedIndicesToOffset(`outputIndices${C}`,_)};
            let indexA${C} = offsetA${C} / 4u;
            let indexB${C} = offsetB${C} / 4u;
            let componentA${C} = offsetA${C} % 4u;
            let componentB${C} = offsetB${C} % 4u;
            ${k}[${C}] = ${T}(${g(E,I)});
          `};f===9?v=`
            var data = vec4<u32>(0);
            ${w("data",0,"u32")}
            ${w("data",1,"u32")}
            ${w("data",2,"u32")}
            ${w("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:v=`
            ${w("outputData[global_idx]",0)}
            ${w("outputData[global_idx]",1)}
            ${w("outputData[global_idx]",2)}
            ${w("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables($,x,_)}

        ${m??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${v}
      }`},Ho=(e,t,r,i,a,s,o=r.dataType)=>{let u=r.dims.map($=>Number($)??1),d=i.dims.map($=>Number($)??1),p=!O.areEqual(u,d),f=u,m=O.size(u),g=!1,b=!1,_=[p];if(p){let $=Yt.calcShape(u,d,!1);if(!$)throw new Error("Can't perform binary op on the given tensors");f=$.slice(),m=O.size(f);let x=O.size(u)===1,v=O.size(d)===1,w=u.length>0&&u[u.length-1]%4===0,k=d.length>0&&d[d.length-1]%4===0;_.push(x),_.push(v),_.push(w),_.push(k);let C=1;for(let T=1;T<f.length;T++){let E=u[u.length-T],I=d[d.length-T];if(E===I)C*=E;else break}C%4===0?(b=!0,g=!0):(x||v||w||k)&&(g=!0)}else g=!0;return _.push(g),{name:e,shaderCache:{hint:t+_.map($=>$.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:$=>jo($,u,d,f,g,p,b,a,r.dataType,i.dataType,o,s),getRunData:()=>({outputs:[{dims:f,dataType:o}],dispatchGroup:{x:Math.ceil(m/64/4)},programUniforms:[{type:12,data:Math.ceil(O.size(f)/4)},...ae(u,d,f)]})}},it=(e,t,r,i,a,s)=>{e.compute(Ho(t,a??"",e.inputs[0],e.inputs[1],r,i,s))},tc=e=>{it(e,"Add",(t,r)=>`${t}+${r}`)},ic=e=>{it(e,"Div",(t,r)=>`${t}/${r}`)},rc=e=>{it(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},ac=e=>{it(e,"Mul",(t,r)=>`${t}*${r}`)},nc=e=>{let t=P("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;it(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},sc=e=>{it(e,"Sub",(t,r)=>`${t}-${r}`)},oc=e=>{it(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},uc=e=>{it(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},lc=e=>{it(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},dc=e=>{it(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),Ko,Zo,Qo,Yo,pc,cc,Ym=L(()=>{"use strict";se(),oe(),Ee(),ue(),Ko=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],a=i.dataType,s=i.dims.length;e.forEach((o,u)=>{if(u!==r){if(o.dataType!==a)throw new Error("input tensors should be one type");if(o.dims.length!==s)throw new Error("input tensors should have the same shape");o.dims.forEach((d,p)=>{if(p!==t&&d!==i.dims[p])throw new Error("non concat dimensions must match")})}})},Zo=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,Qo=(e,t)=>{let r=e.length,i=[];for(let a=0;a<r;++a){let s=t.setByOffset("global_idx",e[a].getByIndices("indices"));r===1?i.push(s):a===0?i.push(`if (inputIndex == ${a}u) { ${s} }`):a===r-1?i.push(`else { ${s} }`):i.push(`else if (inputIndex == ${a}) { ${s} }`)}return i.join(`
`)},Yo=(e,t,r,i)=>{let a=O.size(r),s=new Array(e.length),o=new Array(e.length),u=0,d=[],p=[],f=[{type:12,data:a}];for(let $=0;$<e.length;++$)u+=e[$].dims[t],s[$]=u,p.push(e[$].dims.length),o[$]=P(`input${$}`,i,p[$]),d.push("rank"),f.push({type:12,data:s[$]});for(let $=0;$<e.length;++$)f.push(...ae(e[$].dims));f.push(...ae(r));let m=ee("output",i,r.length),g=m.indicesGet("indices",t),b=Array.from(Array(s.length).keys()).map($=>`uniforms.sizeInConcatAxis${$}`).join(","),_=$=>`

  ${(()=>{$.registerUniform("outputSize","u32");for(let x=0;x<e.length;x++)$.registerUniform(`sizeInConcatAxis${x}`,"u32");return $.declareVariables(...o,m)})()}

  ${Zo(s.length,b)}

  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${m.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${g});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${s.length}u>(${b});
      ${g} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${Qo(o,m)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:f}),getShaderSource:_}},pc=(e,t)=>{let r=e.inputs,i=r[0].dims,a=O.normalizeAxis(t.axis,i.length);Ko(r,a);let s=i.slice();s[a]=r.reduce((u,d)=>u+(d.dims.length>a?d.dims[a]:0),0);let o=r.filter(u=>O.size(u.dims)>0);e.compute(Yo(o,a,s,r[0].dataType),{inputs:o})},cc=e=>we({axis:e.axis})}),qt,Wt,Lt,on,Gt=L(()=>{"use strict";se(),oe(),qt=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},Wt=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Lt=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},on=e=>{let t=e?.activation||"";if(t==="HardSigmoid"){let[r,i]=e?.activation_params||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=e?.activation_params||[Pd,Ud];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=e?.activation_params||[.01];return{activation:t,alpha:r}}return{activation:t}}}),Ne,fc,un=L(()=>{"use strict";Ne=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},fc=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),hc,Xm=L(()=>{"use strict";hc=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),xi,ln,dn=L(()=>{"use strict";se(),oe(),ue(),Gt(),xi=(e,t,r,i,a)=>{let s=i-r;return`
      ${Array.from({length:r}).map((o,u)=>`
      if (${ie(t.shape,u,t.rank)} != 1) {
        ${t.indicesSet(e,u,ie(a,u+s,i))}
      } else {
        ${t.indicesSet(e,u,0)}
      }`).join("")}
`},ln=(e,t,r,i,a=!1,s)=>{let o=e[0].dims,u=e[1].dims,d=o[o.length-2],p=u[u.length-1],f=o[o.length-1],m=Ce(p),g=Ce(f),b=Ce(d),_=O.size(r)/m/b,$=e.length>2,x=i?i.slice(0,-2):r.slice(0,-2),v=[O.size(x),d,p],w=[{type:12,data:_},{type:12,data:d},{type:12,data:p},{type:12,data:f}];Wt(t,w),w.push(...ae(x,o,u)),$&&w.push(...ae(e[2].dims)),w.push(...ae(v));let k=C=>{let T=rn("batch_dims",e[0].dataType,x.length),E=P("a",e[0].dataType,o.length,g),I=P("b",e[1].dataType,u.length,m),A=ee("output",e[0].dataType,v.length,m),U=Ae(A.type.tensor),W=qt(t,A.type.value,U),F=[E,I],H="";if($){let X=a?m:1;F.push(P("bias",e[2].dataType,e[2].dims.length,X)),H=`${a?`value += bias[col / ${X}];`:`value += ${A.type.value}(bias[row + i]);`}`}let te=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Lt(t,te);let V=()=>{let X=`var a_data: ${E.type.value};`;for(let Z=0;Z<g;Z++)X+=`
              let b_data${Z} = b[(b_offset + (k + ${Z}) * uniforms.N + col) / ${m}];`;for(let Z=0;Z<b;Z++){X+=`a_data = a[(a_offset + (row + ${Z}) * uniforms.K + k) / ${g}];`;for(let K=0;K<g;K++)X+=`
            values[${Z}] = fma(${I.type.value}(a_data${g===1?"":`[${K}]`}), b_data${K}, values[${Z}]);
`}return X};return`
  ${C.registerUniforms(te).registerInternalVariables(T).declareVariables(...F,A)}
  ${C.mainStart()}
    ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${m})) * ${m};
    var index1 = global_idx / (uniforms.N / ${m});
    let stride1 = uniforms.M / ${b};
    let row = (index1 % stride1) * ${b};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${T.offsetToIndices("batch")};`}

    var a_indices: ${E.type.indices};
    ${xi("a_indices",E,E.rank-2,T.rank,"batch_indices")}
    ${E.indicesSet("a_indices",E.rank-2,0)}
    ${E.indicesSet("a_indices",E.rank-1,0)}
    let a_offset = ${E.indicesToOffset("a_indices")};

    var b_indices: ${I.type.indices};
    ${xi("b_indices",I,I.rank-2,T.rank,"batch_indices")}
    ${I.indicesSet("b_indices",I.rank-2,0)}
    ${I.indicesSet("b_indices",I.rank-1,0)}
    let b_offset = ${I.indicesToOffset("b_indices")};
    var values: array<${A.type.value}, ${b}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${g}) {
      ${V()}
    }
    for (var i = 0u; i < ${b}u; i++) {
      var value = values[i];
      ${H}
      ${W}
      let cur_indices = ${A.type.indices}(batch, row + i, col);
      let offset = ${A.indicesToOffset("cur_indices")};
      ${A.setByOffset(`offset / ${m}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${m};${g};${b};${a}`,inputDependencies:$?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:s?s(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:w}),getShaderSource:k}}}),Xo,Jo,Da,ea,eu,Pa,tu,nr,pn=L(()=>{"use strict";se(),oe(),ue(),Gt(),dn(),un(),Xo=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,Jo=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,Da=(e,t,r="f32",i,a=!1,s=32,o=!1,u=32)=>{let d=t[1]*e[1],p=t[0]*e[0],f=a?d:s,m=a?s:d,g=f/t[0],b=s/t[1];if(!((a&&g===4&&e[1]===4||!a&&(g===3||g===4))&&f%t[0]===0&&s%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${a} is true, innerElementSize ${g} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${g} must be 3 or 4.
  tileAWidth ${f} must be divisible by workgroupSize[0]${t[0]}. tileInner ${s} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${g}<${r}>, ${f/g}>, ${m}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${p/e[0]}>, ${s}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${g};
const tileInner = ${s};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${o?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${d};

  let num_tiles = ${o?`${Math.ceil(u/s)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${o?`i32(globalId.z) * ${u}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${b};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${Xo(a,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${g===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${Jo(a,g)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},ea=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,eu=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",Pa=(e,t,r="f32",i,a=!1,s=32,o=!1,u=32,d=!1)=>{let p=e[1]*t[1],f=e[0]*t[0],m=a?p:s,g=a?s:p;if(!(g%t[1]===0&&m%t[0]===0&&s%t[1]===0))throw new Error(`tileAHight ${g} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${m} must be divisible by workgroupSize[0]${t[0]}, tileInner ${s} must be divisible by workgroupSize[1]${t[1]}`);let b=g/t[1],_=m/t[0],$=s/t[1],x=d?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${p};
    let globalColStart = i32(workgroupId.x) * ${f};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${g}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${m}; inputCol = inputCol + ${t[0]}) {
          ${ea(a,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${s}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${f}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${a?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${p};

let tileRowA = i32(localId.y) * ${b};
let tileColA = i32(localId.x) * ${_};
let tileRowB = i32(localId.y) * ${$};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${_}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${ea(a,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${$}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${eu(a)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${m}>, ${g}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${f}>, ${s}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${s};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${o?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${o?`${Math.ceil(u/s)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${o?`i32(globalId.z) * ${u}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${x}
  }
`},tu=(e,t,r,i,a=!1)=>{let[s,o,u,d]=i,p=Ae(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${s.type.indices}) -> ${Ne(e,p)} {
      var value = ${Ne(e,p)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${o.type.indices};
        ${xi("aIndices",o,o.rank-2,s.rank,"batchIndices")}
        ${o.indicesSet("aIndices",o.rank-2,"u32(row)")}
        ${o.indicesSet("aIndices",o.rank-1,"u32(colIn)")}
        value = ${o.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${s.type.indices}) -> ${Ne(e,p)} {
      var value = ${Ne(e,p)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${u.type.indices};
        ${xi("bIndices",u,u.rank-2,s.rank,"batchIndices")}
        ${u.indicesSet("bIndices",u.rank-2,"u32(row)")}
        ${u.indicesSet("bIndices",u.rank-1,"u32(colIn)")}
        value = ${u.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ne(e,p)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${a?"bias[colIn]":`${Ne(e,p)}(bias[row])`};`:""}
        ${r}
        ${d.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},nr=(e,t,r,i,a=!1,s)=>{let o=e[0].dims,u=e[1].dims,d=o.slice(0,-2),p=u.slice(0,-2),f=i?i.slice(0,-2):r.slice(0,-2),m=O.size(f),g=o[o.length-2],b=o[o.length-1],_=u[u.length-1],$=b%4===0&&_%4===0,x=g<=8?[4,1,1]:[4,4,1],v=[8,8,1],w=[Math.ceil(_/v[0]/x[0]),Math.ceil(g/v[1]/x[1]),Math.ceil(m/v[2]/x[2])],k=$?4:1,C=[...d,g,b/k],T=C.length,E=[...p,b,_/k],I=E.length,A=[m,g,_/k],U=[{type:6,data:g},{type:6,data:_},{type:6,data:b}];Wt(t,U),U.push(...ae(f,C,E));let W=["rank","rank"],F=e.length>2;F&&(U.push(...ae(e[2].dims)),W.push("rank")),U.push(...ae(A));let H=te=>{let V=f.length,X=rn("batchDims",e[0].dataType,V,1),Z=Ae(e[0].dataType),K=P("a",e[0].dataType,T,k),re=P("b",e[1].dataType,I,k),j=ee("result",e[0].dataType,A.length,k),le=[K,re];if(F){let B=a?k:1;le.push(P("bias",e[2].dataType,e[2].dims.length,B))}let N=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Lt(t,N);let M=Ae(j.type.tensor),Y=qt(t,j.type.value,M),pe=tu(k,F,Y,[X,K,re,j],a);return`
  ${te.registerUniforms(N).registerInternalVariables(X).declareVariables(...le,j)}
  ${pe}
  ${$?Da(x,v,Z,X):Pa(x,v,Z,X)}
                   `};return{name:"MatMul",shaderCache:{hint:`${x};${t.activation};${$};${a}`,inputDependencies:W},getRunData:()=>({outputs:[{dims:s?s(r):r,dataType:e[0].dataType}],dispatchGroup:{x:w[0],y:w[1],z:w[2]},programUniforms:U}),getShaderSource:H}}}),iu,mc,Jm=L(()=>{"use strict";se(),_t(),ue(),Gt(),un(),Xm(),pn(),iu=(e,t,r,i,a=!1,s,o=4,u=4,d=4,p="f32")=>{let f=U=>{switch(U){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${p}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${U} is not supported.`)}},m=U=>{switch(U){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${U} is not supported.`)}},g=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,b=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,_=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",$=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",x=e?"row":"col",v=e?"col":"row",w=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${x} / outWidth;
    let outCol = ${x} % outWidth;

    let WRow = ${v} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${v} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${v} % inChannels;
    var resData = ${Ne(o,p)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${_} && xCol >= 0 && xCol < ${$}) {
      ${g}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${f(o)}
    }
    return resData;`,k=e?t&&i?`
    let col = colIn * ${o};
    ${w}`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${w}
    }
    return ${Ne(o,p)}(0.0);`:i&&r?`
    let col = colIn * ${o};
    ${w}`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${w}
    }
    return ${Ne(o,p)}(0.0);`,C=e?i&&r?m(u):`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${m(u)}
    }
    return ${Ne(u,p)}(0.0);`:`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${m(u)}
    }
    return ${Ne(u,p)}(0.0);`,T=Ne(d,p),E=Ne(e?o:u,p),I=Ne(e?u:o,p),A=qt(s,T,p);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${E} {
      ${e?k:C}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${I} {
      ${e?C:k}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${T}) {
      let col = colIn * ${d};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${b}
      ${fc(a)}
      ${A}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},mc=(e,t,r,i,a,s,o,u,d)=>{let p=t.format==="NHWC",f=p?e[0].dims[3]:e[0].dims[1],m=r[0],g=p?r[2]:r[3],b=p?r[1]:r[2],_=p?r[3]:r[1],$=p&&(f%4===0||f%3===0)&&_%4===0,x=p?_:g*b,v=p?g*b:_,w=[8,8,1],k=i<=8?[4,1,1]:[4,4,1],C=[Math.ceil(x/w[0]/k[0]),Math.ceil(v/w[1]/k[1]),Math.ceil(m/w[2]/k[2])];me("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${C}`);let T=$?p&&f%4!==0?3:4:1,E=w[1]*k[1],I=w[0]*k[0],A=Math.max(w[0]*T,w[1]),U=i%E===0,W=a%I===0,F=s%A===0,H=$?[T,4,4]:[1,1,1],te=[{type:6,data:i},{type:6,data:a},{type:6,data:s},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Wt(t,te),te.push(...ae(e[0].dims,e[1].dims));let V=["rank","rank"];o&&(te.push(...ae(e[2].dims)),V.push("rank")),te.push(...ae(r));let X=Z=>{let K=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Lt(t,K);let re=$?4:1,j=Ae(e[0].dataType),le=`
      fn setOutputAtIndex(flatIndex : i32, value : ${$?`vec4<${j}>`:j}) {
        result[flatIndex] = ${$?`vec4<${j}>`:j}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${$?`vec4<${j}>`:j}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${$?"/ 4":""}, value);
      }`,N=P("x",e[0].dataType,e[0].dims.length,T===3?1:T),M=P("w",e[1].dataType,e[1].dims.length,re),Y=[N,M],pe=ee("result",e[0].dataType,r.length,re);if(o){let B=P("bias",e[2].dataType,e[2].dims.length,re);Y.push(B),le+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${$?`vec4<${j}>`:j} {
          return bias[coords.${p?"w":"y"}${$?"/ 4":""}];
        }`}return`
        ${hc("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${Z.registerUniforms(K).declareVariables(...Y,pe)}
        ${le}
        ${iu(p,U,W,F,o,t,H[0],H[1],H[2],j)}
        ${$?Da(k,w,j,void 0,!p,A):Pa(k,w,j,void 0,!p,A,!1,void 0,u)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${T};${$};${U};${W};${F};${E};${I};${A}`,inputDependencies:V},getRunData:()=>({outputs:[{dims:d?d(r):r,dataType:e[0].dataType}],dispatchGroup:{x:C[0],y:C[1],z:C[2]},programUniforms:te}),getShaderSource:X}}}),ru,ta,fi,au,ia,nu,gc,_c,eg=L(()=>{"use strict";se(),_t(),oe(),ue(),Gt(),un(),ru=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},ta=e=>typeof e=="number"?[e,e,e]:e,fi=(e,t)=>t<=1?e:e+(e-1)*(t-1),au=(e,t,r,i=1)=>{let a=fi(t,i);return Math.floor((e[0]*(r-1)-r+a)/2)},ia=(e,t,r,i,a)=>{a==null&&(a=au(e,t[0],i[0]));let s=[0,0,0,r];for(let o=0;o<3;o++)e[o]+2*a>=t[o]&&(s[o]=Math.trunc((e[o]-t[o]+2*a)/i[o]+1));return s},nu=(e,t,r,i,a,s,o,u,d,p)=>{let f,m,g,b;if(e==="VALID"&&(e=0),typeof e=="number"){f={top:e,bottom:e,left:e,right:e,front:e,back:e};let _=ia([t,r,i,1],[u,d,p],1,[a,s,o],e);m=_[0],g=_[1],b=_[2]}else if(Array.isArray(e)){if(!e.every(($,x,v)=>$===v[0]))throw Error(`Unsupported padding parameter: ${e}`);f={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let _=ia([t,r,i,1],[u,d,p],1,[a,s,o],e[0]);m=_[0],g=_[1],b=_[2]}else if(e==="SAME_UPPER"){m=Math.ceil(t/a),g=Math.ceil(r/s),b=Math.ceil(i/o);let _=(m-1)*a+u-t,$=(g-1)*s+d-r,x=(b-1)*o+p-i,v=Math.floor(_/2),w=_-v,k=Math.floor($/2),C=$-k,T=Math.floor(x/2),E=x-T;f={top:k,bottom:C,left:T,right:E,front:v,back:w}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:f,outDepth:m,outHeight:g,outWidth:b}},gc=(e,t,r,i,a,s=!1,o="channelsLast")=>{let u,d,p,f,m;if(o==="channelsLast")[u,d,p,f,m]=e;else if(o==="channelsFirst")[u,m,d,p,f]=e;else throw new Error(`Unknown dataFormat ${o}`);let[g,,b,_,$]=t,[x,v,w]=ta(r),[k,C,T]=ta(i),E=fi(b,k),I=fi(_,C),A=fi($,T),{padInfo:U,outDepth:W,outHeight:F,outWidth:H}=nu(a,d,p,f,x,v,w,E,I,A),te=s?g*m:g,V=[0,0,0,0,0];return o==="channelsFirst"?V=[u,te,W,F,H]:o==="channelsLast"&&(V=[u,W,F,H,te]),{batchSize:u,dataFormat:o,inDepth:d,inHeight:p,inWidth:f,inChannels:m,outDepth:W,outHeight:F,outWidth:H,outChannels:te,padInfo:U,strideDepth:x,strideHeight:v,strideWidth:w,filterDepth:b,filterHeight:_,filterWidth:$,effectiveFilterDepth:E,effectiveFilterHeight:I,effectiveFilterWidth:A,dilationDepth:k,dilationHeight:C,dilationWidth:T,inShape:e,outShape:V,filterShape:t}},_c=(e,t,r,i,a,s)=>{let o=s==="channelsLast",u=o?e[0].dims[3]:e[0].dims[1],d=!1,p=[64,1,1],f={x:r.map((w,k)=>k)},m=[Math.ceil(ru(f.x.map(w=>r[w]))/p[0]),1,1];me("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${m}`);let g=d?o&&u%4!==0?3:4:1,b=O.size(r),_=[{type:12,data:b},{type:12,data:i},{type:12,data:a},{type:12,data:t.strides},{type:12,data:t.dilations}];Wt(t,_),_.push(...ae(e[0].dims,e[1].dims));let $=["rank","rank"],x=e.length===3;x&&(_.push(...ae(e[2].dims)),$.push("rank")),_.push(...ae(r));let v=w=>{let k=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:a.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Lt(t,k);let C=d?4:1,T=Ae(e[0].dataType),E=P("x",e[0].dataType,e[0].dims.length,g===3?1:g),I=P("W",e[1].dataType,e[1].dims.length,C),A=[E,I],U=ee("result",e[0].dataType,r.length,C),W="";if(x){let te=P("bias",e[2].dataType,e[2].dims.length,C);A.push(te),W+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${d?`vec4<${T}>`:T} {
          return bias[${o?ie("coords",4,5):ie("coords",1,5)}${d?"/ 4":""}];
        }`}let F=Ne(g,T),H=qt(t,F,T);return`
            ${W}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${E.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${I.getByIndices("aIndices")};
            }
          ${w.registerUniforms(k).declareVariables(...A,U)}
          ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${U.offsetToIndices("global_idx")};
              let batch = ${ie("coords",0,E.rank)};
              let d2 = ${o?ie("coords",E.rank-1,E.rank):ie("coords",1,E.rank)};
              let xFRCCorner = vec3<u32>(${o?ie("coords",1,E.rank):ie("coords",2,E.rank)},
              ${o?ie("coords",2,E.rank):ie("coords",3,E.rank)},
              ${o?ie("coords",3,E.rank):ie("coords",4,E.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${o?ie("uniforms.x_shape",1,E.rank):ie("uniforms.x_shape",2,E.rank)};
              let xShapeZ = ${o?ie("uniforms.x_shape",2,E.rank):ie("uniforms.x_shape",3,E.rank)};
              let xShapeW = ${o?ie("uniforms.x_shape",3,E.rank):ie("uniforms.x_shape",4,E.rank)};
              let xShapeU = ${o?ie("uniforms.x_shape",4,E.rank):ie("uniforms.x_shape",1,E.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${o?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${o?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${o?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${o?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${x?"value = value + getBiasByOutputCoords(coords)":""};
              ${H}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${o};${g};${x}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:m[0],y:m[1],z:m[2]},programUniforms:_}),getShaderSource:v}}}),yc,bc,tg=L(()=>{"use strict";se(),oe(),ue(),Gt(),yc=(e,t,r,i)=>{let a=e.length>2,s=a?"value += b[output_channel];":"",o=e[0].dims,u=e[1].dims,d=t.format==="NHWC",p=d?r[3]:r[1],f=p/t.group,m=d&&f>=4?Ce(p):1,g=O.size(r)/m,b=[{type:12,data:g},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:f}];Wt(t,b),b.push(...ae(o,[u[0],u[1],u[2],u[3]/m]));let _=a?["rank","rank","rank"]:["rank","rank"];b.push(...ae([r[0],r[1],r[2],r[3]/m]));let $=x=>{let v=ee("output",e[0].dataType,r.length,m),w=Ae(v.type.tensor),k=qt(t,v.type.value,w),C=P("x",e[0].dataType,o.length),T=P("w",e[1].dataType,u.length,m),E=[C,T];a&&E.push(P("b",e[2].dataType,e[2].dims,m));let I=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Lt(t,I);let A=d?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${C.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${T.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${C.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${T.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${x.registerUniforms(I).declareVariables(...E,v)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${v.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${d?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${d?1:2}], outputIndices[${d?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${m} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${d?2:1}];

    var value: ${v.type.value} = ${v.type.value}(0);
    ${A}
    ${s}
    ${k}
    ${v.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${m}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:b}),getShaderSource:$}},bc=(e,t,r,i)=>{let a=e.length>2,s=Ce(r[3]),o=Ce(r[2]),u=O.size(r)/s/o,d=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/s],p=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/s],f=[r[0],r[1],r[2],r[3]/s],m=[{type:12,data:u},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Wt(t,m),m.push(...ae(d,p,f));let g=(o-1)*t.strides[1]+p[1],b=_=>{let $=ee("output",e[0].dataType,f.length,s),x=Ae($.type.tensor),v=qt(t,$.type.value,x),w=P("x",e[0].dataType,d.length,s),k=P("w",e[1].dataType,p.length,s),C=[w,k];a&&C.push(P("b",e[2].dataType,e[2].dims,s));let T=a?"value += b[output_channel];":"",E=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Lt(t,E),`
  ${_.registerUniforms(E).declareVariables(...C,$)}
  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${o}u;
    let col = (index1 % width1) * ${o}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${w.type.value}, ${g}>;
    var values: array<${$.type.value}, ${o}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${p[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${g}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${w.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${w.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${p[1]}; w_width++) {
          let w_val = ${k.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${o}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${o}u; i++) {
      var value = values[i];
      ${T}
      ${v}
      ${$.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${s};${o};${g};${p[0]};${p[1]}`,inputDependencies:a?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:m}),getShaderSource:b}}}),su,Hi,ou,Ki,Ua,ra,uu,lu,qa,ig=L(()=>{"use strict";oe(),Jm(),eg(),pn(),tg(),Gt(),dn(),Ct(),su=(e,t,r,i,a,s)=>{let o=e[0],u=e.slice(s?1:2,s?3:4),d=u.length,p=t[0],f=t.slice(2).map((g,b)=>g+(g-1)*(r[b]-1)),m=u.map((g,b)=>g+i[b]+i[b+d]).map((g,b)=>Math.floor((g-f[b]+a[b])/a[b]));return m.splice(0,0,o),m.splice(s?3:1,0,p),m},Hi=[2,3,1,0],ou=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Ki=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let s=2;s<t[1].dims.length;++s)r[s-2]===0&&(r[s-2]=t[1].dims[s]);let i=e.pads.slice();rr.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let a=Object.assign({},e);return Object.assign(a,{kernelShape:r,pads:i}),a},Ua=e=>{let t=on(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],a=e.dilations,s=e.group,o=e.kernel_shape,u=e.pads,d=e.strides,p=e.w_is_const();return{autoPad:i,format:r,dilations:a,group:s,kernelShape:o,pads:u,strides:d,wIsConst:p,...t,cacheKey:`${e.format};${t.activation};`}},ra=(e,t,r,i)=>{let a=r.format==="NHWC",s=su(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,a);if(r.group!==1){let E=[t[0]];if(a){let I=e.kernelCustomData.wT??e.compute(Ge(t[1],Hi),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=I),E.push(I)}else E.push(t[1]);t.length===3&&E.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&a&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(bc(E,r,s,i),{inputs:E}):e.compute(yc(E,r,s,i),{inputs:E});return}let o=t.length===3,u=t[0].dims[a?1:2],d=t[0].dims[a?2:3],p=t[0].dims[a?3:1],f=t[1].dims[2],m=t[1].dims[3],g=s[a?1:2],b=s[a?2:3],_=s[a?3:1],$=a&&f===u&&m===d&&r.pads[0]===0&&r.pads[1]===0;if($||f===1&&m===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let E=s[0],I,A,U,W=[];if(a){let te=e.kernelCustomData.wT??e.compute(Ge(t[1],Hi),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=te),$){let V=u*d*p;I=t[0].reshape([1,E,V]),A=te.reshape([1,V,_]),U=[1,E,_]}else I=t[0].reshape([E,u*d,p]),A=te.reshape([1,p,_]),U=[E,g*b,_];W.push(I),W.push(A)}else I=t[0].reshape([E,p,u*d]),A=t[1].reshape([1,_,p]),U=[E,_,g*b],W.push(A),W.push(I);o&&W.push(t[2]);let F=U[2],H=W[0].dims[W[0].dims.length-1];F<8&&H<8?e.compute(ln(W,r,s,U,a,i),{inputs:W}):e.compute(nr(W,r,s,U,a,i),{inputs:W});return}let x=!0,v=e.kernelCustomData.wT??e.compute(Ge(t[1],Hi),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=v);let w=[t[0],v];o&&w.push(t[2]);let k=a?g*b:_,C=a?_:g*b,T=f*m*p;e.compute(mc(w,r,s,k,C,T,o,x,i),{inputs:w})},uu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=[0,t.pads[0],0,t.pads[1]],s=[1].concat(t.strides),o=[1].concat(t.dilations),u=[1].concat(t.kernelShape),d=Ki({...t,pads:a,strides:s,dilations:o,kernelShape:u},i);ra(e,i,d,p=>r?[p[0],p[2],p[3]]:[p[0],p[1],p[3]])},lu=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",a=Ki(r,t),s=r.autoPad==="NOTSET"?r.pads:r.autoPad,o=gc(t[0].dims,t[1].dims,r.strides,r.dilations,s,!1,i);e.compute(_c(t,a,o.outShape,[o.filterDepth,o.filterHeight,o.filterWidth],[o.padInfo.front,o.padInfo.top,o.padInfo.left],i))},qa=(e,t)=>{if(ou(e.inputs,t),e.inputs[0].dims.length===3)uu(e,t);else if(e.inputs[0].dims.length===5)lu(e,e.inputs,t);else{let r=Ki(t,e.inputs);ra(e,e.inputs,r)}}}),wc,rg=L(()=>{"use strict";se(),_t(),oe(),ue(),wc=(e,t,r)=>{let i=e.length>2,a=t.outputShape,s=t.format==="NHWC",o=t.group,u=e[1].dims,d=u[2]/o,p=u[3],f=s?Ce(d):1,m=s&&p===1&&d>=4,g=m?Math.floor(d/4)*4:Math.floor(d/f)*f,b=d-g,_=s?Ce(p):1,$=s?p===1?f:_:1,x=O.size(a)/_,v=[Math.ceil(x/64),1,1];me("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${v}`);let w=["rank","rank"],k=[t.strides[0],t.strides[1]],C=[t.kernelShape[s?1:2],t.kernelShape[s?2:3]],T=[t.dilations[0],t.dilations[1]],E=[C[0]+(t.dilations[0]<=1?0:(t.kernelShape[s?1:2]-1)*(t.dilations[0]-1)),C[1]+(t.dilations[1]<=1?0:(t.kernelShape[s?2:3]-1)*(t.dilations[1]-1))],I=[E[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),E[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],A=[{type:12,data:x},{type:12,data:k},{type:12,data:C},{type:12,data:T},{type:12,data:E},{type:6,data:I},{type:12,data:g},{type:12,data:d},{type:12,data:p},...ae(e[0].dims,e[1].dims)];i&&(A.push(...ae(e[2].dims)),w.push("rank")),A.push(...ae(a));let U=W=>{let F=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:k.length},{name:"filter_dims",type:"u32",length:C.length},{name:"dilations",type:"u32",length:C.length},{name:"effective_filter_dims",type:"u32",length:E.length},{name:"pads",type:"i32",length:I.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],H=Ae(e[0].dataType),te=s?1:2,V=s?2:3,X=s?3:1,Z=P("W",e[1].dataType,e[1].dims.length,$),K=P("Dy",e[0].dataType,e[0].dims.length,f),re=[K,Z];i&&re.push(P("bias",e[2].dataType,[a[X]].length,_));let j=ee("result",e[0].dataType,a.length,_),le=()=>{let Y="";if(m)f===4?Y+=`
        let xValue = ${K.getByOffset("x_offset")};
        let wValue = ${Z.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:f===2?Y+=`
          dotProd = dotProd + dot(vec4<${H}>(${K.getByOffset("x_offset")}, ${K.getByOffset("x_offset + 1u")}), vec4<${H}>(${Z.getByOffset("w_offset")}, ${Z.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:f===1&&(Y+=`
          dotProd = dotProd + dot(vec4<${H}>(${K.getByOffset("x_offset")}, ${K.getByOffset("x_offset + 1u")}, ${K.getByOffset("x_offset + 2u")}, ${K.getByOffset("x_offset + 3u")}), vec4<${H}>(${Z.getByOffset("w_offset")}, ${Z.getByOffset("w_offset + 1u")}, ${Z.getByOffset("w_offset + 2u")}, ${Z.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(Y+=`
                  let xValue = ${s?K.getByOffset(`${K.indicesToOffset(`${K.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${f}`):K.get("batch","inputChannel","idyR","idyC")};
        `,f===1)Y+=`
          let w_offset = ${Z.indicesToOffset(`${Z.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${Z.getByOffset(`w_offset / ${$}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let pe=0;pe<f;pe++)Y+=`
            let wValue${pe} = ${Z.getByOffset(`${Z.indicesToOffset(`${Z.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${pe}, wOutChannel)`)} / ${$}`)};
            dotProd = dotProd + xValue[${pe}] * wValue${pe};`;return Y},N=()=>{if(b===0)return"";if(!m)throw new Error(`packInputAs4 ${m} is not true.`);let Y="";if(f===1){Y+="dotProd = dotProd";for(let pe=0;pe<b;pe++)Y+=`
            + ${K.getByOffset(`x_offset + ${pe}`)} * ${Z.getByOffset(`w_offset + ${pe}`)}`;Y+=";"}else if(f===2){if(b!==2)throw new Error(`Invalid inputChannelsRemainder ${b}.`);Y+=`
          let xValue = ${K.getByOffset("x_offset")};
          let wValue = ${Z.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return Y},M=`
            let outputIndices = ${j.offsetToIndices(`global_idx * ${_}`)};
            let batch = ${j.indicesGet("outputIndices",0)};
            let d1 = ${j.indicesGet("outputIndices",X)};
            let r = ${j.indicesGet("outputIndices",te)};
            let c = ${j.indicesGet("outputIndices",V)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${j.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${H}(dyRCorner) + ${H}(wR)) / ${H}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${H}(uniforms.Dy_shape[${te}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${H}(dyCCorner) + ${H}(wC)) / ${H}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${H}(uniforms.Dy_shape[${V}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${m?`
                var x_offset = ${K.indicesToOffset(`${K.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${f};
                var w_offset = ${Z.indicesToOffset(`${Z.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${$};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${m?4:f}) {
                  ${le()}
                  inputChannel = inputChannel + ${m?4:f};
                }
                ${N()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${_}]`:""};
            ${j.setByOffset("global_idx","value")};
          `;return`
    ${W.registerUniforms(F).declareVariables(...re,j)}
      ${W.mainStart()}
      ${W.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${M}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${f}${$}${_}${m}${b}`,inputDependencies:w},getRunData:()=>({dispatchGroup:{x:v[0],y:v[1],z:v[2]},outputs:[{dims:r?r(a):a,dataType:e[0].dataType}],programUniforms:A}),getShaderSource:U}}}),du,pu,cu,aa,$c,fu,na,hu,vc,ag=L(()=>{"use strict";rg(),Gt(),Ct(),du=(e,t,r,i,a,s)=>(e-1)*t+r+(i-1)*a+1-s,pu=(e,t,r,i,a)=>{let s=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=s,r[a]=e-s):t==="SAME_LOWER"&&(r[i]=e-s,r[a]=s)},cu=(e,t,r,i,a,s,o,u,d,p)=>{let f=e.length-2,m=p.length===0;d.length<f&&d.push(...Array(f-d.length).fill(0));let g=e[0],b=t[u?3:1]*a;for(let _=0,$=e.length-f-(u?1:0);_<f;++_,++$){let x=e[$],v=m?x*o[_]:p[_],w=du(x,o[_],s[_],t[$],r[_],v);pu(w,i,s,_,_+f),m&&p.push(o[_]*(x-1)+d[_]+(t[$]-1)*r[_]+1-s[_]-s[_+f])}p.splice(0,0,g),p.splice(u?3:1,0,b)},aa=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((m,g)=>m*g,1)===0){r.length=0;for(let m=2;m<t[1].dims.length;++m)r.push(t[1].dims[m])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let a=e.pads.slice(),s=e.outputShape.slice(),o=e.outputPadding.slice(),u=t[0].dims,d=e.dilations.slice();if(d.reduce((m,g)=>m+g,0)===0){let m=t[0].dims.length-2;d=new Array(m).fill(1)}let p=e.strides.slice();if(p.reduce((m,g)=>m+g,0)===0){let m=t[0].dims.length-2;p=new Array(m).fill(1)}cu(u,r,d,e.autoPad,e.group,a,p,i,o,s);let f=Object.assign({},e);return Object.assign(f,{kernelShape:r,pads:a,outputPadding:o,outputShape:s,dilations:d,strides:p}),f},$c=e=>{let t=on(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],a=e.dilations,s=e.group,o=e.kernelShape,u=e.pads,d=e.strides,p=e.wIsConst(),f=e.outputPadding,m=e.outputShape;return{autoPad:i,format:r,dilations:a,group:s,kernelShape:o,outputPadding:f,outputShape:m,pads:u,strides:d,wIsConst:p,...t,cacheKey:`${e.format};${t.activation};`}},fu=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let a=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==a))throw new Error("invalid bias");let s=e[0].dims.length-2;if(t.dilations.reduce((o,u)=>o+u,0)>0&&t.dilations.length!==s)throw new Error(`dilations should be ${s}D`);if(t.strides.reduce((o,u)=>o+u,0)>0&&t.strides.length!==s)throw new Error(`strides should be ${s}D`);if(t.pads.reduce((o,u)=>o+u,0)>0&&t.pads.length!==s*2)throw new Error(`pads should be ${s*2}D`);if(t.outputPadding.length!==s&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${s}D`);if(t.kernelShape.reduce((o,u)=>o+u,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},na=(e,t,r,i)=>{let a=e.kernelCustomData.wT??e.compute(Ge(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let s=[t[0],a];t.length===3&&s.push(t[2]),e.compute(wc(s,r,i),{inputs:s})},hu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=t.kernelShape;(a.length===0||a[0]===0)&&(a=[e.inputs[1].dims[2]]);let s=t.dilations;(s.length===0||s[0]===0)&&(s=[1]);let o=t.strides;(o.length===0||o[0]===0)&&(o=[1]);let u=t.pads;u.length===0&&(u=[0,0]),u=[0,u[0],0,u[1]],o=[1].concat(o),s=[1].concat(s),a=[1].concat(a);let d=t.outputPadding;d=[0].concat(d);let p=aa({...t,pads:u,strides:o,dilations:s,kernelShape:a,outputPadding:d},i);na(e,i,p,f=>r?[f[0],f[2],f[3]]:[f[0],f[1],f[3]])},vc=(e,t)=>{if(fu(e.inputs,t),e.inputs[0].dims.length===3)hu(e,t);else{let r=aa(t,e.inputs);na(e,e.inputs,r)}}}),mu,xc,Tc,ng=L(()=>{"use strict";se(),oe(),Ee(),ue(),mu=(e,t,r,i)=>{let a=O.size(t),s=t.length,o=P("input",e,s),u=ee("output",e,s),d=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),p=O.normalizeAxis(d,s),f=m=>{let g=` i32(${o.indicesGet("inputIndices","uniforms.axis")}) `,b=ie("uniforms.input_shape","uniforms.axis",s),_=i.reverse?g+(i.exclusive?" + 1":""):"0",$=i.reverse?b:g+(i.exclusive?"":" + 1");return`
                ${m.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(o,u)}
                ${m.mainStart()}
                  ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${u.offsetToIndices("global_idx")};
                  var sum = ${u.type.value}(0);
                  let first : i32 = ${_};
                  let last : i32 = ${$};
                  for (var i : i32 = first; i < last; i++) {
                    ${o.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${o.getByIndices("inputIndices")};
                  }
                  ${u.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},{type:12,data:p},...ae(t,t)]}),getShaderSource:f}},xc=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,a=e.inputs[1];e.compute(mu(i,r,a,t),{inputs:[0]})},Tc=e=>{let t=e.exclusive===1,r=e.reverse===1;return we({exclusive:t,reverse:r})}}),gu,_u,yu,Sc,Cc,sg=L(()=>{"use strict";se(),oe(),Ee(),ue(),gu=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},_u=(e,t,r,i)=>{let a=[];a.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let s=0;s<t;++s)a.push(r.indicesSet("a",e[s],`i[${s}]`));return a.push("return a;}"),a.join(`
`)},yu=(e,t)=>{let r,i,a,s,o,u,d=t.format==="NHWC",p=t.blocksize,f=t.mode==="DCR";d?([r,i,a,s]=e.dims,o=f?[r,i,a,p,p,s/p**2]:[r,i,a,s/p**2,p,p],u=f?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,a,s]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],o=f?[r,p,p,s/p**2,i,a]:[r,s/p**2,p,p,i,a],u=f?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let m=e.reshape(o),g=m.dims.length,b=e.dataType,_=P("a",b,g),$=ee("output",b,g),x=v=>`
  ${v.registerUniform("output_size","u32").declareVariables(_,$)}

  ${_u(u,g,_,$)}

  ${v.mainStart()}
    ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${$.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${$.setByOffset("global_idx",_.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:v=>{let w=d?[r,i*p,a*p,s/p**2]:[r,s/p**2,i*p,a*p],k=O.size(w),C=m.dims,T=O.sortBasedOnPerm(C,u);return{outputs:[{dims:w,dataType:v[0].dataType}],dispatchGroup:{x:Math.ceil(k/64)},programUniforms:[{type:12,data:k},...ae(C,T)]}},getShaderSource:x}},Sc=(e,t)=>{gu(e.inputs),e.compute(yu(e.inputs[0],t))},Cc=e=>we({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Zi,hi,sa,bu,wu,$u,vu,oa,xu,kc,Ec,og=L(()=>{"use strict";se(),oe(),Ee(),ue(),Zi="[a-zA-Z]|\\.\\.\\.",hi="("+Zi+")+",sa="^"+hi+"$",bu="("+hi+",)*"+hi,wu="^"+bu+"$",$u=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},vu=class{constructor(e,t){this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(wu)))throw new Error("Invalid LHS term");if(r.split(",").forEach((a,s)=>{let o=e[s].dims.slice();if(!a.match(RegExp(sa)))throw new Error("Invalid LHS term");let u=this.processTerm(a,!0,o,s);this.lhs.push(u)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([a,s])=>s.count===1||a==="...").map(([a])=>a).join("");else if(!i.match(RegExp(hi)))throw new Error("Invalid RHS");i.match(RegExp(Zi,"g"))?.forEach(a=>{if(a==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let s=this.symbolToInfo.get(a);if(s===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(s.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let a=r.length,s=!1,o=[],u=0;if(!e.match(RegExp(sa))&&!t&&e!=="")throw new Error("Invalid LHS term");let d=e.match(RegExp(Zi,"g")),p=new $u(i);return d?.forEach((f,m)=>{if(f==="..."){if(s)throw new Error("Only one ellipsis is allowed per input term");s=!0;let g=a-d.length+1;if(g<0)throw new Error("Ellipsis out of bounds");if(o=r.slice(u,u+g),this.hasEllipsis){if(this.ellipsisDims.length!==o.length||this.ellipsisDims.toString()!==o.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=o;else throw new Error("Ellipsis must be specified in the LHS");for(let b=0;b<o.length;b++){let _=String.fromCharCode(48+b);p.addSymbol(_,m+b),this.addSymbol(_,r[u++],i)}}else p.addSymbol(f,m+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(f,r[u++],i)}),p}},oa=e=>e+"_max",xu=(e,t,r,i)=>{let a=e.map(p=>p.length).map((p,f)=>P(`input${f}`,t,p)),s=O.size(i),o=ee("output",t,i.length),u=[...r.symbolToInfo.keys()].filter(p=>!r.rhs.symbolToIndices.has(p)),d=p=>{let f=[],m="var prod = 1.0;",g="var sum = 0.0;",b="sum += prod;",_=[],$=[],x=[],v=[],w=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((C,T)=>{if(r.rhs.symbolToIndices.has(T)){let E=r.rhs.symbolToIndices.get(T)?.[0];E!==void 0&&r.lhs.forEach((I,A)=>{if(C.inputIndices.includes(A)){let U=I.symbolToIndices.get(T);if(U===void 0)throw new Error("Invalid symbol error");U.forEach(W=>{f.push(`${a[A].indicesSet(`input${A}Indices`,W,o.indicesGet("outputIndices",E))}`)})}})}else r.lhs.forEach((E,I)=>{if(C.inputIndices.includes(I)){let A=E.symbolToIndices.get(T);if(A===void 0)throw new Error("Invalid symbol error");A.forEach(U=>{_.push(`${a[I].indicesSet(`input${I}Indices`,U,`${T}`)}`)}),v.push(`prod *= ${a[I].getByIndices(`input${I}Indices`)};`)}}),$.push(`for(var ${T}: u32 = 0; ${T} < uniforms.${oa(T)}; ${T}++) {`),x.push("}")});let k=w?[...f,`let sum = ${a.map((C,T)=>C.getByIndices(`input${T}Indices`)).join(" * ")};`]:[...f,g,...$,..._,m,...v,b,...x];return`
            ${p.registerUniforms(u.map(C=>({name:`${oa(C)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...a,o)}

            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${o.offsetToIndices("global_idx")};
            ${a.map((C,T)=>`var input${T}Indices: ${a[T].type.indices};`).join(`
`)}
            ${k.join(`
`)};
            ${o.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let p=u.filter(m=>r.symbolToInfo.has(m)).map(m=>({type:12,data:r.symbolToInfo.get(m)?.dimValue||0}));p.push({type:12,data:s});let f=e.map((m,g)=>[...ae(m)]).reduce((m,g)=>m.concat(g),p);return f.push(...ae(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:f}},getShaderSource:d}},kc=(e,t)=>{let r=new vu(e.inputs,t.equation),i=r.outputDims,a=e.inputs.map((s,o)=>s.dims);e.compute(xu(a,e.inputs[0].dataType,r,i))},Ec=e=>{let t=e.equation.replace(/\s+/g,"");return we({equation:t})}}),Tu,ua,Su,Cu,Ic,ug=L(()=>{"use strict";se(),oe(),ue(),Tu=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,a=t.length<r.length?0:t.length-r.length;for(;i<r.length&&a<t.length;++i,++a)if(r[i]!==t[a]&&r[i]!==1&&t[a]!==1)throw new Error("Expand requires shape to be broadcastable to input")},ua=(e,t)=>{let r=e.length-t.length,i=[];for(let a=0;a<r;++a)i.push(e[a]);for(let a=0;a<t.length;++a)i.push(t[a]===1?e[a+r]:t[a]);return i},Su=(e,t)=>e.length>t.length?ua(e,t):ua(t,e),Cu=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=Su(t,r),a=e[0].dataType,s=a===9||O.size(t)===1,o=a===9||t.length>0&&t[t.length-1]%4===0?4:1,u=s||i.length>0&&i[i.length-1]%4===0?4:1,d=Math.ceil(O.size(i)/u),p=m=>{let g=P("input",a,t.length,o),b=ee("output",a,i.length,u),_;if(a===9){let $=(x,v,w="")=>`
          let outputIndices${v} = ${b.offsetToIndices(`outputOffset + ${v}u`)};
          let offset${v} = ${g.broadcastedIndicesToOffset(`outputIndices${v}`,b)};
          let index${v} = offset${v} / 4u;
          let component${v} = offset${v} % 4u;
          ${x}[${v}] = ${w}(${g.getByOffset(`index${v}`)}[component${v}]);
        `;_=`
        let outputOffset = global_idx * ${u};
        var data = vec4<u32>(0);
        ${$("data",0,"u32")}
        ${$("data",1,"u32")}
        ${$("data",2,"u32")}
        ${$("data",3,"u32")}
        ${b.setByOffset("global_idx","data")}
      }`}else _=`
        let outputIndices = ${b.offsetToIndices(`global_idx * ${u}`)};
        let inputOffset = ${g.broadcastedIndicesToOffset("outputIndices",b)};
        let data = ${b.type.value}(${g.getByOffset(`inputOffset / ${o}`)});
        ${b.setByOffset("global_idx","data")}
      }`;return`
    ${m.registerUniform("vec_size","u32").declareVariables(g,b)}
    ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${_}`},f=[{type:12,data:d},...ae(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${o}${u}`,inputDependencies:["rank"]},getShaderSource:p,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:f})}},Ic=e=>{Tu(e.inputs),e.compute(Cu(e.inputs),{inputs:[0]})}}),ku,zc,lg=L(()=>{"use strict";se(),oe(),ue(),sn(),ku=e=>{let t=e[0].dataType,r=O.size(e[0].dims),i=O.size(e[1].dims),a=i%4===0,s=o=>{let u=P("x",t,[1],4),d=P("bias",t,[1],4),p=ee("y",t,[1],4),f=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],m=b=>`
      let bias${b}_offset: u32 = (global_idx * 4 + ${b}) % uniforms.bias_size;
      let bias${b} = ${d.getByOffset(`bias${b}_offset / 4`)}[bias${b}_offset % 4];`,g=a?`
      let bias = ${d.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${m(0)}${m(1)}${m(2)}${m(3)}
      let bias = ${u.type.value}(bias0, bias1, bias2, bias3);`;return`${o.registerUniforms(f).declareVariables(u,d,p)}

    ${Ma(Me(t))}

    ${o.mainStart(Xt)}
      ${o.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${u.getByOffset("global_idx")};
      ${g}
      let x_in = x + bias;
      ${p.setByOffset("global_idx",Ba("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${a}`,inputDependencies:["type","type"]},getShaderSource:s,getRunData:o=>({outputs:[{dims:o[0].dims,dataType:o[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/Xt/4)}})}},zc=e=>{e.inputs.length<2||O.size(e.inputs[1].dims)===0?Qp(e):e.compute(ku(e.inputs))}}),Eu,Iu,Ac,Oc,dg=L(()=>{"use strict";se(),oe(),Ee(),ue(),Eu=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},Iu=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,s=O.normalizeAxis(t.axis,a),o=r.slice(0);o.splice(s,1,...i);let u=r[s],d=e[0].dataType===9?4:1,p=Math.ceil(O.size(o)/d),f=[{type:12,data:p},{type:6,data:u},{type:12,data:s},...ae(e[0].dims,e[1].dims,o)],m=g=>{let b=P("data",e[0].dataType,e[0].dims.length,d),_=P("inputIndices",e[1].dataType,e[1].dims.length),$=ee("output",e[0].dataType,o.length,d),x=w=>{let k=i.length,C=`var indicesIndices${w}  = ${_.type.indices}(0);`;for(let T=0;T<k;T++)C+=`${k>1?`indicesIndices${w}[${T}]`:`indicesIndices${w}`} = ${o.length>1?`outputIndices${w}[uniforms.axis + ${T}]`:`outputIndices${w}`};`;C+=`
          var idx${w} = ${_.getByIndices(`indicesIndices${w}`)};
          if (idx${w} < 0) {
            idx${w} = idx${w} + uniforms.axisDimLimit;
          }
          var dataIndices${w} : ${b.type.indices};
        `;for(let T=0,E=0;T<a;T++)T===s?(C+=`${a>1?`dataIndices${w}[${T}]`:`dataIndices${w}`} = u32(idx${w});`,E+=k):(C+=`${a>1?`dataIndices${w}[${T}]`:`dataIndices${w}`} = ${o.length>1?`outputIndices${w}[${E}]`:`outputIndices${w}`};`,E++);return C},v;if(e[0].dataType===9){let w=(k,C,T="")=>`
          let outputIndices${C} = ${$.offsetToIndices(`outputOffset + ${C}u`)};
          ${x(C)};
          let offset${C} = ${b.indicesToOffset(`dataIndices${C}`)};
          let index${C} = offset${C} / 4u;
          let component${C} = offset${C} % 4u;
          ${k}[${C}] = ${T}(${b.getByOffset(`index${C}`)}[component${C}]);
        `;v=`
        let outputOffset = global_idx * ${d};
        var value = vec4<u32>(0);
        ${w("value",0,"u32")}
        ${w("value",1,"u32")}
        ${w("value",2,"u32")}
        ${w("value",3,"u32")}
        ${$.setByOffset("global_idx","value")}
      `}else v=`
      let outputIndices = ${$.offsetToIndices("global_idx")};
      ${x("")};
      let value = ${b.getByIndices("dataIndices")};
      ${$.setByOffset("global_idx","value")};
      `;return`
      ${g.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(b,_,$)}
      ${g.mainStart()}
        ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${v}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:f}),getShaderSource:m}},Ac=e=>we({axis:e.axis}),Oc=(e,t)=>{let r=e.inputs;Eu(r),e.compute(Iu(e.inputs,t))}}),zu,Rc,Nc,pg=L(()=>{"use strict";se(),oe(),ue(),zu=(e,t,r,i,a,s,o,u,d)=>{let p=[{type:12,data:s},{type:12,data:i},{type:12,data:a},{type:12,data:r},{type:12,data:o},{type:12,data:u},{type:12,data:d}],f=[s];p.push(...ae(t.dims,f));let m=g=>{let b=P("indices_data",t.dataType,t.dims.length),_=ee("input_slice_offsets_data",12,1,1),$=[b,_],x=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:a.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${g.registerUniforms(x).declareVariables(...$)}
  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${a.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${a.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:f,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:p}),getShaderSource:m},{inputs:[t],outputs:[-1]})[0]},Rc=(e,t)=>{let r=e.inputs,i=r[0].dims,a=r[0].dataType,s=r[1].dims,o=s[s.length-1],u=O.sizeToDimension(s,s.length-1),d=O.sizeFromDimension(i,t.batchDims+o),p=O.sizeToDimension(i,t.batchDims),f=O.sizeFromDimension(i,t.batchDims),m=u/p,g=new Array(o),b=d;for(let C=0;C<o;++C)g[o-1-C]=b,b*=i[t.batchDims+o-1-C];let _=zu(e,r[1],g,t.batchDims,i,u,m,f,o),$=t.batchDims+o;if($>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let x=s.slice(0,-1).concat(i.slice($)),v=O.size(x),w=[{type:12,data:v},{type:12,data:d},...ae(r[0].dims,_.dims,x)],k=C=>{let T=P("data",r[0].dataType,r[0].dims.length),E=P("slice_offsets",12,_.dims.length),I=ee("output",r[0].dataType,x.length);return`
          ${C.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(T,E,I)}
            ${C.mainStart()}
            ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:x,dataType:a}],dispatchGroup:{x:Math.ceil(v/64)},programUniforms:w}),getShaderSource:k},{inputs:[r[0],_]})},Nc=e=>({batchDims:e.batch_dims,cacheKey:""})}),Au,Ou,Mc,Bc,cg=L(()=>{"use strict";se(),oe(),Ee(),ue(),Au=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=O.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,a=e[0],s=e[2],o=e.length===4?e[3]:void 0;if(s.dims.length!==a.dims.length||!a.dims.map((u,d)=>d===r?Math.ceil(u/i)===s.dims[d]:u===s.dims[d]).reduce((u,d)=>u&&d,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(o){if(o.dataType!==a.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(o.dims.length!==s.dims.length||!o.dims.map((u,d)=>u===s.dims[d]).reduce((u,d)=>u&&d,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},Ou=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,s=O.normalizeAxis(t.gatherAxis,a),o=O.normalizeAxis(t.quantizeAxis,a),u=r.slice(0);u.splice(s,1,...i);let d=O.size(u),p=e[2].dataType,f=e[0].dataType===22,m=[{type:12,data:d},{type:12,data:o},{type:12,data:s},{type:12,data:t.blockSize},...ae(...e.map((b,_)=>b.dims),u)],g=b=>{let _=P("data",e[0].dataType,e[0].dims.length),$=P("inputIndices",e[1].dataType,e[1].dims.length),x=P("scales",e[2].dataType,e[2].dims.length),v=e.length>3?P("zeroPoint",e[3].dataType,e[3].dims.length):void 0,w=ee("output",p,u.length),k=[_,$,x];v&&k.push(v);let C=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${b.registerUniforms(C).declareVariables(...k,w)}
        ${b.mainStart()}
        let output_indices = ${w.offsetToIndices("global_idx")};
        var indices_indices = ${$.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${w.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${$.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${w.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${_.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${w.indicesGet("output_indices","i")};
          ${_.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${$.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[s]};
        }
        ${_.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${u.length}; i++) {
          let index = ${w.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${_.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${_.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${_.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${f?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${x.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${x.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${x.getByIndices("scale_indices")};
        ${v?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${v.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${v.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${f?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${Me(p)}(quantized_data - zero_point) * scale;
        ${w.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((b,_)=>_!==1).map(b=>b.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(b,_)=>"rank")},getRunData:()=>({outputs:[{dims:u,dataType:p}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:m}),getShaderSource:g}},Mc=(e,t)=>{let r=e.inputs;Au(r,t),e.compute(Ou(e.inputs,t))},Bc=e=>we({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),Ru,Nu,Dc,Pc,fg=L(()=>{"use strict";se(),oe(),Ee(),ue(),Ru=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},Nu=(e,t)=>{let r=e[0].dims,i=e[0].dataType,a=r.length,s=e[1].dims,o=e[1].dataType,u=O.normalizeAxis(t.axis,a),d=r[u],p=s.slice(0),f=O.size(p),m=P("input",i,a),g=P("indicesInput",o,s.length),b=ee("output",i,p.length),_=[{type:12,data:f},{type:6,data:d},{type:12,data:u}];return _.push(...ae(r,s,p)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:p,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:_}),getShaderSource:$=>`
      ${$.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(m,g,b)}
      ${$.mainStart()}
      ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${b.offsetToIndices("global_idx")};

      var idx = ${g.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${m.type.indices}(outputIndices);
      ${m.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${m.getByIndices("inputIndices")};

      ${b.setByOffset("global_idx","value")};
  }`}},Dc=e=>we({axis:e.axis}),Pc=(e,t)=>{let r=e.inputs;Ru(r),e.compute(Nu(e.inputs,t))}}),Mu,Bu,Uc,qc,hg=L(()=>{"use strict";se(),oe(),ue(),Mu=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},Bu=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[a,s,o]=Dd.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),u=[a,s];if(!u)throw new Error("Can't use gemm on the given tensors");let d=16,p=Math.ceil(s/d),f=Math.ceil(a/d),m=!0,g=O.size(u),b=[{type:12,data:m?p:g},{type:12,data:a},{type:12,data:s},{type:12,data:o},{type:1,data:t.alpha},{type:1,data:t.beta}],_=["type","type"];e.length===3&&(b.push(...ae(e[2].dims)),_.push("rank")),b.push(...ae(u));let $=v=>{let w="";t.transA&&t.transB?w="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?w="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?w="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(w="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let k=t.alpha===1?"":"value *= uniforms.alpha;",C=P("a",e[0].dataType,e[0].dims),T=P("b",e[1].dataType,e[1].dims),E=C.type.value,I=null,A=[C,T];e.length===3&&(I=P("c",e[2].dataType,e[2].dims.length),A.push(I));let U=ee("output",e[0].dataType,u.length);A.push(U);let W=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${v.registerUniforms(W).declareVariables(...A)}

  ${v.mainStart()}
    ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${E}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${w}
    }

    ${k}
    ${I!=null?`let cOffset = ${I.broadcastedIndicesToOffset("vec2(m, n)",U)}; value += ${E}(uniforms.beta) * ${I.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},x=v=>{let w=P("a",e[0].dataType,e[0].dims),k=P("b",e[1].dataType,e[1].dims),C=null,T=[w,k];e.length===3&&(C=P("c",e[2].dataType,e[2].dims.length),T.push(C));let E=ee("output",e[0].dataType,u.length);T.push(E);let I=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],A="",U="";t.transA&&t.transB?(U=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,A="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(U=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,A="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(U=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,A="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(U=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${w.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,A="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let W=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${v.registerUniforms(I).declareVariables(...T)}
  var<workgroup> tile_a: array<array<${w.type.storage}, ${d}>, ${d}>;
  var<workgroup> tile_b: array<array<${k.type.storage}, ${d}>, ${d}>;
  ${v.mainStart([d,d,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${d};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${d};
    let num_tiles = (uniforms.K - 1) / ${d} + 1;
    var k_start = 0u;
    var value = ${E.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${U}
      k_start = k_start + ${d};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${d}; k++) {
        ${A}
      }
      workgroupBarrier();
    }

    ${W}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${C!=null?`let cOffset = ${C.broadcastedIndicesToOffset("vec2(m, n)",E)}; value += ${E.type.value}(uniforms.beta) * ${C.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return m?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:p*f},programUniforms:b}),getShaderSource:x}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:b}),getShaderSource:$}},Uc=e=>{let t=e.transA,r=e.transB,i=e.alpha,a=e.beta;return{transA:t,transB:r,alpha:i,beta:a,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},qc=(e,t)=>{Mu(e.inputs),e.compute(Bu(e.inputs,t))}}),lt,mt,Ot,Rt,Du,Pu,Uu,qu,Wu,Lu,Fu,Gu,Wc,Lc,mg=L(()=>{"use strict";se(),oe(),Ee(),ue(),[lt,mt,Ot,Rt]=[0,1,2,3],Du=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},Pu=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,Uu=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,qu=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Wu=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,Lu=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${lt}] = batch;
     indices[${mt}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Ot}] = u32(r);
            indices[${Rt}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${Ot}] = u32(clamp(r, 0, H - 1));
          indices[${Rt}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Ot}] = gs_reflect(r, border[1], border[3]);
          indices[${Rt}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,Fu=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${lt}], indices[${mt}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${lt}], indices[${mt}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${lt}], indices[${mt}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${lt}], indices[${mt}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${lt}], indices[${mt}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${lt}], indices[${mt}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,Gu=(e,t)=>{let r=P("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],a=P("grid",e[1].dataType,i.length,2),s=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(s=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[lt,mt,Ot,Rt]=[0,3,1,2]);let o=ee("output",e[0].dataType,s.length),u=r.type.value,d=O.size(s),p=[{type:12,data:d},...ae(e[0].dims,i,s)],f=m=>`
  ${m.registerUniform("output_size","u32").declareVariables(r,a,o)}
  ${Pu}
  ${Uu(u)}
  ${qu(t)}
  ${Wu(t)}
  ${Lu(r,u,t)}

  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Ot}]);
      let W_in = i32(uniforms.x_shape[${Rt}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${o.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${lt}], indices[${Ot}], indices[${Rt}]);
      let nxy = ${a.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Fu(o,u,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:m=>{let g=O.size(s);return{outputs:[{dims:s,dataType:m[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:p}},getShaderSource:f}},Wc=(e,t)=>{Du(e.inputs),e.compute(Gu(e.inputs,t))},Lc=e=>we({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),De,Vu,Fc,la,ju,vi,Gc,Vc=L(()=>{"use strict";se(),oe(),Ee(),tn(),nn(),ue(),Ct(),De=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,Vu=(e,t)=>{let r=e[0],i=De(e,1),a=De(e,2),s=De(e,3),o=De(e,4),u=De(e,5),d=De(e,6),p=De(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let f=r.dims[0],m=r.dims[1],g=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],b=m,_=0,$=0,x=Math.floor(g/t.numHeads);if(d&&p&&O.size(d.dims)&&O.size(p.dims)){if(d.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(d.dims[0]!==f||d.dims[1]!==t.numHeads||d.dims[3]!==x)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(p.dims[0]!==f||p.dims[1]!==t.numHeads||p.dims[3]!==x)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(d.dims[2]!==p.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(p.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');_=d.dims[2],$=d.dims[2]}else if(d&&O.size(d.dims)||p&&O.size(p.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let v;if(i&&O.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');v=2,b=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==x)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');v=5,b=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==x)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');v=0,b=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');v=3}if(s&&O.size(s.dims)>0){if(s.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let w=_+b,k=0;if(o&&O.size(o.dims)>0){k=8;let I=o.dims;throw I.length===1?I[0]===f?k=1:I[0]===3*f+2&&(k=3):I.length===2&&I[0]===f&&I[1]===w&&(k=5),k===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let C=!1,T=g;if(a&&O.size(a.dims)>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(b!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');T=a.dims[2]}else{if(b!==a.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');T=a.dims[1]*a.dims[3],C=!0}}let E=!1;if(o&&O.size(o.dims)>0)throw new Error("Key padding mask is not supported");if(u&&O.size(u.dims)>0){if(u.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(u.dims[0]!==f||u.dims[1]!==t.numHeads||u.dims[2]!==m||u.dims[3]!==w)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:f,sequenceLength:m,pastSequenceLength:_,kvSequenceLength:b,totalSequenceLength:w,maxSequenceLength:$,inputHiddenSize:0,hiddenSize:g,vHiddenSize:T,headSize:x,vHeadSize:Math.floor(T/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:k,scale:t.scale,broadcastResPosBias:E,passPastInKv:C,qkvFormat:v}},Fc=e=>we({...e}),la=we({perm:[0,2,1,3]}),ju=(e,t,r,i,a,s,o)=>{let u=[i,a,s],d=O.size(u),p=[{type:12,data:d},{type:12,data:o},{type:12,data:s}],f=m=>{let g=ee("qkv_with_bias",t.dataType,u),b=P("qkv",t.dataType,u),_=P("bias",r.dataType,u),$=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${m.registerUniforms($).declareVariables(b,_,g)}
  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:u,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:p}),getShaderSource:f},{inputs:[t,r],outputs:[-1]})[0]},vi=(e,t,r,i,a,s,o,u)=>{let d=s;if(o&&O.size(o.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return d=ju(e,s,o,t,i,r*a,u),d=d.reshape([t,i,r,a]),r===1||i===1?d:e.compute(Ge(d,la.perm),{inputs:[d],outputs:[-1]})[0]}else return s.dims.length===3&&(d=s.reshape([t,i,r,a])),r===1||i===1?d:e.compute(Ge(d,la.perm),{inputs:[d],outputs:[-1]})[0]},Gc=(e,t)=>{let r=Vu(e.inputs,t),i=e.inputs[0],a=De(e.inputs,1),s=De(e.inputs,2),o=De(e.inputs,3),u=De(e.inputs,4),d=De(e.inputs,5),p=De(e.inputs,6),f=De(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if(a?.dims.length===5)throw new Error("Packed KV is not implemented");let m=a&&s&&a.dims.length===4&&s.dims.length===4,g=vi(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,o,0);if(m)return Ci(e,g,a,s,u,void 0,p,f,d,r);if(!a||!s)throw new Error("key and value must be provided");let b=vi(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,a,o,r.hiddenSize),_=vi(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,s,o,2*r.hiddenSize);Ci(e,g,b,_,u,void 0,p,f,d,r)}}),Hu,Ku,Zu,Qu,Wa,jc,Hc,Kc=L(()=>{"use strict";se(),oe(),Ee(),ue(),Hu=e=>{if(!e||e.length<1)throw new Error("too few inputs")},Ku=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),i=r.length),we({numOutputs:i,axis:t.axis,splitSizes:r})},Zu=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${ie("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,Qu=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let a=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(a):i===0?r.push(`if (output_number == ${i}u) { ${a} }`):i===t-1?r.push(`else { ${a} }`):r.push(`else if (output_number == ${i}) { ${a} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},Wa=(e,t)=>{let r=e[0].dims,i=O.size(r),a=e[0].dataType,s=O.normalizeAxis(t.axis,r.length),o=new Array(t.numOutputs),u=P("input",a,r.length),d=new Array(t.numOutputs),p=[],f=[],m=0,g=[{type:12,data:i}];for(let _=0;_<t.numOutputs;_++){m+=t.splitSizes[_],d[_]=m;let $=r.slice();$[s]=t.splitSizes[_],f.push($),o[_]=ee(`output${_}`,a,$.length),p.push({dims:f[_],dataType:e[0].dataType})}g.push({type:12,data:d},...ae(r,...f));let b=_=>`
  ${_.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",d.length).declareVariables(u,...o)}
  ${Zu(d.length)}
  ${Qu(o)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${u.offsetToIndices("global_idx")};
    var index = ${u.indicesGet("indices",s)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${ie("uniforms.size_in_split_axis","output_number - 1u",d.length)};
      ${u.indicesSet("indices",s,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:b,getRunData:()=>({outputs:p,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:g})}},jc=(e,t)=>{Hu(e.inputs);let r=e.inputs.length===1?t:Ku(e.inputs,t);e.compute(Wa(e.inputs,r),{inputs:[0]})},Hc=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return we({axis:t,numOutputs:i,splitSizes:r})}}),Yu,sr,Zc,Qc=L(()=>{"use strict";se(),oe(),Ee(),ue(),Yu=(e,t)=>{let[r,i,a,s]=e,{numHeads:o,rotaryEmbeddingDim:u}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!O.areEqual(i.dims,[])&&!O.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(s.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${s.dims.length}`);if(!O.areEqual(a.dims,s.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(u>0&&o===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let d=r.dims[0],p=r.dims[r.dims.length-2],f=a.dims[0],m=O.sizeFromDimension(r.dims,1)/p,g=u===0?a.dims[1]*2:m/o;if(u>g)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(d!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(p!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(g/2!==a.dims[1]&&u/2!==a.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${a.dims[1]}`);if(p>f)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported")},sr=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:a,scale:s}=t,o=e[0].dims[0],u=O.sizeFromDimension(e[0].dims,1),d=e[0].dims[e[0].dims.length-2],p=u/d,f=e[2].dims[1],m=a===0?f*2:p/i,g=new Array(o,d,p/m,m-f),b=O.computeStrides(g),_=[{type:1,data:s},{type:12,data:g},{type:12,data:b},...e[0].dims.length===3?new Array({type:12,data:[u,p,m,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[u,m,d*m,1]}):[],...ae(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],$=x=>{let v=P("input",e[0].dataType,e[0].dims.length),w=P("position_ids",e[1].dataType,e[1].dims.length),k=P("cos_cache",e[2].dataType,e[2].dims.length),C=P("sin_cache",e[3].dataType,e[3].dims.length),T=ee("output",e[0].dataType,e[0].dims.length);return x.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:g.length},{name:"global_strides",type:"u32",length:b.length},{name:"input_output_strides",type:"u32",length:b.length}]),`
        ${x.declareVariables(v,w,k,C,T)}

        ${x.mainStart(Xt)}
          let half_rotary_emb_dim = uniforms.${k.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${x.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${w.broadcastedIndicesToOffset("bsnh.xy",ee("",w.type.tensor,2))};
            let position_id =
                u32(${w.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${v.getByOffset("i")} * ${k.get("position_id","bsnh[3]")} -
                ${v.getByOffset("j")} * ${C.get("position_id","bsnh[3]")};
            ${T.setByOffset("i","re")}
            let im = ${v.getByOffset("i")} * ${C.get("position_id","bsnh[3]")} +
                ${v.getByOffset("j")} * ${k.get("position_id","bsnh[3]")};
            ${T.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${T.setByOffset("k",v.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:we({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:$,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(g)/Xt)},programUniforms:_})}},Zc=(e,t)=>{Yu(e.inputs,t),e.compute(sr(e.inputs,t))}}),Xu,Ju,da,el,Yc,gg=L(()=>{"use strict";Ee(),se(),nn(),Vc(),Kc(),Ct(),Qc(),ue(),Xu=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],a=e[2],s=e[3],o=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let u=!1,d=r.dims[0],p=r.dims[1],f=r.dims.length===3?u?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],m=p,g=0,b=!i||i.dims.length===0,_=Math.floor(b?f/(t.numHeads+2*t.kvNumHeads):f/t.numHeads);b&&(f=_*t.numHeads);let $=s&&s.dims.length!==0,x=o&&o.dims.length!==0;if($&&s.dims.length===4&&s.dims[0]===d&&s.dims[1]!==t.kvNumHeads&&s.dims[2]===t.kvNumHeads&&s.dims[3]===_)throw new Error("BSNH pastKey/pastValue is not supported");if($&&x){if(s.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(o.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');g=s.dims[2]}else if($||x)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let v=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');m=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==_)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');m=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==_)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');m=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');v=3}let w=0,k=!1,C=t.kvNumHeads?_*t.kvNumHeads:f;if(a&&a.dims.length>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(m!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');C=a.dims[2]}else{if(m!==a.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');C=a.dims[1]*a.dims[3],k=!0}}let T=e.length>4?e[5]:void 0;if(T&&T.dims.length!==1&&T.dims[0]!==d)throw new Error('Input "seqlens" is expected to have 1 dimension and the same dim 0 as batch_size');return{batchSize:d,sequenceLength:p,pastSequenceLength:g,kvSequenceLength:m,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:f,vHiddenSize:C,headSize:_,vHeadSize:Math.floor(C/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:w,scale:t.scale,broadcastResPosBias:!1,passPastInKv:k,qkvFormat:v}},Ju=we({perm:[0,2,1,3]}),da=(e,t,r)=>{let i=t,a=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,a,r.headSize]),i=e.compute(Ge(i,Ju.perm),{inputs:[i],outputs:[-1]})[0]),i},el=(e,t,r,i)=>{let a=7,s=["type","type"],o=[e*t],u=e*t,d=[{type:12,data:u},{type:12,data:t},{type:12,data:e}],p=f=>{let m=P("seq_lens",r.dataType,r.dims),g=P("total_seq_lens",i.dataType,i.dims),b=ee("pos_ids",a,o),_=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${f.registerUniforms(_).declareVariables(m,g,b)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${g.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${m.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${b.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:s},getRunData:()=>({outputs:[{dims:o,dataType:a}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:d}),getShaderSource:p}},Yc=(e,t)=>{let r=Xu(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(e.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,s=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,o=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,u=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,d=e.inputs.length>4?e.inputs[5]:void 0,p=e.inputs.length>5?e.inputs[6]:void 0,f=r.kvNumHeads?r.kvNumHeads:r.numHeads,m=we({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,f*r.headSize,f*r.headSize]}),[g,b,_]=!a&&!s?e.compute(Wa([i],m),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,s],$,x;if(t.doRotary){let C=e.compute(el(r.batchSize,r.sequenceLength,d,p),{inputs:[d,p],outputs:[-1]})[0],T=e.inputs[7],E=e.inputs[8],I=we({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),A=[g,C,T,E],U=[-1];$=e.compute(sr(A,I),{inputs:A,outputs:U})[0],A.splice(0,1,b);let W=we({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});x=e.compute(sr(A,W),{inputs:A,outputs:U})[0]}let v=vi(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?$:g,void 0,0),w=da(e,t.doRotary?x:b,r),k=da(e,_,r);Ci(e,v,w,k,void 0,void 0,o,u,void 0,r,d,p)}}),pa,tl,il,Xc,_g=L(()=>{"use strict";se(),oe(),Ct(),ue(),pa=(e,t,r,i,a,s,o,u)=>{let d=Ce(s),p=d===1?"f32":`vec${d}f`,f=d===1?"vec2f":`mat2x${d}f`,m=a*o,g=64;m===1&&(g=256);let b=[a,o,s/d],_=[a,o,2],$=["rank","type","type"],x=[];x.push(...ae(b,_));let v=w=>{let k=P("x",t.dataType,3,d),C=P("scale",r.dataType,r.dims),T=P("bias",i.dataType,i.dims),E=ee("output",1,3,2),I=[k,C,T,E];return`
  var<workgroup> workgroup_shared : array<${f}, ${g}>;
  const workgroup_size = ${g}u;
  ${w.declareVariables(...I)}
  ${w.mainStart(g)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${p}(0);
    var squared_sum = ${p}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${p}(${k.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${f}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${St("workgroup_shared[0][0]",d)} / f32(hight * ${d});
      let squared_sum_final = ${St("workgroup_shared[0][1]",d)} / f32(hight * ${d});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${u}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${d};${u};${g}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:_,dataType:1}],dispatchGroup:{x:m},programUniforms:x}),getShaderSource:v},{inputs:[t,r,i],outputs:[-1]})[0]},tl=(e,t,r)=>{let i=t[0].dims,a=i,s=2,o=i[0],u=i[1],d=O.sizeFromDimension(i,s),p=Ce(d),f=O.size(a)/p,m=pa(e,t[0],t[1],t[2],o,d,u,r.epsilon),g=[o,u,d/p],b=[o,u],_=["type","none"],$=x=>{let v=P("x",t[0].dataType,g.length,p),w=P("scale_shift",1,b.length,2),k=ee("output",t[0].dataType,g.length,p),C=[v,w,k];return`
  ${x.registerUniform("output_size","u32").declareVariables(...C)}
  ${x.mainStart()}
  ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${k.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${w.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${v.getByOffset("global_idx")} * ${k.type.value}(scale_shift.x) + ${k.type.value}(scale_shift.y);
      ${k.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${p}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},...ae(g,b,g)]}),getShaderSource:$},{inputs:[t[0],m]})},il=(e,t,r)=>{let i=t[0].dims,a=i,s=i[0],o=i[i.length-1],u=O.sizeFromDimension(i,1)/o,d=Ce(o),p=O.size(a)/d,f=[{type:12,data:u},{type:12,data:Math.floor(o/d)}],m=["type","type"],g=!1,b=[0,i.length-1];for(let v=0;v<i.length-2;v++)g=g||i[v+1]!==1,b.push(v+1);g=g&&i[i.length-1]!==1;let _=g?e.compute(Ge(e.inputs[0],b),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(v,w)=>i[b[w]])),$=pa(e,_,t[1],t[2],s,u,o,r.epsilon),x=v=>{let w=Ae(t[0].dataType),k=d===1?"vec2f":`mat${d}x2f`,C=I=>{let A=I===0?"x":"y",U=d===1?"f32":`vec${d}f`;switch(d){case 1:return`${w}(${U}(scale.${A}))`;case 2:return`vec2<${w}>(${U}(scale[0].${A}, scale[1].${A}))`;case 4:return`vec4<${w}>(${U}(scale[0].${A}, scale[1].${A}, scale[2].${A}, scale[3].${A}))`;default:throw new Error(`Not supported compoents ${d}`)}},T=P("input",t[0].dataType,t[0].dims,d),E=ee("output",t[0].dataType,a,d);return`
  @group(0) @binding(0) var<storage, read> input : array<${T.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${k}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${E.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${v.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${C(0)}, ${C(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${d}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:f}),getShaderSource:x},{inputs:[t[0],$]})},Xc=(e,t)=>{t.format==="NHWC"?il(e,e.inputs,t):tl(e,e.inputs,t)}}),rl,al,Jc,yg=L(()=>{"use strict";se(),oe(),ue(),rl=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},al=(e,t,r)=>{let i=t.simplified,a=e[0].dims,s=e[1],o=!i&&e[2],u=a,d=O.normalizeAxis(t.axis,a.length),p=O.sizeToDimension(a,d),f=O.sizeFromDimension(a,d),m=O.size(s.dims),g=o?O.size(o.dims):0;if(m!==f||o&&g!==f)throw new Error(`Size of X.shape()[axis:] == ${f}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${m} and bias size of ${g}`);let b=[];for(let T=0;T<a.length;++T)T<d?b.push(a[T]):b.push(1);let _=Ce(f),$=["type","type"],x=[{type:12,data:p},{type:1,data:f},{type:12,data:Math.floor(f/_)},{type:1,data:t.epsilon}];o&&$.push("type");let v=r>1,w=r>2,k=T=>{let E=Ae(e[0].dataType),I=[P("x",e[0].dataType,e[0].dims,_),P("scale",s.dataType,s.dims,_)];o&&I.push(P("bias",o.dataType,o.dims,_)),I.push(ee("output",e[0].dataType,u,_)),v&&I.push(ee("mean_data_output",1,b)),w&&I.push(ee("inv_std_output",1,b));let A=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${T.registerUniforms(A).declareVariables(...I)}
  ${T.mainStart()}
    ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${Oa("f32",_)};
    var mean_square_vector = ${Oa("f32",_)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${Qt(E,_,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${St("mean_vector",_)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${St("mean_square_vector",_)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${Qt(E,_,"x[j + offset]")};
      let f32scale = ${Qt(E,_,"scale[j]")};
      output[j + offset] = ${I[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${o?`+ ${Qt(E,_,"bias[j]")}`:""}
      );
    }

    ${v?"mean_data_output[global_idx] = mean":""};
    ${w?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},C=[{dims:u,dataType:e[0].dataType}];return v&&C.push({dims:b,dataType:1}),w&&C.push({dims:b,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${_};${r};${i}`,inputDependencies:$},getRunData:()=>({outputs:C,dispatchGroup:{x:Math.ceil(p/64)},programUniforms:x}),getShaderSource:k}},Jc=(e,t)=>{rl(e.inputs),e.compute(al(e.inputs,t,e.outputCount))}}),nl,ef,bg=L(()=>{"use strict";oe(),dn(),pn(),nl=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},ef=e=>{nl(e.inputs);let t=Yt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(ln(e.inputs,{activation:""},t));else{let a=t[t.length-2],s=O.size(e.inputs[0].dims.slice(0,-2)),o=O.size(e.inputs[1].dims.slice(0,-2));if(s!==1&&a===1&&o===1){let u=e.inputs[0].reshape([1,s,i]),d=e.inputs[1].reshape([1,i,r]),p=[1,s,r],f=[u,d];e.compute(nr(f,{activation:""},t,p),{inputs:f})}else e.compute(nr(e.inputs,{activation:""},t))}}}),sl,ol,ul,tf,rf,wg=L(()=>{"use strict";se(),oe(),Ee(),ue(),sl=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let a=Math.floor((t.k+t.blockSize-1)/t.blockSize),s=t.blockSize/8*t.bits,o=e[1];if(!O.areEqual(o.dims,[t.n,a,s]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let u=e[2].dims;if(O.size(u)!==t.n*a)throw new Error("scales input size error.");if(e.length===4){let d=e[3].dims,p=t.n*(t.bits===8?a:Math.floor((a*t.bits+7)/8));if(O.size(d)!==p)throw new Error("zeroPoints input size error.")}},ol=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],s=t.k,o=t.n,u=r.slice(0,i-2),d=O.size(u),p=e[1].dims[2]/4,f=e[0].dataType,m=Ce(t.k),g=Ce(p),b=Ce(o),_=u.concat([a,o]),$=a>1&&o/b%2===0?2:1,x=O.size(_)/b/$,v=64,w=[],k=[d,a,s/m],C=O.convertShape(e[1].dims).slice();C.splice(-1,1,p/g),w.push(...ae(k)),w.push(...ae(C)),w.push(...ae(e[2].dims)),e.length===4&&w.push(...ae(O.convertShape(e[3].dims)));let T=[d,a,o/b];w.push(...ae(T));let E=I=>{let A=k.length,U=P("a",e[0].dataType,A,m),W=P("b",12,C.length,g),F=P("scales",e[2].dataType,e[2].dims.length),H=[U,W,F],te=e.length===4?P("zero_points",12,e[3].dims.length):void 0;te&&H.push(te);let V=T.length,X=ee("output",e[0].dataType,V,b),Z=Ae(e[0].dataType),K=(()=>{switch(m){case 1:return`array<${Z}, 8>`;case 2:return`mat4x2<${Z}>`;case 4:return`mat2x4<${Z}>`;default:throw new Error(`${m}-component is not supported.`)}})(),re=()=>{let N=`
          // reuse a data
            var input_offset = ${U.indicesToOffset(`${U.type.indices}(batch, row, word_offset)`)};
            var a_data: ${K};
            for (var j: u32 = 0; j < ${8/m}; j++) {
              a_data[j] = ${U.getByOffset("input_offset")};
              input_offset++;
            }
          `;for(let M=0;M<b*$;M++)N+=`
            b_value = ${g===1?`b${M}_data`:`b${M}_data[i]`};
            b_value_lower = unpack4xU8(b_value & b_mask);
            b_value_upper = unpack4xU8((b_value >> 4) & b_mask);
            b_quantized_values = ${K}(${Array.from({length:4},(Y,pe)=>`${Z}(b_value_lower[${pe}]), ${Z}(b_value_upper[${pe}])`).join(", ")});
            b_dequantized_values = ${m===1?`${K}(${Array.from({length:8},(Y,pe)=>`(b_quantized_values[${pe}] - ${te?`zero_point${M}`:"zero_point"}) * scale${M}`).join(", ")});`:`(b_quantized_values - ${K}(${Array(8).fill(`${te?`zero_point${M}`:"zero_point"}`).join(",")})) * scale${M};`};
            workgroup_shared[local_id.x * ${$} + ${Math.floor(M/b)}]${b>1?`[${M%b}]`:""} += ${Array.from({length:8/m},(Y,pe)=>`${m===1?`a_data[${pe}] * b_dequantized_values[${pe}]`:`dot(a_data[${pe}], b_dequantized_values[${pe}])`}`).join(" + ")};
          `;return N},j=()=>{let N=`
            var col_index = col * ${b};
            ${te?`
            let zero_point_bytes_per_col = (nBlocksPerCol + 1) / 2;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${Z}(8);`}
            `;for(let M=0;M<b*$;M++)N+=`
            let scale${M} = ${F.getByOffset("col_index * nBlocksPerCol + block")};
            ${te?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block >> 0x1u);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            zero_point_word = ${te.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${M} = ${Z}((zero_point_word) & 0xFu);`:""}
            col_index += 1;`;return N},le=()=>{let N=`col_index = col * ${b};`;for(let M=0;M<b*$;M++)N+=`
            let b${M}_data = ${W.getByIndices(`${W.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return N+=`
            var b_value: u32;
            let b_mask: u32 = 0x0F0F0F0Fu;
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${K};
            var b_dequantized_values: ${K};`,N};return`
        var<workgroup> workgroup_shared: array<${X.type.value}, ${$*v}>;
        ${I.declareVariables(...H,X)}
        ${I.mainStart([v,1,1])}
          let output_indices = ${X.offsetToIndices(`(global_idx / ${v}) * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${v}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/m};
            ${j()}
            for (var word: u32 = 0; word < ${p}; word += ${g}) {
              ${le()}
              for (var i: u32 = 0; i < ${g}; i++) {
                ${re()}
                word_offset += ${8/m};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${$}) {
            var output_value: ${X.type.value} = ${X.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${v}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${$};
            }
            ${X.setByIndices(`${X.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${m};${g};${b};${$};${v}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:_,dataType:f}],dispatchGroup:{x},programUniforms:w}),getShaderSource:E}},ul=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],s=t.k,o=t.n,u=r.slice(0,i-2),d=O.size(u),p=e[1].dims[2]/4,f=e[0].dataType,m=Ce(t.k),g=Ce(p),b=u.concat([a,o]),_=128,$=o%8===0?8:o%4===0?4:1,x=_/$,v=x*g*8,w=v/m,k=v/t.blockSize,C=O.size(b)/$,T=[],E=[d,a,s/m],I=O.convertShape(e[1].dims).slice();I.splice(-1,1,p/g),T.push(...ae(E)),T.push(...ae(I)),T.push(...ae(e[2].dims)),e.length===4&&T.push(...ae(O.convertShape(e[3].dims)));let A=[d,a,o];T.push(...ae(A));let U=W=>{let F=E.length,H=P("a",e[0].dataType,F,m),te=P("b",12,I.length,g),V=P("scales",e[2].dataType,e[2].dims.length),X=[H,te,V],Z=e.length===4?P("zero_points",12,e[3].dims.length):void 0;Z&&X.push(Z);let K=A.length,re=ee("output",e[0].dataType,K),j=Ae(e[0].dataType),le=()=>{switch(m){case 1:return`
          let a_data0 = vec4<${j}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${j}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${j}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${j}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${m}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${H.type.value}, ${w}>;
        var<workgroup> inter_results: array<array<${re.type.value}, ${x}>, ${$}>;
        ${W.declareVariables(...X,re)}
        ${W.mainStart([x,$,1])}
          let output_indices = ${re.offsetToIndices(`workgroup_index * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${k} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${w};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${w}; a_offset += ${_})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${H.getByIndices(`${H.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${H.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${k} + local_id.x;
            ${Z?`
            let zero_point_bytes_per_col = (n_blocks_per_col + 1) / 2;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block >> 0x1u);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            let zero_point_word = ${Z.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${j}((zero_point_word) & 0xFu);`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${j}(8);`}
            let scale = ${V.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${te.getByIndices(`${te.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/m};
            for (var i: u32 = 0; i < ${g}; i++) {
              ${le()}
              let b_value = ${g===1?"b_data":"b_data[i]"};
              let b_value_lower = unpack4xU8(b_value & 0x0F0F0F0Fu);
              let b_value_upper = unpack4xU8((b_value >> 4) & 0x0F0F0F0Fu);
              let b_quantized_values = mat2x4<${j}>(${Array.from({length:4},(N,M)=>`${j}(b_value_lower[${M}]), ${j}(b_value_upper[${M}])`).join(", ")});
              let b_dequantized_values = (b_quantized_values - mat2x4<${j}>(${Array(8).fill("zero_point").join(",")})) * scale;
              inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(N,M)=>`${`dot(a_data${M}, b_dequantized_values[${M}])`}`).join(" + ")};
              word_offset += ${8/m};
            }
            workgroupBarrier();
          }

          if (local_idx < ${$}) {
            var output_value: ${re.type.value} = ${re.type.value}(0);
            for (var b = 0u; b < ${x}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${re.setByIndices(`${re.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${m};${g};${x};${$}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:b,dataType:f}],dispatchGroup:{x:C},programUniforms:T}),getShaderSource:U}},tf=(e,t)=>{sl(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(ul(e.inputs,t)):e.compute(ol(e.inputs,t))},rf=e=>we(e)}),ll,dl,pl,cl,fl,hl,ml,gl,af,$g=L(()=>{"use strict";se(),oe(),ue(),ll=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},dl=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
            k = i32(${e.indicesGet("indices",a)}) - ${ie("uniforms.pads",a,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${ie("uniforms.x_shape",a,t)})) {
              break;
            }
            offset += k * i32(${ie("uniforms.x_strides",a,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},pl=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${ie("uniforms.pads",a,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${ie("uniforms.x_shape",a,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${ie("uniforms.x_shape",a,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${ie("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},cl=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${ie("uniforms.pads",a,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${ie("uniforms.x_shape",a,t)})) {
                  k = i32(${ie("uniforms.x_shape",a,t)}) - 1;
                }
                offset += k * i32(${ie("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},fl=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${ie("uniforms.pads",a,r)};
                if (k < 0)  {
                  k += i32(${ie("uniforms.x_shape",a,t)}]);
                }
                if (k >= i32(${ie("uniforms.x_shape",a,t)})) {
                  k -= i32(${ie("uniforms.x_shape",a,t)});
                }
                offset += k * i32(${ie("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},hl=(e,t,r)=>{switch(r.mode){case 0:return dl(e,t,r.pads.length);case 1:return pl(e,t,r.pads.length);case 2:return cl(e,t,r.pads.length);case 3:return fl(e,t,r.pads.length);default:throw new Error("Invalid mode")}},ml=(e,t)=>{let r=O.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,a=O.size(r),s=[{type:12,data:a},{type:6,data:t.pads}],o=e.length>=3&&e[2].data;t.mode===0&&s.push({type:o?e[2].dataType:1,data:t.value}),s.push(...ae(e[0].dims,r));let u=["rank"],d=p=>{let f=ee("output",e[0].dataType,r.length),m=P("x",e[0].dataType,i.length),g=m.type.value,b=hl(f,i.length,t),_=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&_.push({name:"constant_value",type:o?g:"f32"}),`
            ${p.registerUniforms(_).declareVariables(m,f)}
            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${f.offsetToIndices("global_idx")};

            var value = ${g}(0);
            ${b}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${o}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(r)/64)},programUniforms:s}),getShaderSource:d}},gl=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,a=e[0].dims.length,s=new Int32Array(2*a).fill(0);if(e.length>=4){let u=e[3].getBigInt64Array();for(let d=0;d<u.length;d++)s[Number(u[d])]=Number(r[d]),s[Number(u[d])+a]=Number(r[d+u.length])}else r.forEach((u,d)=>s[Number(d)]=Number(u));let o=[];return s.forEach(u=>o.push(u)),{mode:t.mode,value:i,pads:o}}else return t},af=(e,t)=>{ll(e.inputs);let r=gl(e.inputs,t);e.compute(ml(e.inputs,r),{inputs:[0]})}}),mi,ca,fa,ha,ma,_l,yl,ga,_a,nf,sf,ya,of,uf,ba,lf,df,pf,cf,vg=L(()=>{"use strict";Ze(),se(),oe(),ue(),mi=e=>{if(_e.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},ca=(e,t,r)=>{let i=t.format==="NHWC",a=e.dims.slice();i&&a.splice(1,0,a.pop());let s=Object.hasOwnProperty.call(t,"dilations"),o=t.kernelShape.slice(),u=t.strides.slice(),d=s?t.dilations.slice():[],p=t.pads.slice();rr.adjustPoolAttributes(r,a,o,u,d,p);let f=rr.computePoolOutputShape(r,a,u,d,o,p,t.autoPad),m=Object.assign({},t);s?Object.assign(m,{kernelShape:o,strides:u,pads:p,dilations:d,cacheKey:t.cacheKey}):Object.assign(m,{kernelShape:o,strides:u,pads:p,cacheKey:t.cacheKey});let g=f.slice();return g.push(g.splice(1,1)[0]),[m,i?g:f]},fa=(e,t)=>{let r=t.format==="NHWC",i=O.size(e),a=O.size(t.kernelShape),s=[{type:12,data:i},{type:12,data:a}],o=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let u=t.kernelShape[t.kernelShape.length-1],d=t.strides[t.strides.length-1],p=t.pads[t.pads.length/2-1],f=t.pads[t.pads.length-1],m=!!(p+f);s.push({type:12,data:u},{type:12,data:d},{type:12,data:p},{type:12,data:f}),o.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let g=!1;if(t.kernelShape.length===2){let b=t.kernelShape[t.kernelShape.length-2],_=t.strides[t.strides.length-2],$=t.pads[t.pads.length/2-2],x=t.pads[t.pads.length-2];g=!!($+x),s.push({type:12,data:b},{type:12,data:_},{type:12,data:$},{type:12,data:x}),o.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[s,o,!0,m,g]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let u=O.computeStrides(t.kernelShape);s.push({type:12,data:u},{type:12,data:t.pads},{type:12,data:t.strides}),o.push({name:"kernelStrides",type:"u32",length:u.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let d=t.pads.reduce((p,f)=>p+f);return[s,o,!!d,!1,!1]}},ha=(e,t,r,i,a,s,o,u,d,p,f,m)=>{let g=a.format==="NHWC",b=t.type.value,_=ee("output",t.type.tensor,i);if(a.kernelShape.length<=2){let $="",x="",v="",w=r-(g?2:1);if(f?$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${w}] = indices[${w}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${w}] < 0 || xIndices[${w}]
                      >= uniforms.x_shape[${w}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${s}
                }`:$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${w}] = indices[${w}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${s}
                }`,a.kernelShape.length===2){let k=r-(g?3:2);m?x=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${k}] = indices[${k}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${k}] < 0 || xIndices[${k}] >= uniforms.x_shape[${k}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:x=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${k}] = indices[${k}] * uniforms.sh - uniforms.phStart + j;
                `,v=`
              }
            `}return`
            ${e.registerUniforms(d).declareVariables(t,_)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${_.offsetToIndices("global_idx")};
              var xIndices = ${_.offsetToIndices("global_idx")};

              var value = ${b}(${u});
              var pad = 0;
              ${x}
              ${$}
              ${v}
              ${o}

              output[global_idx] = value;
            }`}else{if(g)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let $=a.kernelShape.length,x=a.pads.length,v="";return p?v=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${s}
              }`:v=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${s}
            `,`
            ${e.registerUniforms(d).declareVariables(t,_)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${_.offsetToIndices("global_idx")};
              var xIndices = ${_.offsetToIndices("global_idx")};

              var offsets: array<u32, ${$}>;

              var value = ${b}(${u});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${$-1}u; j++) {
                  offsets[j] = offset / ${ie("uniforms.kernelStrides","j",$)};
                  offset -= offsets[j] * ${ie("uniforms.kernelStrides","j",$)};
                }
                offsets[${$-1}] = offset;

                isPad = false;
                for (var j = ${r-$}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${ie("uniforms.strides",`j - ${r-$}u`,$)}
                    + offsets[j - ${r-$}u] - ${ie("uniforms.pads","j - 2u",x)};
                  ${v}
              }
              ${o}

              output[global_idx] = value;
            }`}},ma=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,_l=e=>`${ma(e)};${e.countIncludePad}`,yl=e=>`${ma(e)};${e.storageOrder};${e.dilations}`,ga=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),_a=(e,t,r,i)=>{let[a,s]=ca(t,i,r),o=P("x",t.dataType,t.dims.length),u=o.type.value,d="value += x_val;",p="";a.countIncludePad?p+=`value /= ${u}(uniforms.kernelSize);`:p+=`value /= ${u}(i32(uniforms.kernelSize) - pad);`;let[f,m,g,b,_]=fa(s,a);f.push(...ae(t.dims,s));let $=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${g};${b};${_}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:s,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(s)/64)},programUniforms:f}),getShaderSource:x=>ha(x,o,t.dims.length,s.length,a,d,p,0,m,g,b,_)}},nf=e=>{let t=e.count_include_pad!==0,r=ga(e);if(r.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for AveragePool");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:_l(i)}},sf=(e,t)=>{mi(e.inputs),e.compute(_a("AveragePool",e.inputs[0],!1,t))},ya={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},of=e=>{let t=e.format;return{format:t,...ya,cacheKey:t}},uf=(e,t)=>{mi(e.inputs),e.compute(_a("GlobalAveragePool",e.inputs[0],!0,t))},ba=(e,t,r,i)=>{let[a,s]=ca(t,i,r),o=`
      value = max(x_val, value);
    `,u="",d=P("x",t.dataType,t.dims.length),p=["rank"],[f,m,g,b,_]=fa(s,a);return f.push(...ae(t.dims,s)),{name:e,shaderCache:{hint:`${i.cacheKey};${g};${b};${_}`,inputDependencies:p},getRunData:()=>({outputs:[{dims:s,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(s)/64)},programUniforms:f}),getShaderSource:$=>ha($,d,t.dims.length,s.length,a,o,u,t.dataType===10?-65504:-1e5,m,g,b,_)}},lf=(e,t)=>{mi(e.inputs),e.compute(ba("MaxPool",e.inputs[0],!1,t))},df=e=>{let t=e.storage_order,r=e.dilations,i=ga(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for MaxPool");let a={storageOrder:t,dilations:r,...i,cacheKey:""};return{...a,cacheKey:yl(a)}},pf=e=>{let t=e.format;return{format:t,...ya,cacheKey:t}},cf=(e,t)=>{mi(e.inputs),e.compute(ba("GlobalMaxPool",e.inputs[0],!0,t))}}),bl,wl,ff,hf,xg=L(()=>{"use strict";se(),oe(),Ee(),ue(),bl=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[0].dataType===6&&e.length>2)throw new Error("In the case of dequantizing int32 there is no zero point.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((a,s)=>s===t.axis||a===e[0].dims[s]).reduce((a,s)=>a&&s,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},wl=(e,t)=>{let r=O.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,a=i===3,s=e[0].dims,o=e[1].dataType,u=O.size(s),d=i===3||i===2,p=d?[Math.ceil(O.size(e[0].dims)/4)]:e[0].dims,f=e[1].dims,m=e.length>2?e[2]:void 0,g=m?d?[Math.ceil(O.size(m.dims)/4)]:m.dims:void 0,b=f.length===0||f.length===1&&f[0]===1,_=b===!1&&f.length===1,$=Ce(u),x=b&&(!d||$===4),v=x?$:1,w=x&&!d?$:1,k=P("input",d?12:i,p.length,w),C=P("scale",o,f.length),T=m?P("zero_point",d?12:i,g.length):void 0,E=ee("output",o,s.length,v),I=[k,C];T&&I.push(T);let A=[p,f];m&&A.push(g);let U=[{type:12,data:u/v},{type:12,data:r},{type:12,data:t.blockSize},...ae(...A,s)],W=F=>{let H=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${F.registerUniforms(H).declareVariables(...I,E)}
      ${F.mainStart()}
          ${F.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${E.offsetToIndices("global_idx")};

          // Set input x
          ${d?`
            let input = ${k.getByOffset("global_idx / 4")};
            let x_vec = ${a?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${v===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${k.getByOffset("global_idx")};`};

          // Set scale input
          ${b?`let scale_value= ${C.getByOffset("0")}`:_?`
            let scale_index = ${E.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${C.getByOffset("scale_index")};`:`
            var scale_indices: ${C.type.indices} = output_indices;
            let index = ${C.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${C.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${C.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${T?b?d?`
                let zero_point_input = ${T.getByOffset("0")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${T.getByOffset("0")}`:_?d?`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${T.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${T.getByOffset("zero_point_index")};`:d?`
                let zero_point_offset = ${C.indicesToOffset("scale_indices")};
                let zero_point_input = ${T.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${T.getByIndices("scale_indices")};`:`let zero_point_value = ${d?a?"i32":"u32":k.type.value}(0);`};
      // Compute and write output
      ${E.setByOffset("global_idx",`${E.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:T?["rank","rank","rank"]:["rank","rank"]},getShaderSource:W,getRunData:()=>({outputs:[{dims:s,dataType:o}],dispatchGroup:{x:Math.ceil(u/v/64),y:1,z:1},programUniforms:U})}},ff=(e,t)=>{bl(e.inputs,t),e.compute(wl(e.inputs,t))},hf=e=>we({axis:e.axis,blockSize:e.blockSize})}),$l,vl,mf,Tg=L(()=>{"use strict";Ze(),se(),ue(),$l=(e,t,r)=>{let i=e===t,a=e<t&&r<0,s=e>t&&r>0;if(i||a||s)throw new Error("Range these inputs' contents are invalid.")},vl=(e,t,r,i)=>{let a=Math.abs(Math.ceil((t-e)/r)),s=[a],o=a,u=[{type:12,data:o},{type:i,data:e},{type:i,data:r},...ae(s)],d=p=>{let f=ee("output",i,s.length),m=f.type.value,g=[{name:"outputSize",type:"u32"},{name:"start",type:m},{name:"delta",type:m}];return`
        ${p.registerUniforms(g).declareVariables(f)}
        ${p.mainStart()}
        ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${m}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:d,getRunData:()=>({outputs:[{dims:s,dataType:i}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:u})}},mf=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),_e.webgpu.validateInputContent&&$l(t,r,i),e.compute(vl(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),xl,Tl,gf,_f,Sg=L(()=>{"use strict";se(),oe(),Ee(),ue(),xl=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let a=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,s=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${a}bitcast<${i}>(oldValue) + (${r})${s}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${a}max(bitcast<f32>(oldValue), (${r}))${s}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${a}min(bitcast<${i}>(oldValue), (${r}))${s}`;case"mul":return`${a}(bitcast<${i}>(oldValue) * (${r}))${s}`;default:throw new Error(`Reduction ${e} is not supported.`)}},Tl=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r,s=1,o=Math.ceil(O.sizeToDimension(i,i.length-1)/s),u=i[i.length-1],d=O.sizeFromDimension(r,u),p=[{type:12,data:o},{type:12,data:u},{type:12,data:d},...ae(e[1].dims,e[2].dims,a)],f=m=>{let g=P("indices",e[1].dataType,e[1].dims.length),b=P("updates",e[2].dataType,e[2].dims.length,s),_=t.reduction!=="none"&&t.reduction!==""?Gd("output",e[0].dataType,a.length):ee("output",e[0].dataType,a.length,s);return`
      ${m.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(g,b,_)}
      ${m.mainStart()}
        ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${xl(t.reduction,"output[data_offset + i]","value",_.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:p}),getShaderSource:f}},gf=e=>we({reduction:e.reduction}),_f=(e,t)=>{e.compute(Tl(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),Sl,Cl,kl,wa,El,Il,zl,Al,Ol,Rl,Nl,Ml,$a,Bl,Dl,Pl,Ul,ql,yf,bf,Cg=L(()=>{"use strict";se(),oe(),Ee(),ue(),Sl=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Cl=(e,t,r)=>{t.every(a=>a>=0&&a<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((a,s)=>i[a]=e[s]),i},kl=(e,t,r,i,a,s)=>{let[o,u,d]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],p=e[0].dims.length;if(o>0&&e.length>o&&e[o].dims.length>0)e[o].getFloat32Array().forEach(f=>s.push(f));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0){if(e[u].getFloat32Array().forEach(f=>i.push(f)),i.length!==0&&i.length!==p&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");Sl(i,t),t.axes.length>0&&Cl(i,t.axes,p).forEach((f,m)=>i[m]=f)}if(d>0&&e.length>d&&e[d].dims.length===1&&e[d].dims[0]>0&&(e[d].getBigInt64Array().forEach(f=>a.push(Number(f))),a.length!==0&&a.length!==p&&r>=18&&a.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof a<"u"&&i.length>0&&a.length>p)throw new Error("Resize requires only of scales or sizes to be specified")},wa=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,El=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${wa("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${wa("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",Il=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";case"simple":default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",zl=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),a=e.length===0?i:e.slice();return t.length>0?(t.forEach((s,o)=>{i[s]=a[o],i[o+r]=a[t.length+o]}),i):a},Al=(e,t,r,i)=>{let a=[];if(r.length>0)if(i.length>0){if(e.forEach(s=>a.push(s)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((s,o)=>a[s]=r[o])}else r.forEach(s=>a.push(s));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");a=e.map((s,o)=>Math.round(s*t[o]))}return a},Ol=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(s=>t[s]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(s=>t[s]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let a=e.slice();return r.axes.length>0?(r.axes.forEach(s=>t[s]=i),r.axes.forEach(s=>a[s]=Math.round(e[s]*t[s]))):(t.fill(i,0,t.length),a.forEach((s,o)=>a[o]=Math.round(s*t[o]))),a},Rl=(e,t,r,i,a)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${ie("uniforms.scales","i",i)};
        var roi_low = ${ie("uniforms.roi","i",a)};
        var roi_hi = ${ie("uniforms.roi",`i + ${t.length}`,a)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${ie("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${ie("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,Nl=(e,t,r,i,a,s,o)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${ie("uniforms.scales","i",a)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${ie("uniforms.roi","i",s)};
          var roi_hi = ${ie("uniforms.roi",`i + ${r.length}`,s)};
          var input_shape_i = ${ie("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${ie("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${o} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,Ml=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${ie("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,$a=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",Bl=(e,t,r,i,a)=>{let[s,o,u,d]=r.length===2?[-1,0,1,-1]:[0,2,3,1],p=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${p} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",o,`max(0, min(row, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(col, ${r[u]} - 1))`)};
      ${$a(e,d,s,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${p} = originalIndices[${o}];
      var col:${p} = originalIndices[${u}];
      ${i?`if (row < 0 || row > (${r[o]} - 1) || col < 0 || col > (${r[u]} - 1)) {
        return ${a};
      }`:""};
      row = max(0, min(row, ${r[o]} - 1));
      col = max(0, min(col, ${r[u]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${d}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${s}])`:"0"};
      var x11: ${p} = getInputValue(batch, channel, row1, col1);
      var x12: ${p} = getInputValue(batch, channel, row1, col2);
      var x21: ${p} = getInputValue(batch, channel, row2, col1);
      var x22: ${p} = getInputValue(batch, channel, row2, col2);
      var dx1: ${p} = abs(row - ${p}(row1));
      var dx2: ${p} = abs(${p}(row2) - row);
      var dy1: ${p} = abs(col - ${p}(col1));
      var dy2: ${p} = abs(${p}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},Dl=(e,t,r,i,a,s,o,u,d,p)=>{let f=r.length===2,m=!0,[g,b]=f?[0,1]:m?[2,3]:[1,2],_=e.type.value,$=x=>{let v=x===g?"row":"col";return`
      fn ${v}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${_} {
        var output_index = ${t.indicesGet("output_indices",x)};
        var originalIdx: ${_} = getOriginalCoordinateFromResizedCoordinate(output_index, ${a[x]},
        ${i[x]}, ${r[x]}, ${s[x]}, ${s[x]} + ${r.length});
        var fractOriginalIdx: ${_} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${u} && (originalIdx < 0 || originalIdx > (${r[x]} - 1))) {
          return ${d};
        }
        var data: array<${_}, 4> = array<${_}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${v}: ${_} = originalIdx + ${_}(i);
          if (${v} < 0 || ${v} >= ${r[x]}) {
            ${p?`coefs[i + 1] = 0.0;
                        continue;`:u?`return ${d};`:`${v} = max(0, min(${v}, ${r[x]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",x,`u32(${v})`)};
          data[i + 1] = ${x===g?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${$(g)};
    ${$(b)};
  fn getCubicInterpolationCoefs(s: ${_}) -> array<${_}, 4> {
    var absS = abs(s);
    var coeffs: array<${_}, 4> = array<${_}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${_} = 1.0 - absS;
    var twoMinusAbsS: ${_} = 2.0 - absS;
    var onePlusAbsS: ${_} = 1.0 + absS;
    coeffs[0] = ((${o} * onePlusAbsS - 5 * ${o}) * onePlusAbsS + 8 * ${o}) * onePlusAbsS - 4 * ${o};
    coeffs[1] = ((${o} + 2) * absS - (${o} + 3)) * absS * absS + 1;
    coeffs[2] = ((${o} + 2) * oneMinusAbsS - (${o} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${o} * twoMinusAbsS - 5 * ${o}) * twoMinusAbsS + 8 * ${o}) * twoMinusAbsS - 4 * ${o};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${_}, 4>, coefs: array<${_}, 4>) -> ${_} {
    var coefsSum: ${_} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${_} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},Pl=(e,t,r,i,a)=>{let[s,o,u,d,p]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],f=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${f} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",o,`max(0, min(depth, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(height, ${r[u]} - 1))`)};
      ${e.indicesSet("input_indices",d,`max(0, min(width, ${r[d]} - 1))`)};
      ${$a(e,p,s,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${f} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${f} = originalIndices[${o}];
      var height:${f} = originalIndices[${u}];
      var width:${f} = originalIndices[${d}];
      ${i?`if (depth < 0 || depth > (${r[o]} - 1) || height < 0 || height > (${r[u]} - 1) || width < 0 || (width > ${r[d]} - 1)) {
      return ${a};
        }`:""};

    depth = max(0, min(depth, ${r[o]} - 1));
      height = max(0, min(height, ${r[u]} - 1));
      width = max(0, min(width, ${r[d]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${p}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${s}])`:"0"};

      var x111: ${f} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${f} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${f} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${f} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${f} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${f} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${f} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${f} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${f} = abs(depth - ${f}(depth1));
      var dx2: ${f} = abs(${f}(depth2) - depth);
      var dy1: ${f} = abs(height - ${f}(height1));
      var dy2: ${f} = abs(${f}(height2) - height);
      var dz1: ${f} = abs(width - ${f}(width1));
      var dz2: ${f} = abs(${f}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},Ul=(e,t,r,i,a,s)=>{let o=e.dims,u=zl(s,t.axes,o.length),d=Al(o,i,a,t.axes),p=i.slice();i.length===0&&(p=o.map((w,k)=>w===0?1:d[k]/w),t.keepAspectRatioPolicy!=="stretch"&&(d=Ol(o,p,t)));let f=ee("output",e.dataType,d.length),m=P("input",e.dataType,o.length),g=O.size(d),b=o.length===d.length&&o.every((w,k)=>w===d[k]),_=t.coordinateTransformMode==="tf_crop_and_resize",$=t.extrapolationValue,x=m.type.value,v=w=>`
      ${b?"":`
      ${El(t.coordinateTransformMode,x)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${Ml(m,o)};
              ${Il(t.nearestMode,r,x)};
              ${Nl(m,f,o,d,p.length,u.length,_)};
              `;case"linear":return`
              ${Rl(f,o,d,p.length,u.length)};
              ${(()=>{if(o.length===2||o.length===4)return`${Bl(m,f,o,_,$)}`;if(o.length===3||o.length===5)return`${Pl(m,f,o,_,$)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(o.length===2||o.length===4)return`${Dl(m,f,o,d,p,u,t.cubicCoeffA,_,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${w.registerUniform("output_size","u32").registerUniform("scales","f32",p.length).registerUniform("roi","f32",u.length).declareVariables(m,f)}
      ${w.mainStart()}
        ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${b?"output[global_idx] = input[global_idx];":`
        let output_indices = ${f.offsetToIndices("global_idx")};
        var input_indices: ${m.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${m.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${o.length===2||o.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${p.length>0?t.mode==="cubic"?p:p.length:""}|${a.length>0?a:""}|${u.length>0?u:""}|${b}|${t.mode==="nearest"?o.length:o}`,inputDependencies:["rank"]},getShaderSource:v,getRunData:()=>({outputs:[{dims:d,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:[{type:12,data:g},{type:1,data:p},{type:1,data:u},...ae(o,d)]})}},ql=e=>{let t=e.customDataBuffer;return new Uint32Array(t,t.byteOffset,1)[0]},yf=(e,t)=>{let r=[],i=[],a=[],s=ql(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");kl(e.inputs,t,s,r,i,a),e.compute(Ul(e.inputs[0],t,s,r,i,a),{inputs:[0]})},bf=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,a=e.cubicCoeffA,s=e.excludeOutside!==0,o=e.extrapolationValue,u=e.keepAspectRatioPolicy,d=e.mode,p=e.nearestMode===""?"simple":e.nearestMode;return we({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:a,excludeOutside:s,extrapolationValue:o,keepAspectRatioPolicy:u,mode:d,nearestMode:p})}}),Wl,Ll,wf,kg=L(()=>{"use strict";se(),oe(),ue(),Wl=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let a=t.dims[t.dims.length-1],s=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==a)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==s)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==a)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let o=e[3];if(o.dims.length!==1)throw new Error("Beta must be 1D");if(o.dims[o.dims.length-1]!==a)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let o=e[4];if(o.dims.length!==1)throw new Error("Bias must be 1D");if(o.dims[o.dims.length-1]!==a)throw new Error("Bias must have the same hidden size as input")}},Ll=(e,t,r,i)=>{let a=t.simplified,s=e[0].dims,o=O.size(s),u=s,d=o,p=s.slice(-1)[0],f=i?s.slice(0,-1).concat(1):[],m=!a&&e.length>3,g=e.length>4,b=i&&r>1,_=i&&r>2,$=r>3,x=64,v=Ce(p),w=[{type:12,data:d},{type:12,data:v},{type:12,data:p},{type:1,data:t.epsilon}],k=T=>{let E=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],I=[P("x",e[0].dataType,e[0].dims,v),P("skip",e[1].dataType,e[1].dims,v),P("gamma",e[2].dataType,e[2].dims,v)];m&&I.push(P("beta",e[3].dataType,e[3].dims,v)),g&&I.push(P("bias",e[4].dataType,e[4].dims,v)),I.push(ee("output",e[0].dataType,u,v)),b&&I.push(ee("mean_output",1,f)),_&&I.push(ee("inv_std_output",1,f)),$&&I.push(ee("input_skip_bias_sum",e[0].dataType,u,v));let A=Ae(e[0].dataType),U=Ae(1,v);return`

      ${T.registerUniforms(E).declareVariables(...I)}
      var<workgroup> sum_shared : array<${U}, ${x}>;
      var<workgroup> sum_squared_shared : array<${U}, ${x}>;

      ${T.mainStart([x,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${x};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${x};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${x-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${g?"bias[offset1d + i]":A+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${$?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${Qt(A,v,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${x};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${St("sum",v)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${St("square_sum",v)} / f32(uniforms.hidden_size) ${a?"":"- mean * mean"} + uniforms.epsilon);
        ${b?"mean_output[global_idx] = mean;":""}
        ${_?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${a?"":`- ${A}(mean)`}) *
            ${A}(inv_std_dev) * gamma[offset1d + i]
            ${m?"+ beta[offset1d + i]":""};
        }
      }`},C=[{dims:u,dataType:e[0].dataType}];return r>1&&C.push({dims:f,dataType:1}),r>2&&C.push({dims:f,dataType:1}),r>3&&C.push({dims:s,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${v};${b};${_};${$}`,inputDependencies:e.map((T,E)=>"type")},getShaderSource:k,getRunData:()=>({outputs:C,dispatchGroup:{x:Math.ceil(d/p)},programUniforms:w})}},wf=(e,t)=>{Wl(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(Ll(e.inputs,t,e.outputCount,!1),{outputs:r})}}),Fl,gi,Gl,va,Vl,jl,$f,vf,Eg=L(()=>{"use strict";se(),oe(),Ee(),ue(),Fl=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},gi=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},Gl=(e,t)=>{if(e.length>1){let r=gi(e,1),i=gi(e,2),a=gi(e,3);return a.length===0&&(a=[...Array(e[0].dims.length).keys()]),we({starts:r,ends:i,axes:a})}else return t},va=(e,t,r,i,a)=>{let s=e;return e<0&&(s+=r[i[t]]),a[t]<0?Math.max(0,Math.min(s,r[i[t]]-1)):Math.max(0,Math.min(s,r[i[t]]))},Vl=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${ie("uniforms.input_shape","i",r.length)};
            let steps_i = ${ie("uniforms.steps","i",r.length)};
            let signs_i = ${ie("uniforms.signs","i",r.length)};
            let starts_i = ${ie("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,jl=(e,t)=>{let r=e[0].dims,i=O.size(r),a=t.axes.length>0?O.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],s=gi(e,4);s.forEach(v=>v!==0||(()=>{throw new Error("step cannot be 0")})),s.length===0&&(s=Array(a.length).fill(1));let o=t.starts.map((v,w)=>va(v,w,r,a,s)),u=t.ends.map((v,w)=>va(v,w,r,a,s));if(a.length!==o.length||a.length!==u.length)throw new Error("start, ends and axes should have the same number of elements");if(a.length!==r.length)for(let v=0;v<r.length;++v)a.includes(v)||(o.splice(v,0,0),u.splice(v,0,r[v]),s.splice(v,0,1));let d=s.map(v=>Math.sign(v));s.forEach((v,w,k)=>{if(v<0){let C=(u[w]-o[w])/v,T=o[w],E=T+C*s[w];o[w]=E,u[w]=T,k[w]=-v}});let p=r.slice(0);a.forEach((v,w)=>{p[v]=Math.ceil((u[v]-o[v])/s[v])});let f={dims:p,dataType:e[0].dataType},m=ee("output",e[0].dataType,p.length),g=P("input",e[0].dataType,e[0].dims.length),b=O.size(p),_=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:o.length},{name:"signs",type:"i32",length:d.length},{name:"steps",type:"u32",length:s.length}],$=[{type:12,data:b},{type:12,data:o},{type:6,data:d},{type:12,data:s},...ae(e[0].dims,p)],x=v=>`
      ${v.registerUniforms(_).declareVariables(g,m)}
        ${Vl(g,m,r)}
        ${v.mainStart()}
          ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${m.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${m.setByOffset("global_idx",g.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${d.length}_${o.length}_${s.length}`,inputDependencies:["rank"]},getShaderSource:x,getRunData:()=>({outputs:[f],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:$})}},$f=(e,t)=>{Fl(e.inputs,t);let r=Gl(e.inputs,t);e.compute(jl(e.inputs,r),{inputs:[0]})},vf=e=>{let t=e.starts,r=e.ends,i=e.axes;return we({starts:t,ends:r,axes:i})}}),Hl,Kl,xf,Tf,Ig=L(()=>{"use strict";se(),oe(),Ee(),Ct(),ue(),Hl=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},Kl=(e,t)=>{let r=e.inputs[0],i=r.dims,a=O.size(i),s=i.length,o=O.normalizeAxis(t.axis,s),u=o<i.length-1,d,p=[];u?(p=Array.from({length:s},(I,A)=>A),p[o]=s-1,p[s-1]=o,d=e.compute(Ge(r,p),{inputs:[r],outputs:[-1]})[0]):d=r;let f=d.dims,m=f[s-1],g=a/m,b=Ce(m),_=m/b,$=64;g===1&&($=256);let x=(I,A)=>A===4?`max(max(${I}.x, ${I}.y), max(${I}.z, ${I}.w))`:A===2?`max(${I}.x, ${I}.y)`:A===3?`max(max(${I}.x, ${I}.y), ${I}.z)`:I,v=P("x",d.dataType,d.dims,b),w=ee("result",d.dataType,d.dims,b),k=v.type.value,C=Ae(d.dataType)==="f32"?`var threadMax = ${k}(-3.402823e+38f);`:`var threadMax = ${k}(-65504.0h);`,T=I=>`
      var<workgroup> rowMaxShared : ${k};
      var<workgroup> rowSumShared : ${k};
      var<workgroup> threadShared : array<${k}, ${$}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${k} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${k}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${I.registerUniform("packedCols","i32").declareVariables(v,w)}
      ${I.mainStart($)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${$};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${C}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${k}(${x("threadShared[0]",b)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${k}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${k}(${St("threadShared[0]",b)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${k}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,E=e.compute({name:"Softmax",shaderCache:{hint:`${b};${$}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:f,dataType:d.dataType}],dispatchGroup:{x:g},programUniforms:[{type:6,data:_}]}),getShaderSource:T},{inputs:[d],outputs:[u?-1:0]})[0];u&&e.compute(Ge(E,p),{inputs:[E]})},xf=(e,t)=>{Hl(e.inputs),Kl(e,t)},Tf=e=>we({axis:e.axis})}),xa,Zl,Ql,Yl,Sf,zg=L(()=>{"use strict";se(),oe(),ue(),xa=e=>Array.from(e.getBigInt64Array(),Number),Zl=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(xa(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},Ql=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},Yl=(e,t)=>{let r=e[0].dims,i=t??xa(e[1]),a=Ql(r,i),s=O.size(a),o=e[0].dataType,u=P("input",o,r.length),d=ee("output",o,a.length),p=f=>`
      const inputShape = ${u.indices(...r)};
      ${f.registerUniform("output_size","u32").declareVariables(u,d)}
      ${f.mainStart()}
      ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${d.offsetToIndices("global_idx")};
      var input_indices: ${u.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${u.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${d.indicesGet("output_indices","i")}  % input_dim_i;

        ${u.indicesSet("input_indices","i","input_dim_value")}
      }
      ${d.setByOffset("global_idx",u.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:[{type:12,data:s},...ae(e[0].dims,a)]}),getShaderSource:p}},Sf=e=>{Zl(e.inputs),e.compute(Yl(e.inputs),{inputs:[0]})}}),Xl,Jl,Cf,Ag=L(()=>{"use strict";se(),oe(),ue(),Xl=(e,t,r,i,a)=>{let s=ee("output_data",a,r.length,4),o=P("a_data",t[1].dataType,t[1].dims.length,4),u=P("b_data",t[2].dataType,t[2].dims.length,4),d=P("c_data",t[0].dataType,t[0].dims.length,4),p,f=(m,g,b)=>`select(${g}, ${m}, ${b})`;if(!i)p=s.setByOffset("global_idx",f(o.getByOffset("global_idx"),u.getByOffset("global_idx"),d.getByOffset("global_idx")));else{let m=(g,b,_="")=>{let $=`a_data[index_a${b}][component_a${b}]`,x=`b_data[index_b${b}][component_b${b}]`,v=`bool(c_data[index_c${b}] & (0xffu << (component_c${b} * 8)))`;return`
            let output_indices${b} = ${s.offsetToIndices(`global_idx * 4u + ${b}u`)};
            let offset_a${b} = ${o.broadcastedIndicesToOffset(`output_indices${b}`,s)};
            let offset_b${b} = ${u.broadcastedIndicesToOffset(`output_indices${b}`,s)};
            let offset_c${b} = ${d.broadcastedIndicesToOffset(`output_indices${b}`,s)};
            let index_a${b} = offset_a${b} / 4u;
            let index_b${b} = offset_b${b} / 4u;
            let index_c${b} = offset_c${b} / 4u;
            let component_a${b} = offset_a${b} % 4u;
            let component_b${b} = offset_b${b} % 4u;
            let component_c${b} = offset_c${b} % 4u;
            ${g}[${b}] = ${_}(${f($,x,v)});
          `};a===9?p=`
            var data = vec4<u32>(0);
            ${m("data",0,"u32")}
            ${m("data",1,"u32")}
            ${m("data",2,"u32")}
            ${m("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:p=`
            ${m("output_data[global_idx]",0)}
            ${m("output_data[global_idx]",1)}
            ${m("output_data[global_idx]",2)}
            ${m("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(d,o,u,s)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${p}
      }`},Jl=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,a=e[1].dataType,s=!(O.areEqual(t,r)&&O.areEqual(r,i)),o=t,u=O.size(t);if(s){let p=Yt.calcShape(Yt.calcShape(t,r,!1),i,!1);if(!p)throw new Error("Can't perform where op on the given tensors");o=p,u=O.size(o)}let d=Math.ceil(u/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:p=>Xl(p,e,o,s,a),getRunData:()=>({outputs:[{dims:o,dataType:a}],dispatchGroup:{x:Math.ceil(u/64/4)},programUniforms:[{type:12,data:d},...ae(i,t,r,o)]})}},Cf=e=>{e.compute(Jl(e.inputs))}}),kf,Og=L(()=>{"use strict";jm(),nn(),Hm(),Km(),Zm(),Qm(),Ym(),ig(),ag(),ng(),sg(),og(),ug(),lg(),dg(),pg(),cg(),fg(),hg(),mg(),gg(),_g(),yg(),bg(),wg(),Vc(),$g(),vg(),xg(),Tg(),Sg(),an(),Cg(),Qc(),kg(),Eg(),Ig(),Kc(),zg(),Ct(),sn(),Ag(),kf=new Map([["Abs",[bp]],["Acos",[wp]],["Acosh",[$p]],["Add",[tc]],["ArgMax",[mp,Na]],["ArgMin",[hp,Na]],["Asin",[vp]],["Asinh",[xp]],["Atan",[Tp]],["Atanh",[Sp]],["Attention",[gp]],["AveragePool",[sf,nf]],["BatchNormalization",[_p]],["BiasAdd",[yp]],["BiasSplitGelu",[ec]],["Cast",[kp,Cp]],["Ceil",[Ip]],["Clip",[Ep]],["Concat",[pc,cc]],["Conv",[qa,Ua]],["ConvTranspose",[vc,$c]],["Cos",[zp]],["Cosh",[Ap]],["CumSum",[xc,Tc]],["DepthToSpace",[Sc,Cc]],["DequantizeLinear",[ff,hf]],["Div",[ic]],["Einsum",[kc,Ec]],["Elu",[Op,$i]],["Equal",[rc]],["Erf",[Rp]],["Exp",[Np]],["Expand",[Ic]],["FastGelu",[zc]],["Floor",[Mp]],["FusedConv",[qa,Ua]],["Gather",[Oc,Ac]],["GatherElements",[Pc,Dc]],["GatherBlockQuantized",[Mc,Bc]],["GatherND",[Rc,Nc]],["Gelu",[Bp]],["Gemm",[qc,Uc]],["GlobalAveragePool",[uf,of]],["GlobalMaxPool",[cf,pf]],["Greater",[oc]],["GreaterOrEqual",[lc]],["GridSample",[Wc,Lc]],["GroupQueryAttention",[Yc]],["HardSigmoid",[Gp,Fp]],["InstanceNormalization",[Xc]],["LayerNormalization",[Jc]],["LeakyRelu",[Dp,$i]],["Less",[uc]],["LessOrEqual",[dc]],["Log",[Xp]],["MatMul",[ef]],["MatMulNBits",[tf,rf]],["MaxPool",[lf,df]],["Mul",[ac]],["MultiHeadAttention",[Gc,Fc]],["Neg",[Up]],["Not",[Pp]],["Pad",[af]],["Pow",[nc]],["QuickGelu",[Jp,$i]],["Range",[mf]],["Reciprocal",[qp]],["ReduceMin",[lp]],["ReduceMean",[ap]],["ReduceMax",[up]],["ReduceSum",[pp]],["ReduceProd",[dp]],["ReduceL1",[np]],["ReduceL2",[sp]],["ReduceLogSum",[fp]],["ReduceLogSumExp",[op]],["ReduceSumSquare",[cp]],["Relu",[Wp]],["Resize",[yf,bf]],["RotaryEmbedding",[Zc]],["ScatterND",[_f,gf]],["Sigmoid",[Lp]],["Sin",[Vp]],["Sinh",[jp]],["Slice",[$f,vf]],["SkipLayerNormalization",[wf]],["Split",[jc,Hc]],["Sqrt",[Hp]],["Softmax",[xf,Tf]],["Sub",[sc]],["Tan",[Kp]],["Tanh",[Zp]],["ThresholdedRelu",[Yp,$i]],["Tile",[Sf]],["Transpose",[jd,Hd]],["Where",[Cf]]])}),Ef,Rg=L(()=>{"use strict";Ze(),_t(),ue(),Ef=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,a){at(e.programInfo.name);let s=this.backend.device,o=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let u=[];for(let p of t)u.push({binding:u.length,resource:{buffer:p.buffer}});for(let p of r)u.push({binding:u.length,resource:{buffer:p.buffer}});a&&u.push({binding:u.length,resource:a});let d=s.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:u,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let p={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:d,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(p)}o.setPipeline(e.computePipeline),o.setBindGroup(0,d),o.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Ke(e.programInfo.name)}dispose(){}build(e,t){at(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(p=>{r.features.has(p.feature)&&i.push(`enable ${p.extension};`)});let a=Vd(t,this.backend.device.limits),s=e.getShaderSource(a),o=`${i.join(`
`)}
${a.additionalImplementations}
${s}`,u=r.createShaderModule({code:o,label:e.name});me("verbose",()=>`[WebGPU] ${e.name} shader code: ${o}`);let d=r.createComputePipeline({compute:{module:u,entryPoint:"main"},layout:"auto",label:e.name});return Ke(e.name),{programInfo:e,computePipeline:d,uniformVariablesInfo:a.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,a=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=a&&r<=a&&i<=a)return[t,r,i];let s=t*r*i,o=Math.ceil(Math.sqrt(s));if(o>a){if(o=Math.ceil(Math.cbrt(s)),o>a)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[o,o,o]}else return[o,o,1]}}}),If={};Jt(If,{WebGpuBackend:()=>zf});var ed,td,id,zf,Ng=L(()=>{"use strict";Ze(),se(),_t(),qd(),Gm(),Og(),Rg(),ed=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let a=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${a}`);break}case"rank":{let s=e[i].dims.length;r.push(`${a};${s}`);break}case"dims":{let s=e[i].dims.join(",");r.push(`${a};${s}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},td=(e,t,r)=>{let i=e.name;return e.shaderCache?.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${ed(t,e.shaderCache?.inputDependencies??new Array(t.length).fill("dims"))}`,i},id=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},zf=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=s=>t.features.has(s)&&r.push(s)&&!0;a("chromium-experimental-timestamp-query-inside-passes")||a("timestamp-query"),a("shader-f16"),a("subgroups"),this.device=await t.requestDevice(i),this.adapterInfo=new id(t.info||await t.requestAdapterInfo()),this.gpuDataManager=Fd(this),this.programManager=new Ef(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Ja(e.logLevel,!!e.debug),this.device.onuncapturederror=s=>{s.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${s.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!1}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose()}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;at(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let i=0;i<t.length/2;i++){let a=r[i],s=a.kernelId,o=this.kernels.get(s),u=o.kernelType,d=o.kernelName,p=a.programName,f=a.inputTensorViews,m=a.outputTensorViews,g=t[i*2],b=t[i*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=g);let _=Number(g-this.queryTimeBase),$=Number(b-this.queryTimeBase);if(!Number.isSafeInteger(_)||!Number.isSafeInteger($))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:f.map(x=>({dims:x.dims,dataType:gt(x.dataType)})),outputsMetadata:m.map(x=>({dims:x.dims,dataType:gt(x.dataType)})),kernelId:s,kernelType:u,kernelName:d,programName:p,startTime:_,endTime:$});else{let x="";f.forEach((w,k)=>{x+=`input[${k}]: [${w.dims}] | ${gt(w.dataType)}, `});let v="";m.forEach((w,k)=>{v+=`output[${k}]: [${w.dims}] | ${gt(w.dataType)}, `}),console.log(`[profiling] kernel "${s}|${u}|${d}|${p}" ${x}${v}start time: ${_} ns, execution time: ${$-_} ns`)}Si("GPU",`${p}::${g}::${b}`)}e.unmap(),this.pendingQueries.delete(e)}),Ke()}run(e,t,r,i,a,s){at(e.name);let o=[];for(let w=0;w<t.length;++w){let k=t[w].data;if(k===0)continue;let C=this.gpuDataManager.get(k);if(!C)throw new Error(`no GPU data for input: ${k}`);o.push(C)}let{outputs:u,dispatchGroup:d,programUniforms:p}=e.getRunData(t),f=r.length===0?u.map((w,k)=>k):r;if(f.length!==u.length)throw new Error(`Output size ${f.length} must be equal to ${u.length}.`);let m=[],g=[];for(let w=0;w<u.length;++w){if(!Number.isInteger(f[w])||f[w]<-3||f[w]>=s)throw new Error(`Invalid output index: ${f[w]}`);if(f[w]===-3)continue;let k=f[w]===-1,C=f[w]===-2,T=k||C?a(u[w].dataType,u[w].dims):i(f[w],u[w].dataType,u[w].dims);if(m.push(T),T.data===0)continue;let E=this.gpuDataManager.get(T.data);if(!E)throw new Error(`no GPU data for output: ${T.data}`);if(k&&this.temporaryData.push(E),C){let I=this.kernelPersistentData.get(this.currentKernelId);I||(I=[],this.kernelPersistentData.set(this.currentKernelId,I)),I.push(E)}g.push(E)}if(o.length!==t.length||g.length!==m.length){if(g.length===0)return Ke(e.name),m;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let b;if(p){let w=0,k=[];p.forEach(I=>{let A=typeof I.data=="number"?[I.data]:I.data;if(A.length===0)return;let U=I.type===10?2:4,W,F;I.type===10?(F=A.length>4?16:A.length>2?8:A.length*U,W=A.length>4?16:U*A.length):(F=A.length<=2?A.length*U:16,W=16),w=Math.ceil(w/F)*F,k.push(w);let H=I.type===10?8:4;w+=A.length>4?Math.ceil(A.length/H)*W:A.length*U});let C=16;w=Math.ceil(w/C)*C;let T=new ArrayBuffer(w);p.forEach((I,A)=>{let U=k[A],W=typeof I.data=="number"?[I.data]:I.data;if(I.type===6)new Int32Array(T,U,W.length).set(W);else if(I.type===12)new Uint32Array(T,U,W.length).set(W);else if(I.type===10)new Uint16Array(T,U,W.length).set(W);else if(I.type===1)new Float32Array(T,U,W.length).set(W);else throw new Error(`Unsupported uniform type: ${gt(I.type)}`)});let E=this.gpuDataManager.create(w,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(E.buffer,0,T,0,w),this.gpuDataManager.release(E.id),b={offset:0,size:w,buffer:E.buffer}}let _=this.programManager.normalizeDispatchGroupSize(d),$=_[1]===1&&_[2]===1,x=td(e,t,$),v=this.programManager.getArtifact(x);if(v||(v=this.programManager.build(e,_),this.programManager.setArtifact(x,v),me("info",()=>`[artifact] key: ${x}, programName: ${e.name}`)),p&&v.uniformVariablesInfo){if(p.length!==v.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${v.uniformVariablesInfo.length}, got ${p.length} in program "${v.programInfo.name}".`);for(let w=0;w<p.length;w++){let k=p[w],C=k.type,T=typeof k.data=="number"?1:k.data.length,[E,I]=v.uniformVariablesInfo[w];if(C!==E||T!==I)throw new Error(`Uniform variable ${w} mismatch: expect type ${E} with size ${I}, got type ${C} with size ${T} in program "${v.programInfo.name}".`)}}if(me("info",()=>`[ProgramManager] run "${e.name}" (key=${x}) with ${_[0]}x${_[1]}x${_[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let w={kernelId:this.currentKernelId,programName:v.programInfo.name,inputTensorViews:t,outputTensorViews:m};this.pendingKernels.push(w),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(w)}return this.programManager.run(v,o,g,_,b),Ke(e.name),m}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let a=kf.get(e);if(!a)throw new Error(`kernel not implemented: ${e}`);let s={kernelType:e,kernelName:i,kernelEntry:a[0],attributes:[a[1],r]};this.kernels.set(t,s)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let a=i.kernelType,s=i.kernelName,o=i.kernelEntry,u=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${a}] ${s}" is not allowed to be called recursively`);this.currentKernelId=e,u[0]&&(u[1]=u[0](u[1]),u[0]=void 0),me("info",()=>`[WebGPU] Start to run kernel "[${a}] ${s}"...`);let d=this.env.debug;this.temporaryData=[];try{return d&&this.device.pushErrorScope("validation"),o(t,u[1]),0}catch(p){return r.push(Promise.resolve(`[WebGPU] Kernel "[${a}] ${s}" failed. ${p}`)),1}finally{d&&r.push(this.device.popErrorScope().then(p=>p?`GPU validation error for kernel "[${a}] ${s}": ${p.message}`:null));for(let p of this.temporaryData)this.gpuDataManager.release(p.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let a=this.sessionExternalDataMapping.get(e);a||(a=new Map,this.sessionExternalDataMapping.set(e,a));let s=a.get(t),o=this.gpuDataManager.registerExternalBuffer(r,i,s);return a.set(t,[o,r]),o}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await Aa(this,e,t);return en(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){me("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){me("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){me("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let a=this.getComputePassEncoder(),s=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),a.setPipeline(s.computePipeline),a.setBindGroup(0,s.bindGroup),a.dispatchWorkgroups(...s.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Af={};Jt(Af,{init:()=>Of});var Qi,rd,Of,Mg=L(()=>{"use strict";se(),_t(),oe(),Fm(),Qi=class Rf{constructor(t,r,i,a){this.module=t,this.dataType=r,this.data=i,this.dims=a}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(O.size(t)!==O.size(this.dims))throw new Error("Invalid new shape");return new Rf(this.module,this.dataType,this.data,t)}},rd=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,a=r/e.PTR_SIZE,s=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*a++,s));let o=Number(e.getValue(i*a++,s));this.outputCount=Number(e.getValue(i*a++,s)),this.customDataOffset=Number(e.getValue(i*a++,"*")),this.customDataSize=Number(e.getValue(i*a++,s));let u=[];for(let d=0;d<o;d++){let p=Number(e.getValue(i*a++,s)),f=Number(e.getValue(i*a++,"*")),m=Number(e.getValue(i*a++,s)),g=[];for(let b=0;b<m;b++)g.push(Number(e.getValue(i*a++,s)));u.push(new Qi(e,p,f,g))}this.inputs=u}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){let r=t?.inputs?.map(o=>typeof o=="number"?this.inputs[o]:o)??this.inputs,i=t?.outputs??[],a=(o,u,d)=>new Qi(this.module,u,this.output(o,d),d),s=(o,u)=>{let d=Pt(o,u);if(!d)throw new Error(`Unsupported data type: ${o}`);let p=d>0?this.backend.gpuDataManager.create(d).id:0;return new Qi(this.module,o,p,u)};return this.backend.run(e,r,i,a,s,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,a=i===4?"i32":"i64",s=this.module.stackAlloc((1+t.length)*i);this.module.setValue(s,t.length,a);for(let o=0;o<t.length;o++)this.module.setValue(s+i*(o+1),t[o],a);return this.module._JsepOutput(this.opKernelContext,e,s)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},Of=async(e,t,r,i)=>{let a=t.jsepInit;if(!a)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let s=(Ng(),Ti(If)).WebGpuBackend,o=new s;await o.initialize(r,i),a("webgpu",[o,u=>o.alloc(Number(u)),u=>o.free(u),(u,d,p,f=!1)=>{if(f)me("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(u)}, dst=${Number(d)}, size=${Number(p)}`),o.memcpy(Number(u),Number(d));else{me("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(u)}, gpuDataId=${Number(d)}, size=${Number(p)}`);let m=t.HEAPU8.subarray(Number(u>>>0),Number(u>>>0)+Number(p));o.upload(Number(d),m)}},async(u,d,p)=>{me("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${u}, dataOffset=${d}, size=${p}`),await o.download(Number(u),()=>t.HEAPU8.subarray(Number(d)>>>0,Number(d+p)>>>0))},(u,d,p)=>o.createKernel(u,Number(d),p,t.UTF8ToString(t._JsepGetNodeName(Number(d)))),u=>o.releaseKernel(u),(u,d,p,f)=>{me("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${p}, kernel=${u}, contextDataOffset=${d}`);let m=new rd(t,o,Number(d));return o.computeKernel(Number(u),m,f)},()=>o.captureBegin(),()=>o.captureEnd(),()=>o.replay()])}else{let s=new Ld(r);a("webnn",[s,()=>s.reserveTensorId(),o=>s.releaseTensorId(o),async(o,u,d,p,f)=>s.ensureTensor(o,u,d,p,f),(o,u)=>{s.uploadTensor(o,u)},async(o,u)=>s.downloadTensor(o,u),(o,u)=>s.registerMLContext(o,u),!!r.trace])}}}),ad,cn,fn,$t,nd,Ta,or,hn,mn,Sa,gn,_n,yn,Nf=L(()=>{"use strict";Ze(),qm(),Wm(),se(),Ft(),Za(),Bd(),ad=(e,t)=>{ve()._OrtInit(e,t)!==0&&$e("Can't initialize onnxruntime.")},cn=async e=>{ad(e.wasm.numThreads,ir(e.logLevel))},fn=async(e,t)=>{ve().asyncInit?.();let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let i=e.webgpu.powerPreference;if(i!==void 0&&i!=="low-power"&&i!=="high-performance")throw new Error(`Invalid powerPreference setting: "${i}"`);let a=e.webgpu.forceFallbackAdapter;if(a!==void 0&&typeof a!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${a}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:i,forceFallbackAdapter:a}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let i=(Mg(),Ti(Af)).init;t==="webgpu"&&await i("webgpu",ve(),e,r),t==="webnn"&&await i("webnn",ve(),e)}},$t=new Map,nd=e=>{let t=ve(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,a,a+i)!==0&&$e("Can't get session input/output count.");let s=i===4?"i32":"i64";return[Number(t.getValue(a,s)),Number(t.getValue(a+i,s))]}finally{t.stackRestore(r)}},Ta=(e,t)=>{let r=ve(),i=r.stackSave(),a=0;try{let s=r.PTR_SIZE,o=r.stackAlloc(2*s);r._OrtGetInputOutputMetadata(e,t,o,o+s)!==0&&$e("Can't get session input/output metadata.");let u=Number(r.getValue(o,"*"));a=Number(r.getValue(o+s,"*"));let d=r.HEAP32[a/4];if(d===0)return[u,0];let p=r.HEAPU32[a/4+1],f=[];for(let m=0;m<p;m++){let g=Number(r.getValue(a+8+m*s,"*"));f.push(g!==0?r.UTF8ToString(g):Number(r.getValue(a+8+(m+p)*s,"*")))}return[u,d,f]}finally{r.stackRestore(i),a!==0&&r._OrtFree(a)}},or=e=>{let t=ve(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},hn=async(e,t)=>{let r,i,a=ve();Array.isArray(e)?[r,i]=e:e.buffer===a.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=or(e);let s=0,o=0,u=0,d=[],p=[],f=[];try{if([o,d]=await Md(t),t?.externalData&&a.mountExternalData){let C=[];for(let T of t.externalData){let E=typeof T=="string"?T:T.path;C.push(Xa(typeof T=="string"?T:T.data).then(I=>{a.mountExternalData(E,I)}))}await Promise.all(C)}for(let C of t?.executionProviders??[])if((typeof C=="string"?C:C.name)==="webnn"){if(a.shouldTransferToMLTensor=!1,typeof C!="string"){let T=C,E=T?.context,I=T?.gpuDevice,A=T?.deviceType,U=T?.powerPreference;E?a.currentContext=E:I?a.currentContext=await a.webnnCreateMLContext(I):a.currentContext=await a.webnnCreateMLContext({deviceType:A,powerPreference:U})}else a.currentContext=await a.webnnCreateMLContext();break}s=await a._OrtCreateSession(r,i,o),a.webgpuOnCreateSession?.(s),s===0&&$e("Can't create a session."),a.jsepOnCreateSession?.(),a.currentContext&&(a.webnnRegisterMLContext(s,a.currentContext),a.currentContext=void 0,a.shouldTransferToMLTensor=!0);let[m,g]=nd(s),b=!!t?.enableGraphCapture,_=[],$=[],x=[],v=[],w=[];for(let C=0;C<m;C++){let[T,E,I]=Ta(s,C);T===0&&$e("Can't get an input name."),p.push(T);let A=a.UTF8ToString(T);_.push(A),x.push(E===0?{name:A,isTensor:!1}:{name:A,isTensor:!0,type:gt(E),shape:I})}for(let C=0;C<g;C++){let[T,E,I]=Ta(s,C+m);T===0&&$e("Can't get an output name."),f.push(T);let A=a.UTF8ToString(T);$.push(A),v.push(E===0?{name:A,isTensor:!1}:{name:A,isTensor:!0,type:gt(E),shape:I});{if(b&&t?.preferredOutputLocation===void 0){w.push("gpu-buffer");continue}let U=typeof t?.preferredOutputLocation=="string"?t.preferredOutputLocation:t?.preferredOutputLocation?.[A]??"cpu",W=a.webnnIsGraphOutput;if(U==="cpu"&&W&&W(s,A)){w.push("ml-tensor-cpu-output");continue}if(U!=="cpu"&&U!=="cpu-pinned"&&U!=="gpu-buffer"&&U!=="ml-tensor")throw new Error(`Not supported preferred output location: ${U}.`);if(b&&U!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${U}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);w.push(U)}}let k=null;return w.some(C=>C==="gpu-buffer"||C==="ml-tensor"||C==="ml-tensor-cpu-output")&&(u=a._OrtCreateBinding(s),u===0&&$e("Can't create IO binding."),k={handle:u,outputPreferredLocations:w,outputPreferredLocationsEncoded:w.map(C=>C==="ml-tensor-cpu-output"?"ml-tensor":C).map(C=>Ia(C))}),$t.set(s,[s,p,f,k,b,!1]),[s,_,$,x,v]}catch(m){throw p.forEach(g=>a._OrtFree(g)),f.forEach(g=>a._OrtFree(g)),u!==0&&a._OrtReleaseBinding(u)!==0&&$e("Can't release IO binding."),s!==0&&a._OrtReleaseSession(s)!==0&&$e("Can't release session."),m}finally{a._free(r),o!==0&&a._OrtReleaseSessionOptions(o)!==0&&$e("Can't release session options."),d.forEach(m=>a._free(m)),a.unmountExternalData?.()}},mn=e=>{let t=ve(),r=$t.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,a,s,o,u]=r;o&&(u&&t._OrtClearBoundOutputs(o.handle)!==0&&$e("Can't clear bound outputs."),t._OrtReleaseBinding(o.handle)!==0&&$e("Can't release IO binding.")),t.jsepOnReleaseSession?.(e),t.webnnOnReleaseSession?.(e),t.webgpuOnReleaseSession?.(e),a.forEach(d=>t._OrtFree(d)),s.forEach(d=>t._OrtFree(d)),t._OrtReleaseSession(i)!==0&&$e("Can't release session."),$t.delete(e)},Sa=async(e,t,r,i,a,s,o=!1)=>{if(!e){t.push(0);return}let u=ve(),d=u.PTR_SIZE,p=e[0],f=e[1],m=e[3],g=m,b,_;if(p==="string"&&(m==="gpu-buffer"||m==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(o&&m!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${s} when enableGraphCapture is true.`);if(m==="gpu-buffer"){let v=e[2].gpuBuffer;_=Pt(Dt(p),f);{let w=u.jsepRegisterBuffer;if(!w)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');b=w(i,s,v,_)}}else if(m==="ml-tensor"){let v=e[2].mlTensor;_=Pt(Dt(p),f);let w=u.webnnRegisterMLTensor;if(!w)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');b=w(i,v,Dt(p),f)}else{let v=e[2];if(Array.isArray(v)){_=d*v.length,b=u._malloc(_),r.push(b);for(let w=0;w<v.length;w++){if(typeof v[w]!="string")throw new TypeError(`tensor data at index ${w} is not a string`);u.setValue(b+w*d,rt(v[w],r),"*")}}else{let w=u.webnnIsGraphInput,k=u.webnnIsGraphOutput;if(p!=="string"&&w&&k){let C=u.UTF8ToString(a);if(w(i,C)||k(i,C)){let T=Dt(p);_=Pt(T,f),g="ml-tensor";let E=u.webnnCreateTemporaryTensor,I=u.webnnUploadTensor;if(!E||!I)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let A=await E(i,T,f);I(A,new Uint8Array(v.buffer,v.byteOffset,v.byteLength)),b=A}else _=v.byteLength,b=u._malloc(_),r.push(b),u.HEAPU8.set(new Uint8Array(v.buffer,v.byteOffset,_),b)}else _=v.byteLength,b=u._malloc(_),r.push(b),u.HEAPU8.set(new Uint8Array(v.buffer,v.byteOffset,_),b)}}let $=u.stackSave(),x=u.stackAlloc(4*f.length);try{f.forEach((w,k)=>u.setValue(x+k*d,w,d===4?"i32":"i64"));let v=u._OrtCreateTensor(Dt(p),b,_,x,f.length,Ia(g));v===0&&$e(`Can't create tensor for input/output. session=${i}, index=${s}.`),t.push(v)}finally{u.stackRestore($)}},gn=async(e,t,r,i,a,s)=>{let o=ve(),u=o.PTR_SIZE,d=$t.get(e);if(!d)throw new Error(`cannot run inference. invalid session id: ${e}`);let p=d[0],f=d[1],m=d[2],g=d[3],b=d[4],_=d[5],$=t.length,x=i.length,v=0,w=[],k=[],C=[],T=[],E=o.stackSave(),I=o.stackAlloc($*u),A=o.stackAlloc($*u),U=o.stackAlloc(x*u),W=o.stackAlloc(x*u);try{[v,w]=Nd(s),xt("wasm prepareInputOutputTensor");for(let V=0;V<$;V++)await Sa(r[V],k,T,e,f[t[V]],t[V],b);for(let V=0;V<x;V++)await Sa(a[V],C,T,e,m[i[V]],$+i[V],b);Tt("wasm prepareInputOutputTensor");for(let V=0;V<$;V++)o.setValue(I+V*u,k[V],"*"),o.setValue(A+V*u,f[t[V]],"*");for(let V=0;V<x;V++)o.setValue(U+V*u,C[V],"*"),o.setValue(W+V*u,m[i[V]],"*");if(g&&!_){let{handle:V,outputPreferredLocations:X,outputPreferredLocationsEncoded:Z}=g;if(f.length!==$)throw new Error(`input count from feeds (${$}) is expected to be always equal to model's input count (${f.length}).`);xt("wasm bindInputsOutputs");for(let K=0;K<$;K++){let re=t[K];await o._OrtBindInput(V,f[re],k[K])!==0&&$e(`Can't bind input[${K}] for session=${e}.`)}for(let K=0;K<x;K++){let re=i[K];a[K]?.[3]?o._OrtBindOutput(V,m[re],C[K],0)!==0&&$e(`Can't bind pre-allocated output[${K}] for session=${e}.`):o._OrtBindOutput(V,m[re],0,Z[re])!==0&&$e(`Can't bind output[${K}] to ${X[K]} for session=${e}.`)}Tt("wasm bindInputsOutputs"),$t.set(e,[p,f,m,g,b,!0])}o.jsepOnRunStart?.(p),o.webnnOnRunStart?.(p);let F;g?F=await o._OrtRunWithBinding(p,g.handle,x,U,v):F=await o._OrtRun(p,A,I,$,W,x,U,v),F!==0&&$e("failed to call OrtRun().");let H=[],te=[];xt("wasm ProcessOutputTensor");for(let V=0;V<x;V++){let X=Number(o.getValue(U+V*u,"*"));if(X===C[V]){H.push(a[V]);continue}let Z=o.stackSave(),K=o.stackAlloc(4*u),re=!1,j,le=0;try{o._OrtGetTensorData(X,K,K+u,K+2*u,K+3*u)!==0&&$e(`Can't access output tensor data on index ${V}.`);let N=u===4?"i32":"i64",M=Number(o.getValue(K,N));le=o.getValue(K+u,"*");let Y=o.getValue(K+u*2,"*"),pe=Number(o.getValue(K+u*3,N)),B=[];for(let ce=0;ce<pe;ce++)B.push(Number(o.getValue(Y+ce*u,N)));o._OrtFree(Y)!==0&&$e("Can't free memory for tensor dims.");let Q=B.reduce((ce,fe)=>ce*fe,1);j=gt(M);let Se=g?.outputPreferredLocations[i[V]];if(j==="string"){if(Se==="gpu-buffer"||Se==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let ce=[];for(let fe=0;fe<Q;fe++){let xe=o.getValue(le+fe*u,"*"),ye=o.getValue(le+(fe+1)*u,"*"),Oe=fe===Q-1?void 0:ye-xe;ce.push(o.UTF8ToString(xe,Oe))}H.push([j,B,ce,"cpu"])}else if(Se==="gpu-buffer"&&Q>0){let ce=o.jsepGetBuffer;if(!ce)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let fe=ce(le),xe=Pt(M,Q);if(xe===void 0||!Qa(j))throw new Error(`Unsupported data type: ${j}`);re=!0,H.push([j,B,{gpuBuffer:fe,download:o.jsepCreateDownloader(fe,xe,j),dispose:()=>{o._OrtReleaseTensor(X)!==0&&$e("Can't release tensor.")}},"gpu-buffer"])}else if(Se==="ml-tensor"&&Q>0){let ce=o.webnnEnsureTensor,fe=o.webnnIsGraphInputOutputTypeSupported;if(!ce||!fe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(Pt(M,Q)===void 0||!Ya(j))throw new Error(`Unsupported data type: ${j}`);if(!fe(e,j,!1))throw new Error(`preferredLocation "ml-tensor" for ${j} output is not supported by current WebNN Context.`);let xe=await ce(e,le,M,B,!1);re=!0,H.push([j,B,{mlTensor:xe,download:o.webnnCreateMLTensorDownloader(le,j),dispose:()=>{o.webnnReleaseTensorId(le),o._OrtReleaseTensor(X)}},"ml-tensor"])}else if(Se==="ml-tensor-cpu-output"&&Q>0){let ce=o.webnnCreateMLTensorDownloader(le,j)(),fe=H.length;re=!0,te.push((async()=>{let xe=[fe,await ce];return o.webnnReleaseTensorId(le),o._OrtReleaseTensor(X),xe})()),H.push([j,B,[],"cpu"])}else{let ce=ur(j),fe=new ce(Q);new Uint8Array(fe.buffer,fe.byteOffset,fe.byteLength).set(o.HEAPU8.subarray(le,le+fe.byteLength)),H.push([j,B,fe,"cpu"])}}finally{o.stackRestore(Z),j==="string"&&le&&o._free(le),re||o._OrtReleaseTensor(X)}}g&&!b&&(o._OrtClearBoundOutputs(g.handle)!==0&&$e("Can't clear bound outputs."),$t.set(e,[p,f,m,g,b,!1]));for(let[V,X]of await Promise.all(te))H[V][2]=X;return Tt("wasm ProcessOutputTensor"),H}finally{o.webnnOnRunEnd?.(p),o.stackRestore(E),k.forEach(F=>o._OrtReleaseTensor(F)),C.forEach(F=>o._OrtReleaseTensor(F)),T.forEach(F=>o._free(F)),v!==0&&o._OrtReleaseRunOptions(v),w.forEach(F=>o._free(F))}},_n=e=>{let t=ve(),r=$t.get(e);if(!r)throw new Error("invalid session id");let i=r[0],a=t._OrtEndProfiling(i);a===0&&$e("Can't get an profile file name."),t._OrtFree(a)},yn=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),vt,He,Zt,_i,yi,Yi,Ca,Xi,Nt,Mt,sd,Mf,Bf,Df,Pf,Uf,qf,Wf,Lf=L(()=>{"use strict";Ze(),Nf(),Ft(),Ha(),vt=()=>!!_e.wasm.proxy&&typeof document<"u",Zt=!1,_i=!1,yi=!1,Xi=new Map,Nt=(e,t)=>{let r=Xi.get(e);r?r.push(t):Xi.set(e,[t])},Mt=()=>{if(Zt||!_i||yi||!He)throw new Error("worker not ready")},sd=e=>{switch(e.data.type){case"init-wasm":Zt=!1,e.data.err?(yi=!0,Ca[1](e.data.err)):(_i=!0,Ca[0]()),Yi&&(URL.revokeObjectURL(Yi),Yi=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Xi.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}default:}},Mf=async()=>{if(!_i){if(Zt)throw new Error("multiple calls to 'initWasm()' detected.");if(yi)throw new Error("previous call to 'initWasm()' failed.");if(Zt=!0,vt())return new Promise((e,t)=>{He?.terminate(),Od().then(([r,i])=>{try{He=i,He.onerror=s=>t(s),He.onmessage=sd,Ca=[e,t];let a={type:"init-wasm",in:_e};!a.in.wasm.wasmPaths&&(r||Ea)&&(a.in.wasm.wasmPaths={wasm:new URL("ort-wasm-simd-threaded.jsep.wasm",void 0).href}),He.postMessage(a),Yi=r}catch(a){t(a)}},t)});try{await Ka(_e.wasm),await cn(_e),_i=!0}catch(e){throw yi=!0,e}finally{Zt=!1}}},Bf=async e=>{if(vt())return Mt(),new Promise((t,r)=>{Nt("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:_e}};He.postMessage(i)});await fn(_e,e)},Df=async e=>vt()?(Mt(),new Promise((t,r)=>{Nt("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};He.postMessage(i,[e.buffer])})):or(e),Pf=async(e,t)=>{if(vt()){if(t?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Mt(),new Promise((r,i)=>{Nt("create",[r,i]);let a={type:"create",in:{model:e,options:{...t}}},s=[];e instanceof Uint8Array&&s.push(e.buffer),He.postMessage(a,s)})}else return hn(e,t)},Uf=async e=>{if(vt())return Mt(),new Promise((t,r)=>{Nt("release",[t,r]);let i={type:"release",in:e};He.postMessage(i)});mn(e)},qf=async(e,t,r,i,a,s)=>{if(vt()){if(r.some(o=>o[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(a.some(o=>o))throw new Error("pre-allocated output tensor is not supported for proxy.");return Mt(),new Promise((o,u)=>{Nt("run",[o,u]);let d=r,p={type:"run",in:{sessionId:e,inputIndices:t,inputs:d,outputIndices:i,options:s}};He.postMessage(p,yn(d))})}else return gn(e,t,r,i,a,s)},Wf=async e=>{if(vt())return Mt(),new Promise((t,r)=>{Nt("end-profiling",[t,r]);let i={type:"end-profiling",in:e};He.postMessage(i)});_n(e)}}),ka,od,Ff,Bg=L(()=>{"use strict";Ze(),Lf(),se(),ja(),Bd(),ka=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},od=e=>{switch(e[3]){case"cpu":return new Ue(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!Qa(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:a}=e[2];return Ue.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:a})}case"ml-tensor":{let t=e[0];if(!Ya(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:a}=e[2];return Ue.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:a})}default:throw new Error(`invalid data location: ${e[3]}`)}},Ff=class{async fetchModelAndCopyToWasmMemory(e){return Df(await Xa(e))}async loadModel(e,t){at();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Pf(r,t),Ke()}async dispose(){return Uf(this.sessionId)}async run(e,t,r){at();let i=[],a=[];Object.entries(e).forEach(m=>{let g=m[0],b=m[1],_=this.inputNames.indexOf(g);if(_===-1)throw new Error(`invalid input '${g}'`);i.push(b),a.push(_)});let s=[],o=[];Object.entries(t).forEach(m=>{let g=m[0],b=m[1],_=this.outputNames.indexOf(g);if(_===-1)throw new Error(`invalid output '${g}'`);s.push(b),o.push(_)});let u=i.map((m,g)=>ka(m,()=>`input "${this.inputNames[a[g]]}"`)),d=s.map((m,g)=>m?ka(m,()=>`output "${this.outputNames[o[g]]}"`):null),p=await qf(this.sessionId,a,u,o,d,r),f={};for(let m=0;m<p.length;m++)f[this.outputNames[o[m]]]=s[m]??od(p[m]);return Ke(),f}startProfiling(){}endProfiling(){Wf(this.sessionId)}}}),Gf={};Jt(Gf,{OnnxruntimeWebAssemblyBackend:()=>Fa,initializeFlags:()=>La,wasmBackend:()=>Vf});var La,Fa,Vf,Dg=L(()=>{"use strict";Ze(),Lf(),Bg(),La=()=>{(typeof _e.wasm.initTimeout!="number"||_e.wasm.initTimeout<0)&&(_e.wasm.initTimeout=0);let e=_e.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),_e.wasm.simd=!1),typeof _e.wasm.proxy!="boolean"&&(_e.wasm.proxy=!1),typeof _e.wasm.trace!="boolean"&&(_e.wasm.trace=!1),typeof _e.wasm.numThreads!="number"||!Number.isInteger(_e.wasm.numThreads)||_e.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)_e.wasm.numThreads=1;else{let t=typeof navigator>"u"?xm("node:os").cpus().length:navigator.hardwareConcurrency;_e.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},Fa=class{async init(e){La(),await Mf(),await Bf(e)}async createInferenceSessionHandler(e,t){let r=new Ff;return await r.loadModel(e,t),r}},Vf=new Fa});Ze();Ze();Ze();var Pg="1.23.0",Ug=Cd;{let e=(Dg(),Ti(Gf)).wasmBackend;Ut("webgpu",e,5),Ut("webnn",e,5),Ut("cpu",e,10),Ut("wasm",e,10)}Object.defineProperty(_e.versions,"web",{value:Pg,enumerable:!0});var Vt=jf(),ti=null,Qe=null,Kf="",dr={allowWasm:!1,forceWasm:!1},wn=new Set;function kt(e,t){self.postMessage(e,t||[])}function ki(e){let t=String(e&&e.message||e||"unknown error");return/memory|alloc|OOM|out of/i.test(t)?"Not enough memory to run the vocal separation model ("+t.slice(0,120)+")":t.slice(0,300)}function Wg(){_e.wasm.wasmPaths={wasm:new URL("ort/ort-wasm-simd-threaded.jsep.wasm",self.location.href).href},_e.wasm.numThreads=1,_e.wasm.proxy=!1,_e.logLevel="error",_e.webgpu&&(_e.webgpu.powerPreference="high-performance")}async function Lg(){if(!self.navigator||!navigator.gpu)throw new Error("WebGPU is not available in this browser");let e=null;try{e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"})}catch{}if(!e)throw new Error("No WebGPU adapter was found (the graphics card or its driver is not supported)");return e}function Fg(){let e={};return e[Qe.inputNames[0]]=new Ue("float32",new Float32Array(2*Vt.SEGMENT),[1,2,Vt.SEGMENT]),e[Qe.inputNames[1]]=new Ue("float32",new Float32Array(4*Vt.FREQS*Vt.FRAMES),[1,4,Vt.FREQS,Vt.FRAMES]),e}async function Gg(){Wg();let e=ti;ti=null;let t=[],r=null,i="";if(!dr.forceWasm)try{await Lg();let a=await ei.create(e,{executionProviders:["webgpu"],graphOptimizationLevel:"all",enableMemPattern:!1,enableCpuMemArena:!1});kt({t:"loading",progress:.7}),Qe=a;let s=await a.run(Fg());for(let o in s){let u=s[o].data;if(!u||!isFinite(u[0]))throw new Error("the GPU returned invalid numbers")}r=a,i="webgpu"}catch(a){if(t.push("WebGPU: "+ki(a)),Qe){try{await Qe.release()}catch{}Qe=null}}if(!r&&(dr.allowWasm||dr.forceWasm))try{r=await ei.create(e,{executionProviders:["wasm"],graphOptimizationLevel:"disabled"}),i="wasm"}catch(a){t.push("WASM: "+ki(a))}if(!r)throw new Error(t.join("; ")||"no way to run the model");return Qe=r,Kf=i,t}async function Vg(){try{kt({t:"loading",progress:.2}),await Gg(),kt({t:"ready",ep:Kf})}catch(e){ti=null,kt({t:"fail",reason:ki(e),detail:String(e&&e.stack||e).slice(0,600)})}}async function jg(e){let t=performance.now();try{if(!Qe)throw new Error("the separator is not loaded");let r=await Vt.separate(bn,Qe,e.channels,{overlap:e.overlap,onProgress:function(a){kt({t:"progress",id:e.id,f:a})},isAborted:function(){return wn.has(e.id)}}),i=[r.vocals[0].buffer,r.vocals[1].buffer,r.inst[0].buffer,r.inst[1].buffer];kt({t:"done",id:e.id,vocals:r.vocals,inst:r.inst,seconds:(performance.now()-t)/1e3},i)}catch(r){kt({t:"error",id:e.id,name:r&&r.name||"Error",message:ki(r)})}finally{wn.delete(e.id)}}var Hf=0;self.onmessage=function(e){let t=e.data||{};try{switch(t.t){case"model-begin":dr={allowWasm:!!t.allowWasm,forceWasm:!!t.forceWasm},ti=new Uint8Array(t.bytes),Hf=0;break;case"model-part":ti.set(new Uint8Array(t.buf),t.offset),Hf+=t.buf.byteLength;break;case"model-create":Vg();break;case"sep":jg(t);break;case"abort":wn.add(t.id);break;case"dispose":ti=null,Qe&&(Qe.release().catch(function(){}),Qe=null);break}}catch(r){kt({t:"fail",reason:ki(r),detail:String(r&&r.stack||r).slice(0,600)})}};})();
