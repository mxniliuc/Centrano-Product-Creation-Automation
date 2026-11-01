// feed/shrink.swift
// Re-encode a clip to H.264/AAC MP4 under a size limit (Business Suite uploads here are capped at 10 MB).
// Keeps the aspect ratio, caps the long side at 1280 px and picks the video bitrate from the duration.
//
//   swiftc -O feed/shrink.swift -o feed/.build/shrink
//   feed/.build/shrink in.mp4 out.mp4 [maxMB=9]

import AVFoundation

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: shrink <in.mp4> <out.mp4> [maxMB]")
    exit(1)
}
let src = URL(fileURLWithPath: args[1])
let dst = URL(fileURLWithPath: args[2])
let maxMB = args.count > 3 ? Double(args[3]) ?? 9 : 9

let asset = AVURLAsset(url: src)
guard let vTrack = asset.tracks(withMediaType: .video).first else {
    print("no video track")
    exit(1)
}
let aTrack = asset.tracks(withMediaType: .audio).first
let seconds = CMTimeGetSeconds(asset.duration)

let size = vTrack.naturalSize
let scale = min(1.0, 1280.0 / max(size.width, size.height))
let width = Int((size.width * scale / 2).rounded()) * 2
let height = Int((size.height * scale / 2).rounded()) * 2
let audioBps = 128_000.0
let videoBps = min(4_000_000.0, (maxMB * 8_000_000 / seconds - audioBps) * 0.92)

try? FileManager.default.removeItem(at: dst)
let reader = try AVAssetReader(asset: asset)
let writer = try AVAssetWriter(outputURL: dst, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true

let vOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
])
reader.add(vOut)
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: Int(videoBps),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: 60,
    ],
])
vIn.transform = vTrack.preferredTransform
vIn.expectsMediaDataInRealTime = false
writer.add(vIn)

var pairs: [(AVAssetReaderOutput, AVAssetWriterInput)] = [(vOut, vIn)]
if let aTrack = aTrack {
    let desc = aTrack.formatDescriptions.first.map { $0 as! CMAudioFormatDescription }
    let asbd = desc.flatMap { CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }
    let rate = asbd.map { $0.mSampleRate } ?? 44_100
    let channels = min(2, Int(asbd?.mChannelsPerFrame ?? 2))
    let aOut = AVAssetReaderTrackOutput(track: aTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
    reader.add(aOut)
    let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVNumberOfChannelsKey: channels,
        AVSampleRateKey: rate,
        AVEncoderBitRateKey: Int(audioBps),
    ])
    aIn.expectsMediaDataInRealTime = false
    writer.add(aIn)
    pairs.append((aOut, aIn))
}

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let group = DispatchGroup()
for (i, (output, input)) in pairs.enumerated() {
    group.enter()
    let queue = DispatchQueue(label: "shrink.\(i)")
    input.requestMediaDataWhenReady(on: queue) {
        while input.isReadyForMoreMediaData {
            if let buffer = output.copyNextSampleBuffer() {
                input.append(buffer)
            } else {
                input.markAsFinished()
                group.leave()
                return
            }
        }
    }
}
group.wait()

let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()

if writer.status != .completed {
    print("failed: \(writer.error?.localizedDescription ?? "unknown")")
    exit(1)
}
let bytes = (try? FileManager.default.attributesOfItem(atPath: dst.path)[.size] as? Int) ?? 0
print(String(format: "%@  %dx%d  %.0fs  %.1f MB", dst.lastPathComponent, width, height, seconds, Double(bytes) / 1_048_576))
