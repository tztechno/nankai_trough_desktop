import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * 地図アニメーションの動画録画
 *
 * WebCodecs (VideoEncoder, H.264) + mp4-muxer でフレーム単位に MP4 を生成する。
 * シミュレーションの描画フレーム1枚を動画の1フレームとして記録するため、計算速度に依らず一定のフレームレートで再生される。
 * WebCodecs が使えない環境では MediaRecorder (MP4 優先、未対応なら WebM) にフォールバックする。
 */
export class VideoRecorder {
  private static readonly FPS = 30;
  private static readonly MAX_W = 1920;
  private static readonly MAX_H = 1080;

  private source: HTMLCanvasElement;
  private frameCanvas: HTMLCanvasElement;
  private frameCtx: CanvasRenderingContext2D;

  private encoder: VideoEncoder | null = null;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private encoderError: unknown = null;
  private frameIndex = 0;

  private mediaRecorder: MediaRecorder | null = null;
  private mediaChunks: Blob[] = [];
  private mediaMime = '';

  constructor(source: HTMLCanvasElement) {
    this.source = source;
    // H.264 は偶数サイズが必須。フルHD以内に縮小する
    const scale = Math.min(1, VideoRecorder.MAX_W / source.width, VideoRecorder.MAX_H / source.height);
    this.frameCanvas = document.createElement('canvas');
    this.frameCanvas.width = Math.max(2, Math.floor((source.width * scale) / 2) * 2);
    this.frameCanvas.height = Math.max(2, Math.floor((source.height * scale) / 2) * 2);
    const ctx = this.frameCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get recording context');
    this.frameCtx = ctx;
  }

  /**
   * 録画開始。戻り値は保存形式の拡張子 ('mp4' | 'webm')
   */
  public async start(): Promise<'mp4' | 'webm'> {
    if (await this.startWebCodecs()) return 'mp4';
    return this.startMediaRecorder();
  }

  private async startWebCodecs(): Promise<boolean> {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false;

    const width = this.frameCanvas.width;
    const height = this.frameCanvas.height;
    // High@5.1 → Main@4.0 → Baseline@3.1 の順に対応を確認
    const codecs = ['avc1.640033', 'avc1.4d0028', 'avc1.42001f'];
    let config: VideoEncoderConfig | null = null;
    for (const codec of codecs) {
      const candidate: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: VideoRecorder.FPS,
        avc: { format: 'avc' }
      };
      try {
        const support = await VideoEncoder.isConfigSupported(candidate);
        if (support.supported) {
          config = candidate;
          break;
        }
      } catch {
        // 次の候補を試す
      }
    }
    if (!config) return false;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width, height, frameRate: VideoRecorder.FPS },
      fastStart: 'in-memory'
    });
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer?.addVideoChunk(chunk, meta),
      error: (e) => {
        this.encoderError = e;
        console.error(e);
      }
    });
    this.encoder.configure(config);
    return true;
  }

  private startMediaRecorder(): 'mp4' | 'webm' {
    if (typeof MediaRecorder === 'undefined' || !this.frameCanvas.captureStream) {
      throw new Error('Video recording is not supported');
    }
    const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    this.mediaMime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const stream = this.frameCanvas.captureStream(VideoRecorder.FPS);
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: this.mediaMime || undefined,
      videoBitsPerSecond: 8_000_000
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.mediaChunks.push(e.data);
    };
    this.mediaRecorder.start(1000);
    return this.mediaMime.startsWith('video/mp4') ? 'mp4' : 'webm';
  }

  /**
   * 現在の地図 Canvas を1フレームとして記録
   */
  public captureFrame(title: string): void {
    const ctx = this.frameCtx;
    const W = this.frameCanvas.width;
    const H = this.frameCanvas.height;

    // 録画中にウィンドウサイズが変わっても縦横比を保って収める
    const scale = Math.min(W / this.source.width, H / this.source.height);
    const dw = this.source.width * scale;
    const dh = this.source.height * scale;
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.source, (W - dw) / 2, (H - dh) / 2, dw, dh);

    // シナリオ名 (左上)
    ctx.save();
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(12, 12, tw + 20, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 22, 27);
    ctx.restore();

    if (this.encoder && this.encoder.state === 'configured') {
      const frame = new VideoFrame(this.frameCanvas, {
        timestamp: Math.round((this.frameIndex * 1_000_000) / VideoRecorder.FPS),
        duration: Math.round(1_000_000 / VideoRecorder.FPS)
      });
      this.encoder.encode(frame, { keyFrame: this.frameIndex % (VideoRecorder.FPS * 2) === 0 });
      frame.close();
    }
    this.frameIndex++;
  }

  /**
   * 録画を終了し、動画ファイルの Blob を返す
   */
  public async stop(): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
    if (this.encoder && this.muxer) {
      if (this.encoder.state === 'configured') {
        await this.encoder.flush();
        this.encoder.close();
      }
      if (this.encoderError) throw this.encoderError;
      this.muxer.finalize();
      return { blob: new Blob([this.muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
    }

    const recorder = this.mediaRecorder;
    if (!recorder) throw new Error('Recorder is not started');
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const type = this.mediaMime || 'video/webm';
    return {
      blob: new Blob(this.mediaChunks, { type }),
      ext: type.startsWith('video/mp4') ? 'mp4' : 'webm'
    };
  }
}
