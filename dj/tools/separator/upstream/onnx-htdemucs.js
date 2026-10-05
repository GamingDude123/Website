import * as ort from 'onnxruntime-node';
// as far as I can tell this only matters on the web
ort.env.wasm.wasmPaths = './';
export class ONNXHTDemucs {
    sources = ['drums', 'bass', 'other', 'vocals'];
    audioChannels = 2;
    samplerate = 44100;
    segment = 7.8;
    // @ts-expect-error these are initialized in the async initializer
    session;
    // @ts-expect-error
    inputNames;
    // @ts-expect-error
    outputNames;
    constructor() { }
    static async init(modelWeights) {
        let instance = new ONNXHTDemucs();
        let opts = typeof self === 'undefined' || typeof self.location === 'undefined' ? undefined : { executionProviders: ['webgpu', 'wasm'] };
        let session = await ort.InferenceSession.create(modelWeights, opts);
        instance.session = session;
        instance.inputNames = session.inputNames;
        instance.outputNames = session.outputNames;
        return instance;
    }
    validLength(length) {
        const trainingLength = Math.floor(this.segment * this.samplerate);
        if (trainingLength < length) {
            throw new Error(`Given length ${length} is longer than training length ${trainingLength}`);
        }
        return trainingLength;
    }
    async forward(mix, magspec) {
        const mixTensor = new ort.Tensor('float32', mix.data, mix.shape);
        const magspecTensor = new ort.Tensor('float32', magspec.data, magspec.shape);
        const feeds = {};
        feeds[this.inputNames[0]] = mixTensor;
        feeds[this.inputNames[1]] = magspecTensor;
        const results = await this.session.run(feeds);
        const outX = results[this.outputNames[0]];
        const outXt = results[this.outputNames[1]];
        return {
            outX: { data: outX.data, shape: outX.dims },
            outXt: { data: outXt.data, shape: outXt.dims },
        };
    }
}
